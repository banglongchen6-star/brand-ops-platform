// 方向字典 单条 PATCH（软删除走 is_active=false）
import { requireManager } from "@/lib/requireManager";
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = ["name", "sort_order", "is_active"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireManager();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) updates[k] = body[k];
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "无可更新字段" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin.from("schedule_directions").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
