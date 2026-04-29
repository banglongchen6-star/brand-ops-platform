// 截图识别 SKU —— Qwen-VL 视觉模型
// 用 DashScope OpenAI 兼容模式 https://dashscope.aliyuncs.com/compatible-mode/v1
// 复用 ai_model_configs scope='content' 的 Qwen api_key

import { loadActiveAIConfig } from "@/lib/aiClient";

const DASHSCOPE_VL_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const VL_MODEL = "qwen-vl-plus"; // 性价比版，识别准确度足够商品页解析
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

interface ParsedSku {
  name: string | null;
  current_price: number | null;
  original_price: number | null;
  current_sales: number | null;
  monthly_sales: number | null;
  rating: number | null;
  review_count: number | null;
  category: string | null;
  platform: string | null;
  is_hot: boolean | null;
  confidence: "high" | "medium" | "low";
  notes: string;
}

export async function POST(req: Request) {
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return Response.json({ error: "需要 multipart/form-data 上传" }, { status: 400 }); }

  const file = formData.get("image") as File | null;
  if (!file) return Response.json({ error: "缺少 image 字段" }, { status: 400 });
  if (file.size > MAX_SIZE) return Response.json({ error: "图片超过 8MB" }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "只支持图片" }, { status: 400 });

  // 转 base64 data URL
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.type.split("/")[1] || "png").toLowerCase();
  const dataUrl = `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${buf.toString("base64")}`;

  // 取 Qwen API key
  let apiKey: string;
  try {
    const cfg = await loadActiveAIConfig("content");
    if (cfg.provider !== "qwen") {
      return Response.json({ error: "需要在系统设置把内容 scope 配为 Qwen" }, { status: 400 });
    }
    apiKey = cfg.apiKey;
  } catch (e) {
    return Response.json({ error: "AI 配置加载失败：" + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }

  const prompt = `这是一个电商商品页面截图（可能来自抖音/天猫/京东/拼多多/小红书等平台）。
请仔细识别画面中的商品信息，提取以下字段：

- name: 商品标题（完整名称）
- current_price: 当前售价（数字，已优惠后的实付价；如 "￥499" → 499）
- original_price: 原价/划线价（数字，如果有的话）
- current_sales: 累计销量（数字，"已售 1.2万+" → 12000；"5000+" → 5000）
- monthly_sales: 月销量（数字，"月销 200+" → 200，仅当明确标"月销"时填）
- rating: 评分（0-5 之间数字，"4.9 分" → 4.9）
- review_count: 评价/评分数量（数字，"3.2万评价" → 32000）
- category: 商品品类（中文，自由文本；如 "电子琴"、"乐器配件"）
- platform: 平台代号（仅以下值：douyin / tmall / jd / pinduoduo / xiaohongshu / other）
- is_hot: 是否爆款（true/false，看到"销量榜""爆款""热销 TOP""人气"等标识时为 true）
- confidence: 整体识别置信度（high/medium/low）
- notes: 识别中遇到的问题或不确定的地方（中文，简短）

严格以 JSON 返回，没识别到的字段填 null：
{
  "name": "...",
  "current_price": null,
  "original_price": null,
  "current_sales": null,
  "monthly_sales": null,
  "rating": null,
  "review_count": null,
  "category": null,
  "platform": null,
  "is_hot": null,
  "confidence": "medium",
  "notes": "..."
}`;

  // 调 Qwen-VL
  let resp: Response;
  try {
    resp = await fetch(`${DASHSCOPE_VL_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VL_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 1500,
      }),
    });
  } catch (e) {
    return Response.json({ error: "Qwen-VL 网络调用失败：" + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }

  if (!resp.ok) {
    const errText = await resp.text();
    // 友好错误码
    let friendly = `Qwen-VL 调用失败 ${resp.status}`;
    if (resp.status === 401) friendly = "API Key 无权访问 Qwen-VL —— 请去 bailian 控制台开通 qwen-vl-plus 模型";
    else if (resp.status === 403) friendly = "Qwen-VL 模型未开通或额度耗尽";
    else if (resp.status === 429) friendly = "Qwen-VL 调用频率过高，稍后再试";
    return Response.json({ error: friendly, detail: errText.slice(0, 300) }, { status: 500 });
  }

  const j = await resp.json();
  const text: string = j?.choices?.[0]?.message?.content ?? "";

  // 提 JSON
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return Response.json({ error: "AI 返回格式异常", raw: text.slice(0, 500) }, { status: 500 });

  let parsed: ParsedSku;
  try { parsed = JSON.parse(m[0]); }
  catch { return Response.json({ error: "JSON 解析失败", raw: text.slice(0, 500) }, { status: 500 }); }

  return Response.json({ data: parsed, model: VL_MODEL });
}
