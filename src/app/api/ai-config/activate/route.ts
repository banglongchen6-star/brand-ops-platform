// 激活指定配置（保证同 scope 下唯一激活）
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });
    const admin = getAdminClient();

    // 取目标记录的 scope，以便只反激活同 scope 的其它项
    const { data: target, error: fetchErr } = await admin
      .from("ai_model_configs")
      .select("scope")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr || !target) {
      return Response.json({ error: fetchErr?.message || "配置不存在" }, { status: 404 });
    }

    await admin
      .from("ai_model_configs")
      .update({ is_active: false })
      .eq("scope", target.scope)
      .eq("is_active", true);

    const { error } = await admin
      .from("ai_model_configs")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
