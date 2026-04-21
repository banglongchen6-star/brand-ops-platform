import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `你是音乐密码智能乐器公司的内容爆款分析师。
任务：拆解用户提供的爆款视频/文章，提炼出可复用的"爆点要素"，帮助团队复制成功经验。

拆解维度：
1. hook（开头钩子）：前3秒/前一句话如何抓住注意力
2. structure（结构节奏）：内容如何铺陈推进
3. emotion（情绪价值）：引发了什么情绪（好奇/共鸣/愤怒/惊奇/实用/焦虑等）
4. topic_angle（选题切入点）：从什么独特角度切入
5. audience（目标人群）：主要打动的是哪类用户
6. format（表现形式）：视觉/剪辑/音乐/口播等形式特点
7. replicable_elements（可复用元素）：我们团队可直接借鉴的3-5条具体套路

输出要求：
- 严格输出合法 JSON，不要任何解释性文字或 markdown 代码块标记
- JSON 结构如下：
{
  "hook": "string",
  "structure": "string",
  "emotion": "string",
  "topic_angle": "string",
  "audience": "string",
  "format": "string",
  "replicable_elements": ["string", "string", "string"],
  "summary": "一句话总结这个爆款成功的核心原因（30字内）"
}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, platform, raw_content, views, likes, comments, shares, source_url } = body;

    if (!title || !raw_content) {
      return Response.json({ error: "请提供标题和内容" }, { status: 400 });
    }

    const dataLine = [
      views != null && `播放量 ${views}`,
      likes != null && `点赞 ${likes}`,
      comments != null && `评论 ${comments}`,
      shares != null && `分享 ${shares}`,
    ].filter(Boolean).join(" / ");

    const userMessage = `请拆解以下爆款内容：

平台：${platform || "未标注"}
标题：${title}
${source_url ? `链接：${source_url}\n` : ""}${dataLine ? `数据：${dataLine}\n` : ""}
内容/文案/转录：
${raw_content}

请严格按系统要求的 JSON 格式输出。`;

    const resp = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

    let parsed;
    try {
      const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "AI 返回格式异常", raw: text }, { status: 500 });
    }

    return Response.json({ analysis: parsed });
  } catch (err) {
    console.error("analyze-hit error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "分析失败：" + msg }, { status: 500 });
  }
}
