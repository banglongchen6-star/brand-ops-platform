// 文章 CRUD —— 创建草稿（POST）
// GET 列表用前端 supabase 客户端直查，无需此处提供
import { getAdminClient } from "@/lib/supabaseAdmin";

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
