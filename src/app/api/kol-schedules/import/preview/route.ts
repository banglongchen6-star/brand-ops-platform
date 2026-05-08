// 排期导入 · 预览（多 part：解析 + 字段映射建议 + 校验）
//
// POST multipart/form-data { file }
// 返回 {
//   headers: ["日期", "类目", ...],
//   mapping: { 日期: "schedule_date", ... },   // 自动 fuzzy match 后的建议
//   rows: [{ raw, parsed: {schedule_date, ...}, errors: [] }, ...],
//   stats: { total, ok, withError },
//   knownCategories: ["..."],   // 字典里全部的活跃类目，前端可在 mapping 列表给提示
// }
//
// 为了简化，preview 把整张表都解析返回。execute 阶段直接收 client 发回的 parsed rows
// 写库（避免把文件存服务端的复杂状态）。文件大小硬上限 5MB / 5000 行。

import { requireUser } from "@/lib/requireUser";
import { COLUMNS, parseDate, parseTier, parseAmount, parseStatus } from "@/lib/scheduleExcel";
import * as XLSX from "xlsx";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 5000;

interface ParsedRow {
  index: number;
  raw: Record<string, unknown>;
  parsed: {
    schedule_date: string;
    category: string;
    category_direction: string;
    kol_name: string;
    tier: string;
    amount: number;
    platform: string;
    status: string;
    publish_url: string;
    notes: string;
  } | null;
  errors: string[];
}

// 模糊映射 Excel 表头 → 内部字段名
function suggestMapping(headers: string[]): Record<string, string> {
  const suggestion: Record<string, string> = {};
  const lookup: Record<string, string> = {};
  for (const c of COLUMNS) {
    lookup[c.header] = c.key;
    lookup[c.header + "*"] = c.key;
  }
  // 别名
  const aliases: Record<string, string> = {
    "时间": "schedule_date",
    "排期日期": "schedule_date",
    "投放日期": "schedule_date",
    "种类": "category",
    "投放类目": "category",
    "内容方向": "category_direction",
    "达人": "kol_name",
    "博主": "kol_name",
    "博主名": "kol_name",
    "达人姓名": "kol_name",
    "达人体量": "tier",
    "层": "tier",
    "金额": "amount",
    "费用 (元)": "amount",
    "费用(元)": "amount",
    "投放费用": "amount",
    "投放平台": "platform",
    "媒介": "platform",
    "进度": "status",
    "状态/进度": "status",
    "链接": "publish_url",
    "URL": "publish_url",
    "url": "publish_url",
    "作品链接": "publish_url",
    "说明": "notes",
    "备注信息": "notes",
  };

  for (const h of headers) {
    const cleaned = h.trim();
    if (lookup[cleaned]) suggestion[h] = lookup[cleaned];
    else if (aliases[cleaned]) suggestion[h] = aliases[cleaned];
  }
  return suggestion;
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return Response.json({ error: "需要 multipart/form-data 上传" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "缺少 file 字段" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: `文件超过 ${MAX_FILE_SIZE / 1024 / 1024} MB` }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(buf, { type: "buffer", cellDates: false }); }
  catch (e) {
    return Response.json({ error: "Excel 解析失败：" + (e instanceof Error ? e.message : String(e)) }, { status: 400 });
  }

  // 取第一个 sheet
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return Response.json({ error: "Excel 没有 sheet" }, { status: 400 });
  const ws = wb.Sheets[sheetName];

  // 解成 array of arrays（保留原始数据类型，便于日期数字识别）
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  if (aoa.length < 2) return Response.json({ error: "Excel 至少需要表头 + 1 行数据" }, { status: 400 });

  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? "").trim());
  if (aoa.length - 1 > MAX_ROWS) {
    return Response.json({ error: `数据行超过 ${MAX_ROWS}，请拆分后导入` }, { status: 400 });
  }
  const mapping = suggestMapping(headers);

  // 检查必填字段是否被映射上
  const requiredKeys = COLUMNS.filter((c) => c.required).map((c) => c.key);
  const missingRequired = requiredKeys.filter(
    (k) => !Object.values(mapping).includes(k)
  );

  const parsed: ParsedRow[] = [];
  let okCount = 0;
  let errCount = 0;
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] as unknown[];
    if (!row || row.every((v) => v === "" || v === null || v === undefined)) continue; // 跳过空行
    const raw: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) raw[headers[j]] = row[j];

    const errors: string[] = [];
    const get = (key: string): unknown => {
      const matchedHeader = Object.keys(mapping).find((h) => mapping[h] === key);
      if (!matchedHeader) return undefined;
      return raw[matchedHeader];
    };

    const dateRes = parseDate(get("schedule_date"));
    const amountRes = parseAmount(get("amount"));
    const tierRes = parseTier(get("tier"));
    const statusRes = parseStatus(get("status"));

    if (!dateRes.ok) errors.push(dateRes.error);
    if (!amountRes.ok) errors.push(amountRes.error);
    if (!tierRes.ok) errors.push(tierRes.error);
    if (!statusRes.ok) errors.push(statusRes.error);

    // 类目已废弃为可选；不再校验是否在字典里
    const category = String(get("category") ?? "").trim();

    const kolName = String(get("kol_name") ?? "").trim();
    if (!kolName) errors.push("达人名不能为空");

    const direction = String(get("category_direction") ?? "").trim();
    const platform = String(get("platform") ?? "").trim();
    const publishUrl = String(get("publish_url") ?? "").trim();
    const notes = String(get("notes") ?? "").trim();

    if (errors.length > 0) {
      errCount++;
      parsed.push({ index: i, raw, parsed: null, errors });
    } else {
      okCount++;
      parsed.push({
        index: i, raw, errors: [],
        parsed: {
          schedule_date: (dateRes as { ok: true; value: string }).value,
          category, category_direction: direction, kol_name: kolName,
          tier: (tierRes as { ok: true; value: string }).value,
          amount: (amountRes as { ok: true; value: number }).value,
          platform,
          status: (statusRes as { ok: true; value: string }).value,
          publish_url: publishUrl, notes,
        },
      });
    }
  }

  return Response.json({
    headers, mapping, missingRequired,
    rows: parsed,
    stats: { total: parsed.length, ok: okCount, withError: errCount },
  });
}
