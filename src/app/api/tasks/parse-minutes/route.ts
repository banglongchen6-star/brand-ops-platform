import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODULE_OPTIONS = [
  "ecommerce", "kol", "content", "channel", "service", "competitor", "finance", "management", "other"
];
const MODULE_LABELS: Record<string, string> = {
  ecommerce: "电商销售", kol: "达人营销", content: "内容运营",
  channel: "渠道分销", service: "客服", competitor: "竞品情报",
  finance: "财务", management: "管理", other: "其他",
};

export async function POST(req: Request) {
  try {
    const { text, members } = await req.json();

    if (!text?.trim()) {
      return Response.json({ error: "请输入会议纪要内容" }, { status: 400 });
    }

    const memberList = (members || [])
      .map((m: { id: string; full_name: string | null; email: string }) =>
        `- ${m.full_name || m.email}（id: ${m.id}）`
      )
      .join("\n");

    const prompt = `你是一个任务管理助手。请从以下会议纪要中提取所有待办任务、行动项、分工安排。

会议纪要内容：
"""
${text}
"""

当前团队成员：
${memberList || "（未提供成员列表）"}

请严格返回 JSON 格式，不要有任何其他文字：
{
  "tasks": [
    {
      "title": "任务标题（简洁明确，20字以内）",
      "description": "任务详情说明（可选，从纪要中提炼）",
      "assigned_to_name": "负责人姓名（从成员列表中匹配，找不到填null）",
      "assigned_to_id": "负责人ID（从成员列表中匹配，找不到填null）",
      "priority": "high/medium/low（根据紧急程度判断，默认medium）",
      "module": "ecommerce/kol/content/channel/service/competitor/finance/management/other（根据任务内容判断）",
      "due_date": "YYYY-MM-DD（如有明确截止日期则填写，否则填null）"
    }
  ],
  "summary": "本次会议主要议题一句话总结"
}

模块说明：ecommerce=电商销售, kol=达人营销, content=内容运营, channel=渠道分销, service=客服, competitor=竞品情报, finance=财务, management=管理, other=其他

注意：
- 只提取明确的任务/行动项，不要提取讨论内容
- 每个任务title要简洁、可执行
- 负责人要从成员列表中精确匹配，匹配不到则为null
- 如果纪要中没有任何任务，返回 {"tasks": [], "summary": "未找到可提取的任务"}`;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    // 提取文本内容
    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        jsonText = block.text;
        break;
      }
    }

    // 解析 JSON
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "AI 解析格式异常，请重试" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    // 验证模块值
    const tasks = (result.tasks || []).map((t: Record<string, string | null>) => ({
      ...t,
      module: MODULE_OPTIONS.includes(t.module as string) ? t.module : "other",
      module_label: MODULE_LABELS[t.module as string] || "其他",
      priority: ["high", "medium", "low"].includes(t.priority as string) ? t.priority : "medium",
    }));

    return Response.json({
      tasks,
      summary: result.summary || "",
      total: tasks.length,
    });
  } catch (err) {
    console.error("Parse minutes error:", err);
    return Response.json({ error: "AI 解析失败，请重试" }, { status: 500 });
  }
}
