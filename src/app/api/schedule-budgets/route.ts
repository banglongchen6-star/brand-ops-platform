// 月度规划表 —— 把 schedule_budgets（计划层）和 kol_schedules（执行层）拼起来返回
//
// GET  /api/schedule-budgets?year=&month=
//   返回 { year, month, rows:[{category, budgetAmount, targetCount, platform,
//          requirements, actualSpent, actualCount, gap}], total:{...} }
//   逻辑：
//     1. 拿字典里全部 active 类目（按 sort_order）作为行底
//     2. 用 schedule_budgets 同月的行覆盖预算字段（没设的字段保持 null/0）
//     3. 按 category GROUP BY 算 actualSpent / actualCount
//     4. gap = budgetAmount - actualSpent（可负，前端按需展示）
//
// PUT  /api/schedule-budgets  (manager+)
//   body: { year, month, category, budgetAmount, targetCount?, platform?,
//           requirements?, notes? }
//   按 (year, month, category) UNIQUE KEY upsert

import { requireUser } from "@/lib/requireUser";
import { requireManager } from "@/lib/requireManager";
import { getAdminClient } from "@/lib/supabaseAdmin";

interface BudgetRow {
  categoryId: string | null;
  category: string;
  shortName: string;
  budgetAmount: number;
  targetCount: number | null;
  platform: string;
  requirements: string;
  actualSpent: number;
  actualCount: number;
  gap: number;
  hasBudgetRecord: boolean;
}

function parseInt2(v: string | null, def: number): number {
  const n = Number(v);
  return Number.isInteger(n) ? n : def;
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

  const admin = getAdminClient();

  // 1. 类目字典（active）
  const { data: catRows, error: catErr } = await admin
    .from("schedule_categories")
    .select("id, name, short_name, default_platform, default_requirements, sort_order, is_active")
    .order("sort_order", { ascending: true });
  if (catErr) return Response.json({ error: catErr.message }, { status: 500 });
  const activeCats = (catRows ?? []).filter((c) => c.is_active);

  // 2. 当月预算行
  const { data: budgetRows, error: bErr } = await admin
    .from("schedule_budgets")
    .select("category, budget_amount, target_count, platform, requirements, notes")
    .eq("year", year)
    .eq("month", month);
  if (bErr) return Response.json({ error: bErr.message }, { status: 500 });
  const budgetByCat = new Map<string, typeof budgetRows extends (infer T)[] | null ? T : never>();
  for (const b of budgetRows ?? []) budgetByCat.set(b.category as string, b);

  // 3. 当月排期实际
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const { data: schedRows, error: sErr } = await admin
    .from("kol_schedules")
    .select("category, amount, status")
    .gte("schedule_date", ymd(monthStart))
    .lt("schedule_date", ymd(nextMonth));
  if (sErr) return Response.json({ error: sErr.message }, { status: 500 });

  const actualByCat = new Map<string, { spent: number; count: number }>();
  for (const s of schedRows ?? []) {
    const c = (s.category as string) || "";
    if (!c) continue;
    if ((s.status as string) === "cancelled") continue; // 取消的不计
    const entry = actualByCat.get(c) ?? { spent: 0, count: 0 };
    entry.spent += Number(s.amount) || 0;
    entry.count += 1;
    actualByCat.set(c, entry);
  }

  // 4. 拼接（以字典 active 行为底；如果有"已删除/停用"类目里有数据，也补一行尾部展示）
  const rows: BudgetRow[] = [];
  const totals = { budget: 0, target: 0, spent: 0, count: 0 };

  for (const c of activeCats) {
    const b = budgetByCat.get(c.name as string);
    const actual = actualByCat.get(c.name as string) ?? { spent: 0, count: 0 };
    const budgetAmount = Number(b?.budget_amount) || 0;
    const targetCount = b?.target_count == null ? null : Number(b.target_count);
    const platform = (b?.platform as string) || (c.default_platform as string) || "";
    const requirements = (b?.requirements as string) || (c.default_requirements as string) || "";
    rows.push({
      categoryId: c.id as string,
      category: c.name as string,
      shortName: (c.short_name as string) || (c.name as string),
      budgetAmount,
      targetCount,
      platform,
      requirements,
      actualSpent: actual.spent,
      actualCount: actual.count,
      gap: budgetAmount - actual.spent,
      hasBudgetRecord: !!b,
    });
    totals.budget += budgetAmount;
    totals.target += targetCount ?? 0;
    totals.spent += actual.spent;
    totals.count += actual.count;
  }

  // 字典里没有但有数据的类目（一般不该出现，给个兜底）
  const knownNames = new Set(rows.map((r) => r.category));
  for (const [cat, actual] of actualByCat.entries()) {
    if (!knownNames.has(cat)) {
      rows.push({
        categoryId: null,
        category: cat, shortName: cat,
        budgetAmount: 0, targetCount: null, platform: "", requirements: "",
        actualSpent: actual.spent, actualCount: actual.count,
        gap: -actual.spent, hasBudgetRecord: false,
      });
      totals.spent += actual.spent;
      totals.count += actual.count;
    }
  }

  return Response.json({
    year, month, rows,
    total: {
      budget: totals.budget,
      target: totals.target,
      spent: totals.spent,
      count: totals.count,
      gap: totals.budget - totals.spent,
    },
  });
}

export async function PUT(req: Request) {
  const guard = await requireManager();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const year = Number(body.year);
  const month = Number(body.month);
  const category = String(body.category ?? "").trim();
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ error: "year/month 非法" }, { status: 400 });
  }
  if (!category) return Response.json({ error: "category 不能为空" }, { status: 400 });

  const admin = getAdminClient();
  const { data: cat } = await admin
    .from("schedule_categories")
    .select("name, is_active").eq("name", category).maybeSingle();
  if (!cat || cat.is_active === false) {
    return Response.json({ error: "类目不在字典里或已停用" }, { status: 400 });
  }

  // 部分更新：只校验本次提交的字段；缺失字段从已有记录里读出并保留
  const patch: Record<string, unknown> = {};

  if ("budgetAmount" in body) {
    const v = body.budgetAmount === "" || body.budgetAmount == null ? 0 : Number(body.budgetAmount);
    if (!Number.isFinite(v) || v < 0) {
      return Response.json({ error: "预算必须为非负数字" }, { status: 400 });
    }
    patch.budget_amount = v;
  }
  if ("targetCount" in body) {
    if (body.targetCount === "" || body.targetCount == null) {
      patch.target_count = null;
    } else {
      const n = Number(body.targetCount);
      if (!Number.isInteger(n) || n < 0) {
        return Response.json({ error: "目标条数必须为非负整数" }, { status: 400 });
      }
      patch.target_count = n;
    }
  }
  if ("platform" in body)     patch.platform = String(body.platform ?? "").trim();
  if ("requirements" in body) patch.requirements = String(body.requirements ?? "").trim();
  if ("notes" in body)        patch.notes = String(body.notes ?? "").trim();

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "没有要更新的字段" }, { status: 400 });
  }

  // 读现存行（可能没有），把 patch 合并上去 upsert
  const { data: existing } = await admin
    .from("schedule_budgets")
    .select("*")
    .eq("year", year).eq("month", month).eq("category", category)
    .maybeSingle();

  const merged: Record<string, unknown> = {
    year, month, category,
    budget_amount: patch.budget_amount ?? existing?.budget_amount ?? 0,
    target_count:  "target_count" in patch ? patch.target_count : existing?.target_count ?? null,
    platform:      patch.platform ?? existing?.platform ?? "",
    requirements:  patch.requirements ?? existing?.requirements ?? "",
    notes:         patch.notes ?? existing?.notes ?? "",
    updated_by: guard.userId,
    updated_at: new Date().toISOString(),
  };
  if (!existing) merged.created_by = guard.userId;

  const { data, error } = await admin
    .from("schedule_budgets")
    .upsert(merged, { onConflict: "year,month,category" })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ item: data });
}
