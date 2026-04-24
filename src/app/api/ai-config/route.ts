// AI 模型配置：列表 / 新增
// 只返回 last4，永不回传密文
// 所有接口仅 admin 可访问

import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { encryptKey, maskKey } from "@/lib/aiCrypto";
import { requireAdmin } from "@/lib/requireAdmin";

const ALLOWED_SCOPES = ["global", "content"] as const;
type Scope = typeof ALLOWED_SCOPES[number];

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const admin = getAdminClient();
    let q = admin
      .from("ai_model_configs")
      .select("id,provider,label,model,base_url,api_key_last4,is_active,scope,created_by,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (scope) q = q.eq("scope", scope);
    const { data, error } = await q;
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ items: data ?? [] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const provider = body.provider as "claude" | "qwen" | "openai_compat";
    const label = String(body.label ?? "").slice(0, 64);
    const model = String(body.model ?? "").trim();
    const baseUrl = String(body.base_url ?? "").trim();
    const apiKey = String(body.api_key ?? "").trim();
    const activate = Boolean(body.activate);
    const scope = (String(body.scope ?? "global") as Scope);

    if (!["claude", "qwen", "openai_compat"].includes(provider)) {
      return Response.json({ error: "provider 非法" }, { status: 400 });
    }
    if (!ALLOWED_SCOPES.includes(scope)) {
      return Response.json({ error: "scope 非法" }, { status: 400 });
    }
    if (!model) return Response.json({ error: "请填写模型名" }, { status: 400 });
    if (!apiKey) return Response.json({ error: "请填写 API Key" }, { status: 400 });
    if (provider !== "claude" && !baseUrl) {
      return Response.json({ error: "该厂商需要 base_url" }, { status: 400 });
    }

    const admin = getAdminClient();
    const encrypted = encryptKey(apiKey);
    const last4 = maskKey(apiKey);

    // 激活时：只反激活同 scope 的其它配置（唯一激活约束按 scope 粒度）
    if (activate) {
      await admin
        .from("ai_model_configs")
        .update({ is_active: false })
        .eq("scope", scope)
        .eq("is_active", true);
    }

    const { data, error } = await admin
      .from("ai_model_configs")
      .insert({
        provider,
        label,
        model,
        base_url: baseUrl,
        api_key_encrypted: encrypted,
        api_key_last4: last4,
        is_active: activate,
        scope,
        created_by: guard.userId,
      })
      .select("id,provider,label,model,base_url,api_key_last4,is_active,scope,created_by,created_at,updated_at")
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ item: data });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
