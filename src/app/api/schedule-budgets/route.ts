// 月度规划表 —— 把 schedule_budgets（计划层）+ kol_schedules（执行层） 拼起来返回
//
// 重要：本表按「达人类型」分组（即 schedule_directions 字典）
// 历史上 schedule_budgets.category 列原本存类目名，重构后改存"达人类型"名称，
// 字段名保持不变（DB UNIQUE 约束 (year, month, category) 仍然有效）。
// 旧的「类目」预算记录（如 "基础（奖励）"）会被忽略，不在这张表里展示。
//
// GET  /api/schedule-budgets?year=&month=
// PUT  /api/schedule-budgets  (manager+)
//   body: { year, month, category, budgetAmount, targetCount?, platform?,
//           requirements?, functionDisplay?, notes? }
//   注意 body.category 实际是"达人类型"名（保留旧 key 名兼容性）

import { requireUser } from "@/lib/requireUser";
import { requireManager } from "@/lib/requireManager";
import { getAdminClient } from "@/lib/supabaseAdmin";

interface BudgetRow {
  categoryId: string | null;        // 实际是 schedule_directions.id
  category: string;                  // 达人类型名（key）
  shortName: string;
  budgetAmount: number;
  targetCount: number | null;
  platform: string;
  functionDisplay: string;
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

  // 1. 达人类型字典（active）—— 规划表的行底
  const { data: dirRows, error: dErr } = await admin
    .from("schedule_directions")
    .select("id, name, sort_order, is_active")
    .order("sort_order", { ascending: true });
  if (dErr) return Response.json({ error: dErr.message }, { status: 500 });
  const activeDirs = (dirRows ?? []).filter((d) => d.is_active);

  // 2. 当月预算行（按达人类型 key）
  const dirNameSet = new Set(activeDirs.map((d) => d.name as string));
  const { data: budgetRows, error: bErr } = await admin
    .from("schedule_budgets")
    .select("category, budget_amount, target_count, platform, requirements, function_display, notes")
    .eq("year", year)
    .eq("month", month);
  if (bErr) return Response.json({ error: bErr.message }, { status: 500 });
  const budgetByName = new Map<string, typeof budgetRows extends (infer T)[] | null ? T : never>();
  for (const b of budgetRows ?? []) {
    const k = b.category as string;
    if (dirNameSet.has(k)) budgetByName.set(k, b); // 只取属于"达人类型"的预算行，过滤掉历史类目记录
  }

  // 3. 当月排期实际：GROUP BY category_direction（即"达人类型"）
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const { data: schedRows, error: sErr } = await admin
    .from("kol_schedules")
    .select("category_direction, amount, status")
    .gte("schedule_date", ymd(monthStart))
    .lt("schedule_date", ymd(nextMonth));
  if (sErr) return Response.json({ error: sErr.message }, { status: 500 });

  const actualByDir = new Map<string, { spent: number; count: number }>();
  for (const s of schedRows ?? []) {
    const d = (s.category_direction as string) || "";
    if (!d) continue;
    if ((s.status as string) === "cancelled") continue;
    const entry = actualByDir.get(d) ?? { spent: 0, count: 0 };
    entry.spent += Number(s.amount) || 0;
    entry.count += 1;
    actualByDir.set(d, entry);
  }

  // 4. 拼接：以字典 active 行为底
  const rows: BudgetRow[] = [];
  const totals = { budget: 0, target: 0, spent: 0, count: 0 };

  for (const d of activeDirs) {
    const name = d.name as string;
    const b = budgetByName.get(name);
    const actual = actualByDir.get(name) ?? { spent: 0, count: 0 };
    const budgetAmount = Number(b?.budget_amount) || 0;
    const targetCount = b?.target_count == null ? null : Number(b.target_count);
    const platform = (b?.platform as string) || "";
    const requirements = (b?.requirements as string) || "";
    const functionDisplay = (b?.function_display as string) || "";
    rows.push({
      categoryId: d.id as string,
      category: name,
      shortName: name,
      budgetAmount,
      targetCount,
      platform,
      functionDisplay,
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

  // 字典里没有但有数据的达人类型（兜底，方便用户发现孤儿数据）
  for (const [name, actual] of actualByDir.entries()) {
    if (!dirNameSet.has(name)) {
      rows.push({
        categoryId: null,
        category: name, shortName: name,
        budgetAmount: 0, targetCount: null, platform: "",
        functionDisplay: "", requirements: "",
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
  const category = String(body.category ?? "").trim();   // 实际是达人类型名
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ error: "year/month 非法" }, { status: 400 });
  }
  if (!category) return Response.json({ error: "达人类型不能为空" }, { status: 400 });

  // 校验达人类型存在且 active
  const admin = getAdminClient();
  const { data: dir } = await admin
    .from("schedule_directions")
    .select("name, is_active").eq("name", category).maybeSingle();
  if (!dir || dir.is_active === false) {
    return Response.json({ error: "达人类型不在字典里或已停用" }, { status: 400 });
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
  if ("platform" in body)        patch.platform = String(body.platform ?? "").trim();
  if ("requirements" in body)    patch.requirements = String(body.requirements ?? "").trim();
  if ("functionDisplay" in body) patch.function_display = String(body.functionDisplay ?? "").trim();
  if ("notes" in body)           patch.notes = String(body.notes ?? "").trim();

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "没有要更新的字段" }, { status: 400 });
  }

  // 读现存行，patch 合并 upsert
  const { data: existing } = await admin
    .from("schedule_budgets")
    .select("*")
    .eq("year", year).eq("month", month).eq("category", category)
    .maybeSingle();

  const merged: Record<string, unknown> = {
    year, month, category,
    budget_amount:    patch.budget_amount ?? existing?.budget_amount ?? 0,
    target_count:     "target_count" in patch ? patch.target_count : existing?.target_count ?? null,
    platform:         patch.platform ?? existing?.platform ?? "",
    requirements:     patch.requirements ?? existing?.requirements ?? "",
    function_display: patch.function_display ?? existing?.function_display ?? "",
    notes:            patch.notes ?? existing?.notes ?? "",
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
