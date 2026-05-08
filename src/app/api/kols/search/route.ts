// 达人快速搜索 —— 排期表的「达人选择器」用
// GET /api/kols/search?q=xxx&platform=
// 模糊匹配 name，最多返回 8 条
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const platform = (searchParams.get("platform") || "").trim();

  const admin = getAdminClient();
  // 用 SELECT * —— kols 表实际字段跟 schema.sql 有出入（followers / price / remark）
  // 让 PostgREST 直接返回所有列，前端按需取字段
  let qb = admin.from("kols").select("*").limit(8);
  if (q) qb = qb.ilike("name", `%${q}%`);
  if (platform) qb = qb.eq("platform", platform);
  qb = qb.order("created_at", { ascending: false });

  const { data, error } = await qb;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ items: data ?? [] });
}
