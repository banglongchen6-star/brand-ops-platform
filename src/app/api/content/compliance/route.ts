import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLATFORM_BANS: Record<string, string> = {
  "小红书": "绝对化用语（最/第一/独家/包教包会）、「好用到哭」「绝绝子」等过度营销词",
  "抖音": "营销引流外链、「私聊领取」",
  "B站": "标题党无干货",
  "公众号": "诱导分享/关注送X",
  "微博": "未走抽奖工具的「转发抽X」",
  "视频号": "外链跳转、直接卖货链接",
};

const COMMON_BANS = "最、最佳、最优、第一、独家、唯一、首家、首选、国家级、世界级、顶级、100%、绝对、永远、永久、终身、彻底、完全、零风险、零差评、包教包会、保过、速成、零基础变大师";

export async function POST(req: Request) {
  try {
    const { content, platform } = await req.json();
    if (!content?.trim()) return Response.json({ error: "请输入内容" }, { status: 400 });

    const prompt = `你是专业的内容合规审核员。请检查以下为「${platform || "通用"}」平台准备的内容稿件，识别所有违规风险。

待检查内容：
"""
${content}
"""

通用禁用词：${COMMON_BANS}
${platform && PLATFORM_BANS[platform] ? `\n${platform}平台特定风险点：${PLATFORM_BANS[platform]}` : ""}

请严格以JSON格式返回，不要有其他文字：
{
  "issues": [
    {
      "type": "违规类型（违规词/版权风险/营销违规/平台规则）",
      "severity": "高/中/低",
      "original": "问题原文片段",
      "suggestion": "为什么有风险（一句话）",
      "fixed": "建议替换文案"
    }
  ],
  "summary": "整体评估一句话",
  "passed": true或false,
  "score": 0-100的合规分数
}

如果没有任何问题，返回 {"issues":[],"summary":"内容合规，可直接发布","passed":true,"score":100}`;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") { text = block.text; break; }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ error: "AI检查格式异常，请重试" }, { status: 500 });

    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("Compliance check error:", err);
    return Response.json({ error: "检查失败，请重试" }, { status: 500 });
  }
}
