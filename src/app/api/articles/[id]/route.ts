// 文章详情 —— GET 加载、PATCH 增量保存、DELETE 删除
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE_FIELDS = [
  "publish_config_id", "status", "current_step",
  "ai_topic_input", "source_trend_id", "source_topic", "source_angle",
  "ai_outline", "content_md", "content_html",
  "title", "ai_title_options", "digest", "author",
  "cover_image_url", "thumb_media_id",
  "scheduled_at",
  "word_count", "reading_time_min",
] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { data, error } = await admin.from("wx_articles").select("*").eq("id", id).single();
  if (error) return Response.json({ error: error.message }, { status: 404 });
  return Response.json({ article: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE_FIELDS) {
    if (k in body) updates[k] = body[k];
  }
  // 自动算字数
  if (typeof body.content_md === "string") {
    updates.word_count = body.content_md.replace(/\s+/g, "").length;
    updates.reading_time_min = Math.max(1, Math.round(((updates.word_count as number) || 0) / 350));
  }
  const admin = getAdminClient();
  const { error } = await admin.from("wx_articles").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("wx_articles").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
