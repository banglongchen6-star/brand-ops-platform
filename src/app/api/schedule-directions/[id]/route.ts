// 方向字典 单条 PATCH（软删除走 is_active=false）
// 可选 body.cascadeDeleteSchedules=true：连带删除所有 category_direction=该名 的 kol_schedules
import { requireManager } from "@/lib/requireManager";
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = ["name", "sort_order", "is_active"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireManager();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const cascade = body.cascadeDeleteSchedules === true;

  const updates: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) updates[k] = body[k];

  const admin = getAdminClient();

  // 先做 cascade —— 拿到 name 再去删 kol_schedules + schedule_budgets
  let deletedCount = 0;
  let deletedBudgetCount = 0;
  if (cascade) {
    const { data: dir } = await admin
      .from("schedule_directions").select("name").eq("id", id).maybeSingle();
    if (dir?.name) {
      const { count, error: delErr } = await admin
        .from("kol_schedules")
        .delete({ count: "exact" })
        .eq("category_direction", dir.name);
      if (delErr) return Response.json({ error: "删除排期数据失败：" + delErr.message }, { status: 500 });
      deletedCount = count ?? 0;

      const { count: bCount, error: bErr } = await admin
        .from("schedule_budgets")
        .delete({ count: "exact" })
        .eq("category", dir.name);
      if (bErr) return Response.json({ error: "删除预算配置失败：" + bErr.message }, { status: 500 });
      deletedBudgetCount = bCount ?? 0;
    }
  }

  if (Object.keys(updates).length === 0 && !cascade) {
    return Response.json({ error: "无可更新字段" }, { status: 400 });
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from("schedule_directions").update(updates).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, deletedSchedules: deletedCount, deletedBudgets: deletedBudgetCount });
}
