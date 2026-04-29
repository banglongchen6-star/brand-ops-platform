// 截图识别 SKU —— 阿里云 OCR 高精版 + Qwen 结构化
// 流程：图片 → 阿里云 RecognizeAdvanced（提取文字）→ Qwen（解析为 JSON 字段）

import OCRClient, { RecognizeAdvancedRequest } from "@alicloud/ocr-api20210707";
import OpenApiClient, { Config } from "@alicloud/openapi-client";
import { RuntimeOptions } from "@alicloud/tea-util";
import { loadActiveAIConfig } from "@/lib/aiClient";
import { Readable } from "stream";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const OCR_ENDPOINT = "ocr-api.cn-hangzhou.aliyuncs.com";

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

function buildOcrClient() {
  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("缺少环境变量 ALIYUN_OCR_ACCESS_KEY_ID / ALIYUN_OCR_ACCESS_KEY_SECRET");
  }
  const config = new Config({ accessKeyId, accessKeySecret, endpoint: OCR_ENDPOINT });
  return new OCRClient(config);
}

export async function POST(req: Request) {
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return Response.json({ error: "需要 multipart/form-data 上传" }, { status: 400 }); }

  const file = formData.get("image") as File | null;
  if (!file) return Response.json({ error: "缺少 image 字段" }, { status: 400 });
  if (file.size > MAX_SIZE) return Response.json({ error: "图片超过 8MB" }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "只支持图片" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());

  // ── Step 1：阿里云 OCR 提取文字 ──
  let ocrText: string;
  try {
    const client = buildOcrClient();
    const stream = Readable.from(buf);
    const request = new RecognizeAdvancedRequest({ body: stream as unknown as Readable });
    const runtime = new RuntimeOptions({ readTimeout: 15000, connectTimeout: 8000 });
    const response = await client.recognizeAdvancedWithOptions(request, runtime);
    // 提取所有识别到的文字块
    const data = response?.body?.data;
    if (!data) throw new Error("OCR 返回数据为空");
    // 解析 JSON 字符串结果
    let parsed: Record<string, unknown>;
    try { parsed = typeof data === "string" ? JSON.parse(data) : data as Record<string, unknown>; }
    catch { throw new Error("OCR 返回格式异常：" + String(data).slice(0, 200)); }

    // 收集所有文字块的 word
    const lines: string[] = [];
    const blocks = (parsed as { prism_wordsInfo?: { word?: string }[] })?.prism_wordsInfo ?? [];
    for (const b of blocks) {
      if (b.word) lines.push(b.word.trim());
    }
    if (lines.length === 0) {
      // 兜底：整段 content 字段
      const content = (parsed as { content?: string })?.content;
      if (content) lines.push(content);
    }
    ocrText = lines.join("\n");
    if (!ocrText.trim()) throw new Error("OCR 未识别到任何文字，请确认图片清晰度");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let friendly = "阿里云 OCR 调用失败：" + msg;
    if (msg.includes("ALIYUN_OCR")) friendly = msg;
    else if (msg.includes("InvalidAccessKeyId")) friendly = "OCR AccessKey 无效，请检查环境变量";
    else if (msg.includes("ServiceNotOpened")) friendly = "OCR 服务未开通，请前往阿里云控制台开通「OCR 统一识别服务」";
    return Response.json({ error: friendly }, { status: 500 });
  }

  // ── Step 2：Qwen 文本模型结构化 ──
  let apiKey: string;
  let baseUrl: string;
  let model: string;
  try {
    const cfg = await loadActiveAIConfig("content");
    if (cfg.provider !== "qwen") {
      return Response.json({ error: "需要在系统设置把内容 scope 配为 Qwen" }, { status: 400 });
    }
    apiKey = cfg.apiKey;
    baseUrl = (cfg as { baseUrl?: string }).baseUrl ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
    model = (cfg as { model?: string }).model ?? "qwen-plus";
  } catch (e) {
    return Response.json({ error: "AI 配置加载失败：" + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }

  const prompt = `以下是从电商商品页面截图中通过 OCR 提取的文字（可能来自抖音/天猫/京东/拼多多/小红书等平台）：

<ocr_text>
${ocrText}
</ocr_text>

请根据这些文字，提取以下商品信息字段：

- name: 商品标题（完整名称）
- current_price: 当前售价（数字，已优惠后的实付价；如 "￥499" → 499）
- original_price: 原价/划线价（数字，有则填，没有填 null）
- current_sales: 累计销量（数字，"已售 1.2万+" → 12000；"5000+" → 5000）
- monthly_sales: 月销量（数字，"月销 200+" → 200，仅当明确标"月销"时填）
- rating: 评分（0-5 之间数字，"4.9 分" → 4.9）
- review_count: 评价/评分数量（数字，"3.2万评价" → 32000）
- category: 商品品类（中文，自由文本；如 "电子琴"、"乐器配件"）
- platform: 平台代号（仅以下值：douyin / tmall / jd / pinduoduo / xiaohongshu / other）
- is_hot: 是否爆款（true/false，看到"销量榜""爆款""热销 TOP""人气"等标识时为 true）
- confidence: 整体识别置信度（high=字段基本齐全且清晰 / medium=部分字段缺失 / low=文字太少或无关）
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

  let qwenResp: Response;
  try {
    qwenResp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      }),
    });
  } catch (e) {
    return Response.json({ error: "Qwen 网络调用失败：" + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }

  if (!qwenResp.ok) {
    const errText = await qwenResp.text();
    return Response.json({ error: `Qwen 结构化失败 ${qwenResp.status}`, detail: errText.slice(0, 300) }, { status: 500 });
  }

  const j = await qwenResp.json();
  const text: string = j?.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return Response.json({ error: "AI 返回格式异常", raw: text.slice(0, 500) }, { status: 500 });

  let parsed: ParsedSku;
  try { parsed = JSON.parse(m[0]); }
  catch { return Response.json({ error: "JSON 解析失败", raw: text.slice(0, 500) }, { status: 500 }); }

  return Response.json({ data: parsed, model: `阿里云OCR + ${model}` });
}
