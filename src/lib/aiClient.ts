// 统一 LLM 调用层 —— 自动读取 ai_model_configs 激活配置
// 支持 Claude（Anthropic 原生协议）和 OpenAI 兼容（千问/自定义）

import Anthropic from "@anthropic-ai/sdk";
import { getAdminClient } from "./supabaseAdmin";
import { decryptKey } from "./aiCrypto";

export interface AIConfig {
  provider: "claude" | "qwen" | "openai_compat";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export const PROVIDER_DEFAULTS: Record<AIConfig["provider"], { model: string; baseUrl: string }> = {
  claude: { model: "claude-opus-4-6", baseUrl: "" },
  qwen: { model: "qwen-plus", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  openai_compat: { model: "", baseUrl: "" },
};

// 从 DB 读出激活配置，支持按模块 scope 绑定
// 回退链：scope 专属 → global → 环境变量（Claude 官方 key）
export async function loadActiveAIConfig(scope: string = "global"): Promise<AIConfig> {
  const admin = getAdminClient();

  async function tryLoad(s: string) {
    const { data } = await admin
      .from("ai_model_configs")
      .select("provider,model,base_url,api_key_encrypted")
      .eq("scope", s)
      .eq("is_active", true)
      .maybeSingle();
    return data;
  }

  try {
    // 1. 先找指定 scope 的激活配置
    let data = await tryLoad(scope);
    // 2. 找不到且 scope 不是 global，回退到 global
    if (!data && scope !== "global") data = await tryLoad("global");
    if (data) {
      return {
        provider: data.provider as AIConfig["provider"],
        model: data.model,
        apiKey: decryptKey(data.api_key_encrypted),
        baseUrl: data.base_url || undefined,
      };
    }
  } catch {
    // 回退到环境变量
  }
  const fallback = process.env.ANTHROPIC_API_KEY;
  if (!fallback) throw new Error("未配置激活的 AI 模型，且环境变量 ANTHROPIC_API_KEY 也缺失");
  return { provider: "claude", model: "claude-opus-4-6", apiKey: fallback };
}

// 统一生成接口 —— 接收 system + user，返回文本
export async function generateText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  config?: AIConfig; // 显式覆盖，不传就按 scope 读激活配置
  scope?: string;   // 模块 scope，默认 global
}): Promise<string> {
  const cfg = opts.config ?? (await loadActiveAIConfig(opts.scope ?? "global"));

  if (cfg.provider === "claude") {
    const client = new Anthropic({ apiKey: cfg.apiKey });
    const resp = await client.messages.create({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    const tb = resp.content.find((b) => b.type === "text");
    return tb && tb.type === "text" ? tb.text : "";
  }

  // qwen / openai_compat —— OpenAI 兼容 chat/completions
  const baseUrl = (cfg.baseUrl || PROVIDER_DEFAULTS[cfg.provider].baseUrl).replace(/\/$/, "");
  if (!baseUrl) throw new Error("OpenAI 兼容厂商需要配置接口地址 baseUrl");
  const endpoint = `${baseUrl}/chat/completions`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 2048,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`模型调用失败 ${resp.status}: ${text.slice(0, 300)}`);
  }
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

// 连通性测试：发极短请求，能拿到文本即通过
export async function testConfig(cfg: AIConfig): Promise<{ ok: boolean; latencyMs: number; sample?: string; error?: string }> {
  const t0 = Date.now();
  try {
    const out = await generateText({
      system: "你是一个连通性测试探针，只回复一个字：「可」",
      user: "ping",
      maxTokens: 32,
      config: cfg,
    });
    return { ok: true, latencyMs: Date.now() - t0, sample: (out || "").slice(0, 50) };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}
