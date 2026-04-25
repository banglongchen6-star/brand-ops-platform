// 单张图编辑：设为封面 / 修改提示词
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; imgId: string }> }) {
  const { id, imgId } = await params;
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.prompt_zh === "string") updates.prompt_zh = body.prompt_zh;

  // 设为封面：把这张写到 wx_articles.cover_image_url
  if (body.set_as_cover === true) {
    const { data: img } = await admin
      .from("wx_article_images").select("image_url, status").eq("id", imgId).eq("article_id", id).single();
    if (!img || img.status !== "done" || !img.image_url) {
      return Response.json({ error: "该图未生成完成，无法设为封面" }, { status: 400 });
    }
    await admin.from("wx_articles").update({
      cover_image_url: img.image_url,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
  }

  if (Object.keys(updates).length > 1) {
    const { error } = await admin.from("wx_article_images").update(updates).eq("id", imgId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; imgId: string }> }) {
  const { id, imgId } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("wx_article_images").delete().eq("id", imgId).eq("article_id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
