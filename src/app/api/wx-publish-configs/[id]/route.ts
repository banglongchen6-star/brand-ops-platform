// 单个公众号配置 PATCH / DELETE
import { getAdminClient } from "@/lib/supabaseAdmin";
import { encryptKey } from "@/lib/aiCrypto";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.name === "string")            updates.name = body.name.trim();
  if (typeof body.app_id === "string")          updates.app_id = body.app_id.trim();
  if (typeof body.account_type === "string")    updates.account_type = body.account_type;
  if (typeof body.default_author === "string")  updates.default_author = body.default_author;
  if (typeof body.notes === "string")           updates.notes = body.notes;
  if (typeof body.enabled === "boolean")        updates.enabled = body.enabled;
  if (typeof body.app_secret === "string" && body.app_secret.trim()) {
    updates.app_secret_enc = encryptKey(body.app_secret.trim());
    // secret 变了，旧 token 作废
    updates.access_token = "";
    updates.token_expires_at = null;
  }

  const admin = getAdminClient();
  const { error } = await admin.from("wx_publish_configs").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("wx_publish_configs").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
