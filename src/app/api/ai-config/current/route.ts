// 公开只读：返回指定 scope 的当前激活模型元数据
// 不暴露 api_key，只返回 provider / model / label 供前端 AI 按钮展示
// 查找链：scope → global → 空
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "content";
  const admin = getAdminClient();

  async function load(s: string) {
    const { data } = await admin
      .from("ai_model_configs")
      .select("provider,model,label,scope")
      .eq("scope", s)
      .eq("is_active", true)
      .maybeSingle();
    return data;
  }

  let data = await load(scope);
  if (!data && scope !== "global") data = await load("global");

  if (!data) {
    return Response.json({ provider: null, model: null, label: null, scope: null, source: "env_fallback" });
  }
  return Response.json({ ...data, source: "db" });
}
