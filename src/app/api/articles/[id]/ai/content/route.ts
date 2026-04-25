// Step 4 —— 根据大纲生成正文 Markdown
import { generateText } from "@/lib/aiClient";
import { buildContentPrompt } from "@/lib/wxArticlePrompts";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const outline: unknown = body.outline;
  const topic: string = body.topic || "";
  const brandVoice: string = body.brand_voice || "";
  if (!outline || !topic) return Response.json({ error: "缺少 outline 或 topic" }, { status: 400 });

  const prompt = buildContentPrompt(outline, topic, brandVoice);
  let text: string;
  try {
    text = await generateText({ ...prompt, scope: "articles", maxTokens: 4000 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }
  const md = text.trim();
  const wordCount = md.replace(/\s+/g, "").length;

  const admin = getAdminClient();
  await admin.from("wx_articles").update({
    content_md: md,
    word_count: wordCount,
    reading_time_min: Math.max(1, Math.round(wordCount / 350)),
    current_step: 4,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  return Response.json({ content_md: md, word_count: wordCount });
}
