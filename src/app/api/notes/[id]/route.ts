// 单条笔记 GET / PATCH / DELETE —— 严格校验 owner_id 防越权
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = ["title", "content_md", "date", "tags", "is_archived"] as const;

async function ensureOwner(id: string, userId: string) {
  const admin = getAdminClient();
  const { data } = await admin.from("personal_notes").select("owner_id").eq("id", id).maybeSingle();
  return data?.owner_id === userId;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = getAdminClient();
  const { data, error } = await admin.from("personal_notes")
    .select("*").eq("id", id).eq("owner_id", guard.userId).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "笔记不存在或无权限" }, { status: 404 });
  return Response.json({ note: data });
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

  const admin = getAdminClient();
  const { error } = await admin.from("personal_notes").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!(await ensureOwner(id, guard.userId))) {
    return Response.json({ error: "无权限" }, { status: 403 });
  }
  const admin = getAdminClient();
  const { error } = await admin.from("personal_notes").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
