// 快速创建任务（首页右侧 + AI 转任务都用这个）
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return Response.json({ error: "标题不能为空" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.from("tasks").insert({
    title: title.slice(0, 200),
    description: body.description || null,
    module: body.module || null,
    owner_id: guard.userId,
    assigned_to: guard.userId, // legacy 兼容
    priority: body.priority || "medium",
    status: body.status || "todo",
    due_at: body.due_at || null,
    task_type: body.task_type || "normal",
    source_type: body.source_type || "manual",
  }).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}
