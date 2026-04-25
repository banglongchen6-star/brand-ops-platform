// Step 6 —— 根据正文生成 5 个标题候选 + 摘要
import { generateText } from "@/lib/aiClient";
import { buildTitlesPrompt, buildDigestPrompt } from "@/lib/wxArticlePrompts";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const content: string = body.content || "";
  const topic: string = body.topic || "";
  if (!content) return Response.json({ error: "缺少 content" }, { status: 400 });

  const titlePrompt = buildTitlesPrompt(content, topic);
  const digestPrompt = buildDigestPrompt(content);

  let titlesText: string, digestText: string;
  try {
    [titlesText, digestText] = await Promise.all([
      generateText({ ...titlePrompt, scope: "articles", maxTokens: 800 }),
      generateText({ ...digestPrompt, scope: "articles", maxTokens: 400 }),
    ]);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }

  const m = titlesText.match(/\[[\s\S]*\]/);
  let options: unknown = [];
  if (m) { try { options = JSON.parse(m[0]); } catch { /* keep [] */ } }

  const digest = digestText.trim().replace(/^["「『]|["」』]$/g, "").slice(0, 120);

  const admin = getAdminClient();
  await admin.from("wx_articles").update({
    ai_title_options: options,
    digest,
    current_step: 6,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  return Response.json({ options, digest });
}
