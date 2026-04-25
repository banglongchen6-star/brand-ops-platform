// 单个选题 PATCH / DELETE
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = [
  "title", "pain_point", "target_audience", "angle", "reference_notes",
  "tags", "status", "priority", "scheduled_at", "article_id",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) {
    if (k in body) updates[k] = body[k];
  }
  const admin = getAdminClient();
  const { error } = await admin.from("wx_topic_pool").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("wx_topic_pool").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
