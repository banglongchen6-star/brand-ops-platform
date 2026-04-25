// 把选题"采用"为新文章草稿 —— 创建 wx_articles 行 + 标记 topic 为 used
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();

  const { data: topic, error: tErr } = await admin
    .from("wx_topic_pool").select("*").eq("id", id).single();
  if (tErr || !topic) return Response.json({ error: "选题不存在" }, { status: 404 });

  // 创建文章草稿，预填选题信息
  const { data: article, error: aErr } = await admin.from("wx_articles").insert({
    status: "draft",
    current_step: 2, // 直接跳到第 2 步（选题已确定）
    source_topic: topic.title || "",
    source_angle: topic.angle || "",
    ai_topic_input: [topic.pain_point, topic.target_audience].filter(Boolean).join(" / "),
  }).select("id").single();
  if (aErr || !article) return Response.json({ error: aErr?.message || "创建文章失败" }, { status: 500 });

  // 关联回选题
  await admin.from("wx_topic_pool").update({
    status: "used",
    article_id: article.id,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  return Response.json({ article_id: article.id });
}
