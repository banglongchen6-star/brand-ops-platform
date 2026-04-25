// Step 3 —— 根据选题生成大纲 JSON
import { generateText } from "@/lib/aiClient";
import { buildOutlinePrompt } from "@/lib/wxArticlePrompts";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const topic: string = body.topic || "";
  const angle: string = body.angle || "";
  const hint: string = body.hint || "";
  if (!topic) return Response.json({ error: "缺少 topic" }, { status: 400 });

  const prompt = buildOutlinePrompt(topic, angle, hint);
  let text: string;
  try {
    text = await generateText({ ...prompt, scope: "articles", maxTokens: 2000 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }

  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return Response.json({ error: "AI 返回格式异常", raw: text.slice(0, 500) }, { status: 500 });
  let outline: unknown;
  try { outline = JSON.parse(m[0]); } catch { return Response.json({ error: "AI 返回 JSON 解析失败", raw: text.slice(0, 500) }, { status: 500 }); }

  // 顺手保存
  const admin = getAdminClient();
  await admin.from("wx_articles").update({
    ai_outline: outline,
    source_topic: topic,
    source_angle: angle,
    current_step: 3,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  return Response.json({ outline });
}
