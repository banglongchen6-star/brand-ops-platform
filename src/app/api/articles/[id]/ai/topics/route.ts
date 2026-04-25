// Step 1 —— 从今日热榜中筛选 5 个相关选题
import { getAdminClient } from "@/lib/supabaseAdmin";
import { generateText } from "@/lib/aiClient";
import { buildTopicsPrompt } from "@/lib/wxArticlePrompts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params; // 占位：后续可记录到文章日志
  const body = await req.json().catch(() => ({}));
  const userHint: string = body.hint || "";
  const limit: number = Math.min(Number(body.limit) || 30, 60);

  const admin = getAdminClient();
  const { data: trends, error } = await admin
    .from("content_trends")
    .select("id,title,description,platform,music_score")
    .gte("last_seen_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("music_score", { ascending: false })
    .limit(limit);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!trends || trends.length === 0) return Response.json({ error: "暂无热榜数据，请先在内容运营页执行同步" }, { status: 400 });

  const prompt = buildTopicsPrompt(trends, userHint);
  let text: string;
  try {
    text = await generateText({ ...prompt, scope: "articles", maxTokens: 1500 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }

  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return Response.json({ error: "AI 返回格式异常", raw: text.slice(0, 500) }, { status: 500 });
  let candidates: unknown;
  try { candidates = JSON.parse(m[0]); } catch { return Response.json({ error: "AI 返回 JSON 解析失败", raw: text.slice(0, 500) }, { status: 500 }); }

  return Response.json({ candidates, source_count: trends.length });
}
