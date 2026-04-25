// 文章 CRUD —— 列表（GET）+ 创建草稿（POST）
// GET 用 service role 绕过 RLS，避免列表为空诡异 bug
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET() {
  const admin = getAdminClient();
  const cols = "id,title,digest,status,current_step,source_topic,ai_topic_input,cover_image_url,word_count,scheduled_at,published_at,created_at,updated_at";
  const minCols = "id,title,digest,status,current_step,source_topic,cover_image_url,word_count,scheduled_at,published_at,created_at,updated_at";
  const first = await admin.from("wx_articles").select(cols).order("updated_at", { ascending: false }).limit(200);

  let articles: Record<string, unknown>[] = [];
  let degraded = false;
  if (first.error) {
    const r = await admin.from("wx_articles").select(minCols).order("updated_at", { ascending: false }).limit(200);
    if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
    articles = r.data ?? [];
    degraded = true;
  } else {
    articles = first.data ?? [];
  }

  // 兜底封面：从 wx_article_images 找一张已生成的（优先 position='cover'）
  if (articles.length > 0) {
    const ids = articles.map((a) => a.id as string);
    const { data: imgs } = await admin
      .from("wx_article_images")
      .select("article_id, position, image_url, status, created_at")
      .in("article_id", ids)
      .eq("status", "done")
      .order("created_at", { ascending: true });
    const coverByArticle = new Map<string, { url: string; isCover: boolean }>();
    for (const img of imgs ?? []) {
      const url = img.image_url as string;
      if (!url) continue;
      const articleId = img.article_id as string;
      const isCover = img.position === "cover";
      const existing = coverByArticle.get(articleId);
      if (!existing || (isCover && !existing.isCover)) {
        coverByArticle.set(articleId, { url, isCover });
      }
    }
    articles = articles.map((a) => ({
      ...a,
      cover_fallback_url: coverByArticle.get(a.id as string)?.url || "",
    }));
  }

  return Response.json({ articles, degraded });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("wx_articles")
    .insert({
      status: "draft",
      current_step: 1,
      ai_topic_input: body.ai_topic_input || "",
      title: body.title || "",
      created_by: body.created_by || null,
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}
