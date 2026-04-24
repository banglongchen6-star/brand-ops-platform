import { generateText } from "@/lib/aiClient";

const SYSTEM_PROMPT = `你是音乐密码智能乐器公司的内容创作助手。
公司产品：音乐密码系列智能乐器（2代、Pro、Mini），定价 500-3000 元，主打"零基础也能学会音乐"。
目标用户：对音乐有兴趣但没基础的年轻人（18-35岁），一线/新一线城市为主。

任务：根据用户提供的创作简报、参考热点、爆款要素，生成一篇可直接使用的内容脚本。

输出要求：
- 严格输出合法 JSON，不要任何解释性文字或 markdown 代码块标记
- 结构如下：
{
  "title": "吸引人的标题（15字以内，抖音/小红书风格）",
  "hook": "前3秒开头钩子台词（一句话）",
  "script": "完整口播/正文（分段、有节奏感，适合该平台特点）",
  "key_points": "3-5条核心卖点或记忆点（用换行分隔）",
  "cta": "结尾引导（关注/点赞/购买/评论 的具体引导语）",
  "hashtags": ["3-5个标签，不带#号"]
}

写作要求：
- 语言口语化、节奏短促，避免长句
- 抖音：开头强钩子、快速展开、15-60秒节奏
- 小红书：标题带 emoji、正文真实经历感、口语化
- 视频号：相对成熟、有故事性、能引发共鸣
- 公众号：标题具体、正文结构化、信息密度高`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, platform, content_type, target_audience, creative_brief, reference_trend, reference_hit } = body;

    if (!creative_brief?.trim()) {
      return Response.json({ error: "请填写创作简报" }, { status: 400 });
    }

    const refs: string[] = [];
    if (reference_trend) {
      refs.push(`【参考热点】\n标题：${reference_trend.title}\n描述：${reference_trend.description || "无"}`);
    }
    if (reference_hit) {
      refs.push(
        `【参考爆款】\n标题：${reference_hit.title}\n拆解：${
          reference_hit.ai_analysis
            ? `钩子-${reference_hit.ai_analysis.hook}；结构-${reference_hit.ai_analysis.structure}；情绪-${reference_hit.ai_analysis.emotion}`
            : "无"
        }\n可复用元素：${reference_hit.ai_analysis?.replicable_elements?.join("；") || "无"}`
      );
    }

    const userMessage = `请基于以下信息创作内容脚本：

目标平台：${platform || "抖音"}
内容形式：${content_type || "video"}
目标人群：${target_audience || "年轻用户"}
初步标题：${title || "待定"}

创作简报：
${creative_brief}

${refs.join("\n\n")}

请严格按系统要求的 JSON 格式输出。`;

    const text = await generateText({
      system: SYSTEM_PROMPT,
      user: userMessage,
      maxTokens: 3000,
      scope: "content",
    });

    let parsed;
    try {
      const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "AI 返回格式异常", raw: text }, { status: 500 });
    }

    return Response.json({ result: parsed });
  } catch (err) {
    console.error("generate-script error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "生成失败：" + msg }, { status: 500 });
  }
}
