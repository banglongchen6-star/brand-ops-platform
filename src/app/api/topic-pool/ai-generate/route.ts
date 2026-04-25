// AI 一键生成候选选题（音乐密码品牌专属）
// 会自动避开库里现有标题，避免重复
import { generateText } from "@/lib/aiClient";
import { getAdminClient } from "@/lib/supabaseAdmin";

interface AICandidate {
  title: string;
  pain_point: string;
  target_audience: string;
  angle: string;
  tags: string[];
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const count: number = Math.min(Number(body.count) || 10, 20);
  const focus: string = String(body.focus || "").trim(); // 用户特别关注方向

  const admin = getAdminClient();
  // 取最近 60 天的标题用来 dedup
  const { data: existing } = await admin
    .from("wx_topic_pool")
    .select("title")
    .gte("created_at", new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString())
    .limit(200);
  const existingTitles = (existing ?? []).map((x) => x.title).filter(Boolean);

  const prompt = {
    system: `你是音乐密码品牌的内容策略师。音乐密码是专注成年人钢琴教学的在线教育品牌，主打流行钢琴弹唱、简化谱教学，用户是 25-45 岁、想圆儿时音乐梦的城市白领。`,
    user: `请生成 ${count} 个差异化的公众号选题方向，每个选题需要具体到能直接写成 1500-2000 字的文章。

要求：
- **类型混合**：痛点切入 / 季节性话题 / 学员故事方向 / 教学技巧 / 反常识观点 / 文化情感切入 各覆盖
- **避开**以下已有选题（防止重复）：
${existingTitles.slice(0, 80).map((t, i) => `  ${i + 1}. ${t}`).join("\n") || "  （无）"}
${focus ? `\n- 用户特别关注方向：${focus}` : ""}

严格以 JSON 数组返回，不要任何额外文字：
[
  {
    "title": "选题方向（15-25字，可作为初稿标题）",
    "pain_point": "切入的痛点（一句话）",
    "target_audience": "目标人群描述（≤20字）",
    "angle": "切入角度建议（30-60字，给写手参考）",
    "tags": ["类型-痛点", "卖点-30天体验课", "情感-治愈"] // 2-4 个标签
  }
]`,
  };

  let text: string;
  try {
    text = await generateText({ ...prompt, scope: "content", maxTokens: 3500 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }

  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return Response.json({ error: "AI 返回格式异常", raw: text.slice(0, 300) }, { status: 500 });
  let candidates: AICandidate[];
  try { candidates = JSON.parse(m[0]); }
  catch { return Response.json({ error: "JSON 解析失败", raw: text.slice(0, 300) }, { status: 500 }); }

  // 不写库，仅返回候选 —— 由前端用户挑选后调 /batch-add
  const cleaned = candidates
    .filter((c) => c.title)
    .map((c) => ({
      title: c.title,
      pain_point: c.pain_point || "",
      target_audience: c.target_audience || "",
      angle: c.angle || "",
      tags: Array.isArray(c.tags) ? c.tags : [],
    }));

  if (cleaned.length === 0) return Response.json({ error: "AI 未返回有效选题" }, { status: 500 });

  return Response.json({ candidates: cleaned, count: cleaned.length });
}
