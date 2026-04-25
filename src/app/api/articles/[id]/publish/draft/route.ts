// 推送到微信公众号草稿箱
// 流程：
//   1. 取文章 + 配图 + HTML
//   2. 上传封面到永久素材库 → 拿 thumb_media_id
//   3. 上传所有正文图片到 uploadimg → 拿微信 url，替换 HTML 里的 Supabase URL
//   4. 调 draft/add 创建草稿
//   5. 写回 wx_draft_media_id / status='ready' 到 wx_articles
import { getAdminClient } from "@/lib/supabaseAdmin";
import {
  uploadCoverMaterial, uploadContentImage, addDraft, WxApiError,
} from "@/lib/wxApiClient";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const configId: string | undefined = body.publish_config_id;

  const admin = getAdminClient();
  const { data: article, error: aErr } = await admin
    .from("wx_articles")
    .select("id, title, digest, author, content_html, cover_image_url, publish_config_id")
    .eq("id", id)
    .single();
  if (aErr || !article) return Response.json({ error: "文章不存在" }, { status: 404 });

  const finalConfigId = configId || article.publish_config_id;
  if (!finalConfigId) return Response.json({ error: "请先选择公众号" }, { status: 400 });

  if (!article.title) return Response.json({ error: "标题不能为空" }, { status: 400 });
  if (!article.content_html) return Response.json({ error: "请先在第 7 步生成预览 HTML" }, { status: 400 });
  if (!article.cover_image_url) return Response.json({ error: "请先在第 5 步设定封面" }, { status: 400 });

  try {
    // 1. 封面 → permanent material
    const cover = await uploadCoverMaterial(finalConfigId, article.cover_image_url);

    // 2. 正文图片 → uploadimg，替换 HTML 里的 URL
    let contentHtml = article.content_html as string;
    const imgRegex = /<img\s+[^>]*src="([^"]+)"/g;
    const seen = new Map<string, string>();
    const matches = [...contentHtml.matchAll(imgRegex)];

    for (const m of matches) {
      const src = m[1];
      if (src === article.cover_image_url) continue; // 封面已单独处理
      if (seen.has(src)) continue;
      try {
        const r = await uploadContentImage(finalConfigId, src);
        seen.set(src, r.url);
      } catch (e) {
        // 单张失败：保留原 URL，记录但不中断
        console.error("[publish] 正文图上传失败", src, e);
      }
    }
    seen.forEach((wxUrl, supaUrl) => {
      contentHtml = contentHtml.split(supaUrl).join(wxUrl);
    });

    // 3. addDraft
    const draft = await addDraft(finalConfigId, {
      title: article.title.slice(0, 64),       // 微信标题上限 64 字
      author: article.author || "",
      digest: (article.digest || "").slice(0, 120),
      content: contentHtml,
      thumb_media_id: cover.media_id,
    });

    // 4. 写回
    await admin.from("wx_articles").update({
      publish_config_id: finalConfigId,
      thumb_media_id: cover.media_id,
      wx_draft_media_id: draft.media_id,
      status: "ready",
      current_step: 8,
      publish_error: "",
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    return Response.json({
      ok: true,
      draft_media_id: draft.media_id,
      thumb_media_id: cover.media_id,
      uploaded_images: seen.size,
    });
  } catch (e) {
    const msg = e instanceof WxApiError ? e.message : (e instanceof Error ? e.message : String(e));
    await admin.from("wx_articles").update({
      status: "failed",
      publish_error: msg,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    return Response.json({ error: msg }, { status: 500 });
  }
}
