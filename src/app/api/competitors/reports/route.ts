// 周报存档列表 + 删除
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("competitor_reports")
    .select("id, report_type, period_start, period_end, content_md, highlights, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ reports: data ?? [] });
}
