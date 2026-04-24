// POST /api/content/trends/analyze —— AI 拆解一条热点并写入 content_hit_factors
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SYSTEM_PROMPT = `你是音乐密码智能乐器公司的内容爆款分析师。
任务：拆解用户提供的爆款/热点条目，提炼"爆点要素"，帮助团队复制成功经验。

拆解维度：
1. hook（开头钩子）：前3秒/前一句话如何抓住注意力
2. structure（结构节奏）：内容如何铺陈推进（4-6 段式）
3. emotion（情绪价值）：引发了什么情绪（好奇/共鸣/愤怒/惊奇/实用/焦虑等）
4. topic_angle（选题切入点）：从什么独特角度切入
5. audience（目标人群）：主要打动的是哪类用户
6. format（表现形式）：视觉/剪辑/音乐/口播等形式特点
7. replicable_elements（可复用元素）：我们团队可直接借鉴的 3-5 条具体套路
8. adaptation_advice（音乐密码改编建议）：结合智能乐器/音乐教育业务，我们可以怎么复刻（1-3 条）
9. difficulty（复刻难度 1-5）：1=极易复刻，5=需要重投入
10. tags（标签数组）：3-6 个关键标签

输出要求：
- 严格输出合法 JSON，不要任何解释性文字或 markdown 代码块标记
- 结构：
{
  "hook": "string",
  "structure": "string",
  "emotion": "string",
  "topic_angle": "string",
  "audience": "string",
  "format": "string",
  "replicable_elements": ["string"],
  "adaptation_advice": ["string"],
  "difficulty": 1,
  "tags": ["string"],
  "summary": "30字内一句话总结爆款核心"
}`;

interface Analysis {
  hook: string;
  structure: string;
  emotion: string;
  topic_angle: string;
  audience: string;
  format: string;
  replicable_elements: string[];
  adaptation_advice: string[];
  difficulty: number;
  tags: string[];
  summary?: string;
}

export async function POST(req: Request) {
  try {
    const { trend_id } = await req.json();
    if (!trend_id) return Response.json({ error: "缺少 trend_id" }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. 读取热点
    const { data: trend, error: tErr } = await supabase
      .from("content_trends")
      .select("id,title,description,author,platform_slug,hot_score,views,likes,comments,shares,source_url")
      .eq("id", trend_id)
      .single();
    if (tErr || !trend) {
      return Response.json({ error: "热点不存在：" + (tErr?.message ?? "") }, { status: 404 });
    }

    // 2. 构造提示词
    const dataLine = [
      trend.hot_score != null && `热度 ${trend.hot_score}`,
      trend.views != null && `播放 ${trend.views}`,
      trend.likes != null && `点赞 ${trend.likes}`,
      trend.comments != null && `评论 ${trend.comments}`,
      trend.shares != null && `分享 ${trend.shares}`,
    ].filter(Boolean).join(" / ");

    const userMessage = `请拆解以下热点条目：

平台：${trend.platform_slug}
标题：${trend.title}
${trend.author ? `作者：${trend.author}\n` : ""}${trend.source_url ? `链接：${trend.source_url}\n` : ""}${dataLine ? `数据：${dataLine}\n` : ""}描述/内容：
${trend.description || "（无描述，仅基于标题推断）"}

请严格按系统要求的 JSON 格式输出。`;

    // 3. 调 Claude
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

    let parsed: Analysis;
    try {
      const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned) as Analysis;
    } catch {
      return Response.json({ error: "AI 返回格式异常", raw: text }, { status: 500 });
    }

    // 4. Upsert 到 content_hit_factors（uniq by trend_id）
    const row = {
      trend_id: trend.id,
      hook: parsed.hook ?? "",
      structure: parsed.structure ?? "",
      emotion: parsed.emotion ?? "",
      topic_angle: parsed.topic_angle ?? "",
      audience: parsed.audience ?? "",
      format: parsed.format ?? "",
      replicable_elements: Array.isArray(parsed.replicable_elements)
        ? parsed.replicable_elements.join("\n")
        : String(parsed.replicable_elements ?? ""),
      adaptation_advice: Array.isArray(parsed.adaptation_advice)
        ? parsed.adaptation_advice.join("\n")
        : String(parsed.adaptation_advice ?? ""),
      difficulty: Math.max(1, Math.min(5, Number(parsed.difficulty) || 3)),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
      raw_json: parsed,
    };

    const { error: upErr } = await supabase
      .from("content_hit_factors")
      .upsert(row, { onConflict: "trend_id" });
    if (upErr) return Response.json({ error: "保存拆解失败：" + upErr.message }, { status: 500 });

    // 5. 标记 trends.analyzed = true
    await supabase
      .from("content_trends")
      .update({ analyzed: true })
      .eq("id", trend.id);

    return Response.json({ ok: true, analysis: parsed });
  } catch (err) {
    console.error("analyze error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "拆解失败：" + msg }, { status: 500 });
  }
}
