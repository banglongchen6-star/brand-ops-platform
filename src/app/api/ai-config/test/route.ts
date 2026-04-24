// 连通性测试
// 支持两种模式：
// 1) 带 id：测试已保存的某条（从 DB 解密）
// 2) 带 api_key 等明文：测试未保存的新配置（保存前先试一下）

import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { decryptKey } from "@/lib/aiCrypto";
import { testConfig, PROVIDER_DEFAULTS, type AIConfig } from "@/lib/aiClient";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();

    let cfg: AIConfig;
    if (body.id) {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from("ai_model_configs")
        .select("provider,model,base_url,api_key_encrypted")
        .eq("id", body.id)
        .maybeSingle();
      if (error || !data) return Response.json({ error: error?.message || "配置不存在" }, { status: 404 });
      cfg = {
        provider: data.provider,
        model: data.model,
        apiKey: decryptKey(data.api_key_encrypted),
        baseUrl: data.base_url || undefined,
      };
    } else {
      const provider = body.provider as AIConfig["provider"];
      if (!["claude", "qwen", "openai_compat"].includes(provider)) {
        return Response.json({ error: "provider 非法" }, { status: 400 });
      }
      const apiKey = String(body.api_key ?? "").trim();
      if (!apiKey) return Response.json({ error: "请填写 API Key" }, { status: 400 });
      cfg = {
        provider,
        model: String(body.model ?? "").trim() || PROVIDER_DEFAULTS[provider].model,
        apiKey,
        baseUrl: String(body.base_url ?? "").trim() || PROVIDER_DEFAULTS[provider].baseUrl,
      };
    }

    const result = await testConfig(cfg);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
