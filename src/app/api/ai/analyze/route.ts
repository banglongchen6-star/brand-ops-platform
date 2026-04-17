import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `你是音乐密码智能乐器公司的品牌经营 AI 分析师。
公司主要产品：音乐密码系列智能乐器（音乐密码2代、音乐密码Pro、音乐密码Mini等），定价区间约500-3000元。
主要销售渠道：抖音直播/短视频、天猫旗舰店、京东自营、拼多多、线下门店代销商。
团队规模约10人，负责国内电商销售运营、营销及线下渠道。

你的任务：
1. 根据用户的经营问题，给出专业、精准的分析和建议
2. 回答要结合智能乐器行业特点和中国电商市场规律
3. 建议要具体可执行，包括具体数字、时间节点和负责人
4. 优先识别风险点和增长机会
5. 使用中文回答，格式清晰（善用 markdown 标题、列表、加粗）`;

export async function POST(req: Request) {
  try {
    const { prompt, reportType } = await req.json();

    let userMessage = prompt;
    if (reportType && !prompt) {
      const typeMap: Record<string, string> = {
        daily: "日报",
        weekly: "周报",
        monthly: "月报",
      };
      userMessage = `请帮我生成本${typeMap[reportType] || "周"}的经营报告，包含：各渠道GMV表现、关键异常分析、下阶段行动建议。格式参考标准经营报告，数据合理推断（可使用示例数据说明格式）。`;
    }

    if (!userMessage?.trim()) {
      return new Response("请输入问题", { status: 400 });
    }

    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Return a ReadableStream for SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("AI analyze error:", err);
    return new Response(JSON.stringify({ error: "分析失败，请稍后重试" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
