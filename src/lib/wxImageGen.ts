// 通义万相文生图 + Supabase Storage 持久化
// 依赖：DashScope API Key（复用 ai_model_configs scope='content' provider='qwen' 的 key）
//      DashScope URL 24 小时过期，所以异步任务完成后必须立刻下载并存到 Supabase Storage

import { loadActiveAIConfig } from "./aiClient";
import { getAdminClient } from "./supabaseAdmin";

const DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1";
const DEFAULT_MODEL = "wanx2.1-t2i-turbo"; // 速度+质量平衡，约 8-15s 一张
const STORAGE_BUCKET = "wx-article-images";

export interface SubmitResult { task_id: string }
export interface PollResult {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  url?: string;
  error?: string;
}

// 把 "16:9" / "1:1" 转 DashScope size 字符串
function aspectToSize(aspect: string): string {
  if (aspect === "16:9") return "1280*720";
  if (aspect === "9:16") return "720*1280";
  if (aspect === "1:1")  return "1024*1024";
  if (aspect === "3:4")  return "768*1024";
  if (aspect === "4:3")  return "1024*768";
  return "1024*1024";
}

async function getDashScopeKey(): Promise<string> {
  const cfg = await loadActiveAIConfig("content");
  if (cfg.provider !== "qwen") {
    throw new Error("配图功能需要内容运营 scope 配置为 Qwen（通义）—— 当前是 " + cfg.provider);
  }
  return cfg.apiKey;
}

// 提交异步生成任务，返回 task_id
export async function submitImageTask(prompt: string, aspect: string): Promise<SubmitResult> {
  const apiKey = await getDashScopeKey();
  const r = await fetch(`${DASHSCOPE_BASE}/services/aigc/text2image/image-synthesis`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-DashScope-Async": "enable",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: { prompt },
      parameters: { size: aspectToSize(aspect), n: 1 },
    }),
  });
  if (!r.ok) throw new Error(`DashScope 提交失败 ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const taskId = j?.output?.task_id as string;
  if (!taskId) throw new Error("DashScope 未返回 task_id: " + JSON.stringify(j).slice(0, 200));
  return { task_id: taskId };
}

// 查询任务状态
export async function pollImageTask(taskId: string): Promise<PollResult> {
  const apiKey = await getDashScopeKey();
  const r = await fetch(`${DASHSCOPE_BASE}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) return { status: "UNKNOWN", error: `查询失败 ${r.status}` };
  const j = await r.json();
  const s = String(j?.output?.task_status ?? "UNKNOWN").toUpperCase();
  if (s === "SUCCEEDED") {
    const url = j?.output?.results?.[0]?.url as string | undefined;
    if (!url) return { status: "FAILED", error: "成功但无图片 URL" };
    return { status: "SUCCEEDED", url };
  }
  if (s === "FAILED") {
    return { status: "FAILED", error: j?.output?.message || j?.message || "生成失败" };
  }
  if (s === "PENDING" || s === "RUNNING") return { status: s };
  return { status: "UNKNOWN" };
}

// 下载 DashScope 图片并上传到 Supabase Storage，返回永久公开 URL
export async function persistImage(dashscopeUrl: string, articleId: string, position: string): Promise<string> {
  const r = await fetch(dashscopeUrl);
  if (!r.ok) throw new Error(`下载图片失败 ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = (dashscopeUrl.match(/\.(\w{3,4})(\?|$)/)?.[1] || "png").toLowerCase();
  const filename = `${articleId}/${position}-${Date.now()}.${ext}`;
  const admin = getAdminClient();
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(filename, buf, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: false,
  });
  if (error) throw new Error("上传图床失败: " + error.message);
  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}
