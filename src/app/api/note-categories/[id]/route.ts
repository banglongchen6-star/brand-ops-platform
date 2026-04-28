// 单板块 PATCH / DELETE
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = ["label", "icon", "sort_order", "is_archived"] as const;

async function ensureOwner(id: string, userId: string) {
  const admin = getAdminClient();
  const { data } = await admin.from("note_categories").select("owner_id").eq("id", id).maybeSingle();
  return data?.owner_id === userId;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!(await ensureOwner(id, guard.userId))) {
    return Response.json({ error: "无权限" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) updates[k] = body[k];
  if (typeof updates.label === "string") {
    updates.label = (updates.label as string).trim().slice(0, 30);
    if (!updates.label) return Response.json({ error: "板块名不能为空" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin.from("note_categories").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  if (!(await ensureOwner(id, guard.userId))) {
    return Response.json({ error: "无权限" }, { status: 403 });
  }
  const admin = getAdminClient();
  // 板块下笔记的 category_id 通过 ON DELETE SET NULL 自动清空
  const { error } = await admin.from("note_categories").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
