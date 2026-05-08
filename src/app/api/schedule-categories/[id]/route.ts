// 类目字典 单条 PATCH / DELETE（软删除）
import { requireManager } from "@/lib/requireManager";
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = [
  "name", "short_name", "default_platform", "default_directions",
  "default_requirements", "sort_order", "is_active",
] as const;

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
  const { error } = await admin.from("schedule_categories").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// 软删除：is_active = false（已被排期使用的类目不能真删，避免数据悬空）
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireManager();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = getAdminClient();
  const { error } = await admin
    .from("schedule_categories")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
