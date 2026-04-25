// 智能改写 —— 局部文本/全文按指令改写（不写库，前端拿到自行决定是否替换）
import { generateText } from "@/lib/aiClient";
import { buildRewritePrompt } from "@/lib/wxArticlePrompts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const body = await req.json().catch(() => ({}));
  const text: string = body.text || "";
  const instruction: string = body.instruction || "";
  if (!text || !instruction) return Response.json({ error: "缺少 text 或 instruction" }, { status: 400 });

  const prompt = buildRewritePrompt(text, instruction);
  try {
    const out = await generateText({ ...prompt, scope: "articles", maxTokens: Math.min(text.length * 3 + 200, 4000) });
    return Response.json({ rewritten: out.trim() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }
}
