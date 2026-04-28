// 单份报告 GET / DELETE
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("competitor_reports").select("*").eq("id", id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "报告不存在" }, { status: 404 });
  return Response.json({ report: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("competitor_reports").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
