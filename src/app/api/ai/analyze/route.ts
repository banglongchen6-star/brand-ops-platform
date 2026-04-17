import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SIMPLE_SYSTEM_PROMPT = `你是音乐密码智能乐器公司的品牌经营 AI 分析师。
公司主要产品：音乐密码系列智能乐器（音乐密码2代、音乐密码Pro、音乐密码Mini等），定价区间约500-3000元。
主要销售渠道：抖音直播/短视频、天猫旗舰店、京东自营、拼多多、线下门店代销商。
团队规模约10人，负责国内电商销售运营、营销及线下渠道。

你的任务：
1. 根据用户的经营问题，给出专业、精准的分析和建议
2. 回答要结合智能乐器行业特点和中国电商市场规律
3. 建议要具体可执行，包括具体数字、时间节点和负责人
4. 优先识别风险点和增长机会
5. 使用中文回答，格式清晰（善用 markdown 标题、列表、加粗）`;

const DEEP_CHAT_SYSTEM_PROMPT = `你是音乐密码智能乐器公司的专属经营 AI 分析师，拥有完整的系统数据访问权限。
公司主要产品：音乐密码系列智能乐器（2代、Pro、Mini），定价区间500-3000元。
主要销售渠道：抖音直播/短视频、天猫旗舰店、京东自营、拼多多、线下门店代销商。

你的职责：
1. 基于提供的真实系统数据进行深度分析，不猜测、不编造数字
2. 如果数据为空，诚实说明"该模块暂无数据"，并给出通用建议
3. 分析要结合智能乐器行业特点和中国电商规律
4. 建议具体可执行，包括数字、时间节点
5. 支持追问，记住本次对话的上下文
6. 使用中文，格式清晰（markdown标题、列表、加粗）`;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Deep chat mode: has messages array
    if (Array.isArray(body.messages)) {
      return handleDeepChat(body.messages as Anthropic.MessageParam[], body.dataContext as string | undefined);
    }

    // Simple/report mode: has prompt or reportType
    return handleSimple(body.prompt as string | undefined, body.reportType as string | undefined);
  } catch (err) {
    console.error("AI analyze error:", err);
    return new Response(JSON.stringify({ error: "分析失败，请稍后重试" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleDeepChat(
  messages: Anthropic.MessageParam[],
  dataContext?: string
): Promise<Response> {
  if (!messages.length) {
    return new Response("消息不能为空", { status: 400 });
  }

  // If dataContext is provided, prepend it to the first user message
  let processedMessages: Anthropic.MessageParam[] = messages;
  if (dataContext) {
    const firstMsg = messages[0];
    const contextPrefix = `【系统数据上下文】\n${dataContext}\n\n【用户问题】\n`;
    processedMessages = [
      {
        role: "user",
        content: contextPrefix + (typeof firstMsg.content === "string" ? firstMsg.content : ""),
      },
      ...messages.slice(1),
    ];
  }

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: DEEP_CHAT_SYSTEM_PROMPT,
    messages: processedMessages,
  });

  return buildSSEResponse(stream);
}

async function handleSimple(prompt?: string, reportType?: string): Promise<Response> {
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
    system: SIMPLE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  return buildSSEResponse(stream);
}

function buildSSEResponse(stream: ReturnType<typeof client.messages.stream>): Response {
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
}
