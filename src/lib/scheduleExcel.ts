// 排期导入/导出共用的字段定义、状态映射、模板生成
//
// 列定义（顺序就是 Excel 列顺序）：
//   日期*  类目*  方向  达人名*  层级  费用*  平台  状态  发布链接  备注

export const COLUMNS = [
  { key: "schedule_date",     header: "日期",     required: true,  example: "2026-05-01" },
  { key: "category",          header: "类目",     required: true,  example: "基础（奖励）" },
  { key: "category_direction",header: "方向",     required: false, example: "弹唱" },
  { key: "kol_name",          header: "达人名",   required: true,  example: "万万也没想到" },
  { key: "tier",              header: "层级",     required: false, example: "尾部" },
  { key: "amount",            header: "费用",     required: true,  example: 500 },
  { key: "platform",          header: "平台",     required: false, example: "抖音" },
  { key: "status",            header: "状态",     required: false, example: "已结算" },
  { key: "publish_url",       header: "发布链接", required: false, example: "https://www.douyin.com/video/xxx" },
  { key: "notes",             header: "备注",     required: false, example: "随便写" },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];

// 状态：枚举 ↔ 中文 双向映射
export const STATUS_TO_LABEL: Record<string, string> = {
  planned: "计划中",
  contacted: "已联系",
  confirmed: "已确认",
  published: "已发布",
  settled: "已结算",
  cancelled: "已取消",
};
export const STATUS_VALUES = Object.keys(STATUS_TO_LABEL);

const LABEL_TO_STATUS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(STATUS_TO_LABEL)) {
    m[v] = k; m[k] = k; // 同时接受英文 enum
  }
  return m;
})();

export function parseStatus(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: "planned" };
  const s = String(raw).trim();
  const v = LABEL_TO_STATUS[s];
  if (!v) return { ok: false, error: `状态「${s}」不识别` };
  return { ok: true, value: v };
}

// 层级：5 个枚举 + 空
const TIER_VALUES = new Set(["头部", "中部", "腰部", "尾部", "素人"]);
export function parseTier(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: "" };
  const s = String(raw).trim();
  if (!TIER_VALUES.has(s)) return { ok: false, error: `层级「${s}」非法（应为头部/中部/腰部/尾部/素人）` };
  return { ok: true, value: s };
}

// 日期：支持 2026-05-01 / 2026/5/1 / 2026.5.1 / 5月1日 / Excel 序列号
export function parseDate(raw: unknown, contextYear?: number): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: false, error: "日期不能为空" };

  // Excel 数字序列号（1900 系基准）
  if (typeof raw === "number") {
    const epoch = Date.UTC(1899, 11, 30); // Excel 的 0 = 1899-12-30
    const ms = epoch + raw * 86400000;
    const d = new Date(ms);
    return { ok: true, value: d.toISOString().slice(0, 10) };
  }

  const s = String(raw).trim();
  // 中文 5月1日
  let m = s.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日$/);
  if (m) {
    const y = contextYear ?? new Date().getFullYear();
    return formatYMD(y, Number(m[1]), Number(m[2]));
  }
  m = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/);
  if (m) return formatYMD(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return formatYMD(Number(m[1]), Number(m[2]), Number(m[3]));

  // 兜底：用 Date 解
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return { ok: true, value: d.toISOString().slice(0, 10) };
  }
  return { ok: false, error: `日期「${s}」格式不识别` };
}

function formatYMD(y: number, m: number, d: number): { ok: true; value: string } | { ok: false; error: string } {
  if (m < 1 || m > 12 || d < 1 || d > 31) return { ok: false, error: `日期 ${y}-${m}-${d} 数值越界` };
  return { ok: true, value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

// 费用：支持 "￥500" / "500元" / "5,000" / "5万"
export function parseAmount(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: false, error: "费用不能为空" };
  if (typeof raw === "number") {
    if (raw < 0) return { ok: false, error: "费用不能为负" };
    return { ok: true, value: raw };
  }
  const s = String(raw).replace(/[¥￥,，\s元]/g, "").trim();
  const wanMatch = s.match(/^([\d.]+)\s*万$/);
  if (wanMatch) {
    const n = Number(wanMatch[1]) * 10000;
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: `费用「${s}」无效` };
    return { ok: true, value: n };
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: `费用「${raw}」无效` };
  return { ok: true, value: n };
}

// 用于 export：内部值 → 表格友好显示
export function statusLabel(v: string): string {
  return STATUS_TO_LABEL[v] || v;
}
