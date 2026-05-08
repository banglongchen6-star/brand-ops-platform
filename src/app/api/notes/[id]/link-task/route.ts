// 笔记与新建任务的双向关联：把任务 id 追加到笔记的 linked_task_ids 数组
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const taskId: string = typeof body.task_id === "string" ? body.task_id : "";
  if (!taskId) return Response.json({ error: "task_id 必填" }, { status: 400 });

  const admin = getAdminClient();
  const { data: note } = await admin
    .from("personal_notes")
    .select("owner_id, linked_task_ids")
    .eq("id", id)
    .maybeSingle();
  if (!note || note.owner_id !== guard.userId) {
    return Response.json({ error: "笔记不存在或无权限" }, { status: 404 });
  }

  const existing: string[] = note.linked_task_ids ?? [];
  if (existing.includes(taskId)) {
    return Response.json({ ok: true, linked_task_ids: existing });
  }
  const next = [...existing, taskId];
  const { error } = await admin
    .from("personal_notes")
    .update({ linked_task_ids: next })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, linked_task_ids: next });
}
