// 单个竞品详情 GET / PATCH / DELETE
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = [
  "name", "brand", "platform", "shop_url", "category", "brand_position",
  "followers", "priority", "is_self", "is_archived", "notes",
] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { data, error } = await admin.from("competitors").select("*").eq("id", id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "竞品不存在" }, { status: 404 });
  return Response.json({ competitor: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) updates[k] = body[k];

  const admin = getAdminClient();
  const { error } = await admin.from("competitors").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("competitors").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
