// 复制上月预算 —— 把上月所有 schedule_budgets 行复制到当月（已存在的不覆盖）
//
// POST /api/schedule-budgets/copy-from-last-month
//   body: { year, month }   ← 目标月份
//   返回 { copied, skipped }
//
// 跳过规则：(year, month, category) 已经有记录的行不动；只补缺失的类目
import { requireManager } from "@/lib/requireManager";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const guard = await requireManager();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ error: "year/month 非法" }, { status: 400 });
  }

  // 计算上月
  let prevY = year, prevM = month - 1;
  if (prevM < 1) { prevM = 12; prevY -= 1; }

  const admin = getAdminClient();
  const { data: prev, error } = await admin
    .from("schedule_budgets")
    .select("category, budget_amount, target_count, platform, requirements, notes")
    .eq("year", prevY).eq("month", prevM);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!prev || prev.length === 0) {
    return Response.json({ copied: 0, skipped: 0, message: `上月（${prevY}-${prevM}）没有预算可复制` });
  }

  // 已存在的目标月份行
  const { data: existing } = await admin
    .from("schedule_budgets")
    .select("category")
    .eq("year", year).eq("month", month);
  const existingCats = new Set((existing ?? []).map((r) => r.category as string));

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const row of prev) {
    const cat = row.category as string;
    if (existingCats.has(cat)) { skipped++; continue; }
    toInsert.push({
      year, month, category: cat,
      budget_amount: row.budget_amount,
      target_count: row.target_count,
      platform: row.platform,
      requirements: row.requirements,
      notes: row.notes,
      created_by: guard.userId,
      updated_by: guard.userId,
    });
  }

  if (toInsert.length === 0) {
    return Response.json({ copied: 0, skipped });
  }

  const { error: insErr } = await admin.from("schedule_budgets").insert(toInsert);
  if (insErr) return Response.json({ error: insErr.message }, { status: 500 });
  return Response.json({ copied: toInsert.length, skipped });
}
