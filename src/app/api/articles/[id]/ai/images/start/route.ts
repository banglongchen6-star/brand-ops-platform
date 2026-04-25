// Step 5 启动 —— 用 Qwen 生成 4 个图片提示词，再向 DashScope 提交 4 个异步任务
// 整个过程目标 <8s，避开 Vercel 函数超时
import { generateText } from "@/lib/aiClient";
import { buildImagesPrompt } from "@/lib/wxArticlePrompts";
import { submitImageTask } from "@/lib/wxImageGen";
import { getAdminClient } from "@/lib/supabaseAdmin";

interface PromptItem { position: string; aspect: string; prompt_zh: string; prompt_en?: string }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const admin = getAdminClient();
  const { data: article } = await admin
    .from("wx_articles")
    .select("source_topic, content_md")
    .eq("id", id)
    .single();
  if (!article) return Response.json({ error: "文章不存在" }, { status: 404 });
  if (!article.content_md) return Response.json({ error: "请先在第 4 步生成正文" }, { status: 400 });

  // 1. 生成 4 个提示词
  const prompt = buildImagesPrompt(article.source_topic || body.topic || "", article.content_md);
  let text: string;
  try {
    text = await generateText({ ...prompt, scope: "content", maxTokens: 2000 });
  } catch (e) {
    return Response.json({ error: "提示词生成失败：" + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return Response.json({ error: "AI 返回格式异常", raw: text.slice(0, 300) }, { status: 500 });
  let items: PromptItem[];
  try { items = JSON.parse(m[0]) as PromptItem[]; }
  catch { return Response.json({ error: "JSON 解析失败", raw: text.slice(0, 300) }, { status: 500 }); }

  // 2. 清掉旧的待生成行，重置
  await admin.from("wx_article_images").delete().eq("article_id", id);

  // 3. 并行提交 4 个 DashScope 任务
  const settled = await Promise.allSettled(
    items.map(async (it) => {
      const { task_id } = await submitImageTask(it.prompt_zh, it.aspect || "1:1");
      return { ...it, task_id };
    }),
  );

  const rows = settled.map((s, idx) => {
    const it = items[idx];
    if (s.status === "fulfilled") {
      return {
        article_id: id,
        position: it.position,
        prompt_zh: it.prompt_zh,
        prompt_en: it.prompt_en || "",
        aspect: it.aspect,
        task_id: s.value.task_id,
        status: "generating",
      };
    }
    return {
      article_id: id,
      position: it.position,
      prompt_zh: it.prompt_zh,
      prompt_en: it.prompt_en || "",
      aspect: it.aspect,
      status: "failed",
      error: s.reason instanceof Error ? s.reason.message : String(s.reason),
    };
  });

  const { data: inserted, error } = await admin
    .from("wx_article_images")
    .insert(rows)
    .select("*");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 顺手把 article 推到 step 5
  await admin.from("wx_articles").update({ current_step: 5, updated_at: new Date().toISOString() }).eq("id", id);

  return Response.json({ images: inserted });
}
