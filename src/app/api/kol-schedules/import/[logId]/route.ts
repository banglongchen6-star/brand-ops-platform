// 排期导入 · 进度查询
// GET /api/kol-schedules/import/[logId]
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(_req: Request, { params }: { params: Promise<{ logId: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { logId } = await params;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("schedule_import_logs")
    .select("*").eq("id", logId).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "未找到该导入日志" }, { status: 404 });
  return Response.json({ log: data });
}
