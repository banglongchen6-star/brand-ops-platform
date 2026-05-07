import { requireAdmin } from "@/lib/requireAdmin";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id) return Response.json({ error: "缺少任务 id" }, { status: 400 });

  const admin = getAdminClient();
  const { error } = await admin.from("tasks").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
