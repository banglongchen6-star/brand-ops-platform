// 复制文章 —— 全字段克隆 + 配图也复制（图床 URL 直接共用）
// 重置发布状态，标题加（副本）后缀
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();

  const { data: orig, error: getErr } = await admin
    .from("wx_articles").select("*").eq("id", id).single();
  if (getErr || !orig) return Response.json({ error: "原文不存在" }, { status: 404 });

  // 去掉不应继承的字段
  const skip = new Set(["id", "created_at", "updated_at"]);
  const newRow: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(orig)) {
    if (!skip.has(k)) newRow[k] = v;
  }
  // 重置发布相关
  newRow.title = orig.title ? `${orig.title}（副本）` : "";
  newRow.status = "draft";
  newRow.wx_draft_media_id = "";
  newRow.thumb_media_id = "";
  newRow.scheduled_at = null;
  newRow.published_at = null;
  newRow.publish_error = "";

  const { data: created, error } = await admin
    .from("wx_articles").insert(newRow).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 复制配图（图床 URL 共用，不再上传）
  const { data: imgs } = await admin
    .from("wx_article_images").select("*").eq("article_id", id);
  if (imgs && imgs.length > 0) {
    const newImgs = imgs.map((img) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(img)) {
        if (k === "id" || k === "created_at" || k === "updated_at") continue;
        out[k] = v;
      }
      out.article_id = created.id;
      out.task_id = ""; // 旧任务 ID 无意义
      out.wx_media_id = ""; // 微信 media 绑定原文章
      return out;
    });
    await admin.from("wx_article_images").insert(newImgs);
  }

  return Response.json({ id: created.id });
}
