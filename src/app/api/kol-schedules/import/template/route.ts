// 排期导入 Excel 模板下载
// GET /api/kol-schedules/import/template
//
// 模板：表头 + 1 行示例 + 第 2 个 sheet「填写说明」

import { requireUser } from "@/lib/requireUser";
import { COLUMNS, STATUS_VALUES, STATUS_TO_LABEL } from "@/lib/scheduleExcel";
import * as XLSX from "xlsx";

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const headers = COLUMNS.map((c) => c.header + (c.required ? "*" : ""));
  const example = COLUMNS.map((c) => c.example);
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 18 },
    { wch: 6 },  { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 32 }, { wch: 24 },
  ];

  const help = [
    ["字段", "是否必填", "说明"],
    ["日期",      "必填", "支持 2026-05-01 / 2026/5/1 / 2026.5.1 / 5月1日"],
    ["类目",      "必填", "必须是字典里已有的类目名（如「基础（奖励）」）"],
    ["方向",      "选填", "弹唱/弹奏/鼓棒/生活/教学/亲子/种草 等，自由文本"],
    ["达人名",    "必填", "如果不在达人库会保留为文本"],
    ["层级",      "选填", "头部 / 中部 / 腰部 / 尾部 / 素人"],
    ["费用",      "必填", "数字，单位元；支持 ￥500 / 5,000 / 5万 等写法"],
    ["平台",      "选填", "抖音 / 小红书 / B站 / 全平台 等"],
    ["状态",      "选填", `留空默认「计划中」；可填：${STATUS_VALUES.map((v) => STATUS_TO_LABEL[v]).join(" / ")}`],
    ["发布链接",  "选填", "完整 URL"],
    ["备注",      "选填", "随便写"],
  ];
  const wsHelp = XLSX.utils.aoa_to_sheet(help);
  wsHelp["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "排期数据");
  XLSX.utils.book_append_sheet(wb, wsHelp, "填写说明");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = "达人排期导入模板.xlsx";
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
