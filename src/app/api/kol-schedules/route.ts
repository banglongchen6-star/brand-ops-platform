// 排期列表（按月度，组织成 weeks 结构）+ 新建
//
// GET /api/kol-schedules?year=2026&month=5
//   返回 { year, month, weeks:[{weekNum, days:[{date,weekday,items[],isCurrentMonth}], weekTotal}], monthTotal, totalCount }
//
// POST /api/kol-schedules
//   body: { schedule_date, kol_name, category, ... }

import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

const TIER_VALUES = ["头部", "中部", "腰部", "尾部", "素人", ""] as const;
const STATUS_VALUES = [
  "planned", "contacted", "confirmed", "published", "settled", "cancelled",
] as const;

interface ScheduleRow {
  id: string;
  schedule_date: string;
  category: string;
  category_direction: string | null;
  tier: string | null;
  kol_name: string;
  kol_id: string | null;
  amount: number | string;
  platform: string | null;
  status: string;
  publish_url: string | null;
  publish_date: string | null;
  notes: string | null;
}

interface ItemDTO {
  id: string;
  kolName: string;
  kolId: string | null;
  amount: number;
  category: string;
  categoryShort: string;
  categoryDirection: string;
  tier: string;
  platform: string;
  status: string;
  publishUrl: string;
  publishDate: string | null;
  notes: string;
}

function parseInt2(v: string | null, def: number): number {
  const n = Number(v);
  return Number.isInteger(n) ? n : def;
}

// 周一 = 1, 周日 = 7（ISO weekday）
function isoWeekday(d: Date): number {
  const w = d.getUTCDay();
  return w === 0 ? 7 : w;
}

// ISO 8601 周数
function isoWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const today = new Date();
  const year = parseInt2(searchParams.get("year"), today.getFullYear());
  const month = parseInt2(searchParams.get("month"), today.getMonth() + 1);
  if (month < 1 || month > 12) {
    return Response.json({ error: "month 范围 1-12" }, { status: 400 });
  }

  // 月历格子范围：从该月 1 号所在周的周一开始，到 5 周后（即 35 天）
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const wd = isoWeekday(firstOfMonth);
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - (wd - 1));
  const gridEnd = new Date(gridStart);
  gridEnd.setUTCDate(gridStart.getUTCDate() + 35); // 5 周 × 7 天

  // 可选筛选：categories=a,b  tiers=头部,腰部
  const categories = (searchParams.get("categories") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const tiers = (searchParams.get("tiers") || "").split(",").map((s) => s.trim()).filter(Boolean);

  const admin = getAdminClient();
  let qb = admin
    .from("kol_schedules")
    .select("id, schedule_date, category, category_direction, tier, kol_name, kol_id, amount, platform, status, publish_url, publish_date, notes")
    .gte("schedule_date", ymd(gridStart))
    .lt("schedule_date", ymd(gridEnd))
    .order("schedule_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (categories.length) qb = qb.in("category", categories);
  if (tiers.length) qb = qb.in("tier", tiers);
  const { data: rows, error } = await qb;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 拉一次类目字典做 short_name 映射
  const { data: catRows } = await admin
    .from("schedule_categories").select("name, short_name");
  const shortNameByName = new Map<string, string>();
  for (const c of catRows ?? []) {
    shortNameByName.set(c.name as string, (c.short_name as string) || (c.name as string));
  }

  const itemsByDate = new Map<string, ItemDTO[]>();
  let monthTotal = 0;
  let totalCount = 0;
  for (const r of (rows ?? []) as ScheduleRow[]) {
    const dto: ItemDTO = {
      id: r.id,
      kolName: r.kol_name,
      kolId: r.kol_id,
      amount: Number(r.amount) || 0,
      category: r.category,
      categoryShort: shortNameByName.get(r.category) || r.category,
      categoryDirection: r.category_direction || "",
      tier: r.tier || "",
      platform: r.platform || "",
      status: r.status,
      publishUrl: r.publish_url || "",
      publishDate: r.publish_date,
      notes: r.notes || "",
    };
    if (!itemsByDate.has(r.schedule_date)) itemsByDate.set(r.schedule_date, []);
    itemsByDate.get(r.schedule_date)!.push(dto);

    const d = new Date(r.schedule_date + "T00:00:00Z");
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1) {
      monthTotal += dto.amount;
      totalCount++;
    }
  }

  // 组织成 5 周
  const weeks: Array<{
    weekNum: number;
    days: Array<{ date: string; weekday: number; items: ItemDTO[]; isCurrentMonth: boolean }>;
    weekTotal: number;
  }> = [];

  for (let w = 0; w < 5; w++) {
    const days: Array<{ date: string; weekday: number; items: ItemDTO[]; isCurrentMonth: boolean }> = [];
    let weekTotal = 0;
    let weekNum = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart);
      day.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      const dateStr = ymd(day);
      const items = itemsByDate.get(dateStr) ?? [];
      const isCurrentMonth = day.getUTCMonth() === month - 1 && day.getUTCFullYear() === year;
      days.push({ date: dateStr, weekday: isoWeekday(day), items, isCurrentMonth });
      if (isCurrentMonth) {
        for (const it of items) weekTotal += it.amount;
      }
      if (d === 3) weekNum = isoWeekNum(day); // 取本周周四来定 ISO 周
    }
    weeks.push({ weekNum, days, weekTotal });
  }

  return Response.json({ year, month, weeks, monthTotal, totalCount });
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const schedule_date = String(body.schedule_date ?? "").trim();
  const kol_name = String(body.kol_name ?? "").trim();
  // category 已废弃为可选；DB 字段 NOT NULL，传空字符串落库
  const category = String(body.category ?? "").trim();
  if (!schedule_date) return Response.json({ error: "schedule_date 不能为空" }, { status: 400 });
  if (!kol_name) return Response.json({ error: "kol_name 不能为空" }, { status: 400 });

  const tier = String(body.tier ?? "");
  if (!TIER_VALUES.includes(tier as typeof TIER_VALUES[number])) {
    return Response.json({ error: "tier 非法" }, { status: 400 });
  }
  const status = String(body.status ?? "planned");
  if (!STATUS_VALUES.includes(status as typeof STATUS_VALUES[number])) {
    return Response.json({ error: "status 非法" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return Response.json({ error: "amount 必须为非负数字" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("kol_schedules")
    .insert({
      schedule_date,
      category,
      category_direction: String(body.category_direction ?? "").trim(),
      tier,
      kol_name,
      kol_id: body.kol_id || null,
      amount,
      platform: String(body.platform ?? "").trim(),
      status,
      publish_url: String(body.publish_url ?? "").trim(),
      publish_date: body.publish_date || null,
      notes: String(body.notes ?? "").trim(),
      created_by: guard.userId,
      updated_by: guard.userId,
    })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ item: data });
}
