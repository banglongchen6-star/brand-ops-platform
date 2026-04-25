// 文章 CRUD —— 列表（GET）+ 创建草稿（POST）
// GET 用 service role 绕过 RLS，避免列表为空诡异 bug
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET() {
  const admin = getAdminClient();
  const cols = "id,title,digest,status,current_step,source_topic,ai_topic_input,cover_image_url,word_count,scheduled_at,published_at,created_at,updated_at";
  const minCols = "id,title,digest,status,current_step,source_topic,cover_image_url,word_count,scheduled_at,published_at,created_at,updated_at";
  const first = await admin.from("wx_articles").select(cols).order("updated_at", { ascending: false }).limit(200);
  if (first.error) {
    // 列不存在时降级
    const r = await admin.from("wx_articles").select(minCols).order("updated_at", { ascending: false }).limit(200);
    if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
    return Response.json({ articles: r.data ?? [], degraded: true });
  }
  return Response.json({ articles: first.data ?? [] });
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
