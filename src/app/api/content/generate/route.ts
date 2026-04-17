import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLATFORM_SPECS: Record<string, string> = {
  "抖音": "竖屏视频脚本，35-60秒（45秒最佳）。结构：0-3s钩子→3-15s痛点→15-35s方法→35-45s行动召唤。标题12-18字含痛点关键词。调性：口语化、节奏快、有反转感。",
  "B站": "横屏中长视频脚本，3-8分钟。标题12-25字知识点风格可带【】前缀，有信息量、有梗。",
  "小红书": "图文内容，标题≤20字开头用「姐妹/家人们/谁懂啊」等共情词+emoji，正文150-300字含emoji+列表，话题5-8个含#成年人学钢琴。闺蜜分享感。禁忌：绝对化用语（最、第一、独家、包教包会）。",
  "视频号": "1-2分钟视频，文案≤80字，温暖家庭治愈风，偏30+用户。",
  "公众号": "图文长文800-1500字，3-5个小标题，深度有金句，文末引流体验课。",
  "微博": "≤140字+话题，2-3个#话题#，话题感互动感。",
};

export async function POST(req: Request) {
  try {
    const { topic, brief, platforms = ["抖音","B站","小红书","视频号","公众号","微博"] } = await req.json();
    if (!topic?.trim()) return Response.json({ error: "请输入选题" }, { status: 400 });

    const platSpecText = (platforms as string[]).map((p: string) =>
      `【${p}平台规范】\n${PLATFORM_SPECS[p] || "无特殊规范"}`
    ).join("\n\n");

    const prompt = `你是音乐密码品牌的全平台内容主笔。音乐密码是专注成年人钢琴教学的在线教育品牌，主打流行钢琴弹唱、简化谱教学，适合0基础成年人。品牌调性：专业但亲切，让「想弹琴」的成年人觉得「我也可以」。

请根据给定选题，为各平台生成内容稿件。调性差异化，但核心卖点一致。

选题：${topic}
背景/创作方向：${brief || "无特殊要求"}

需要生成的平台：${(platforms as string[]).join("、")}

各平台规范：
${platSpecText}

请严格以JSON格式返回，不要有任何其他文字：
{
  "平台名": {
    "title": "最推荐标题",
    "title_alts": ["备选标题2", "备选标题3"],
    "body": "完整正文或脚本",
    "tags": ["标签1", "标签2", "标签3"],
    "tips": "本平台发布注意事项（一句话）"
  }
}`;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 10000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") { text = block.text; break; }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ error: "AI生成格式异常，请重试" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);
    return Response.json({ platforms: result, topic, brief });
  } catch (err) {
    console.error("Content generate error:", err);
    return Response.json({ error: "生成失败，请重试" }, { status: 500 });
  }
}
