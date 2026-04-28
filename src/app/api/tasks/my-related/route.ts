// 我相关的所有任务：owner / reviewer / assigned_to(legacy) / participant
// 返回时附带 my_role 数组（可同时是多个）
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

interface Task {
  id: string;
  title: string;
  description: string | null;
  module: string | null;
  owner_id: string | null;
  reviewer_id: string | null;
  assigned_to: string | null;
  task_type: string | null;
  source_type: string | null;
  status: string | null;
  priority: string | null;
  progress_percent: number | null;
  due_at: string | null;
  acceptance_criteria: string | null;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
  my_role?: string[];
}

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const me = guard.userId;
  const admin = getAdminClient();

  // 4 个来源并行
  const [byOwner, byReviewer, byAssignee, byParticipant] = await Promise.all([
    admin.from("tasks").select("*").eq("owner_id", me),
    admin.from("tasks").select("*").eq("reviewer_id", me),
    admin.from("tasks").select("*").eq("assigned_to", me),
    admin.from("task_participants").select("task_id").eq("user_id", me),
  ]);

  const taskMap = new Map<string, Task>();

  function add(rows: Task[] | null, role: string) {
    for (const t of rows ?? []) {
      const ex = taskMap.get(t.id);
      if (ex) {
        if (!ex.my_role!.includes(role)) ex.my_role!.push(role);
      } else {
        taskMap.set(t.id, { ...t, my_role: [role] });
      }
    }
  }
  add(byOwner.data as Task[] | null, "owner");
  add(byReviewer.data as Task[] | null, "reviewer");
  add(byAssignee.data as Task[] | null, "assignee");

  // participant 需要二次查 task 详情
  const partTaskIds = (byParticipant.data ?? []).map((x) => x.task_id).filter(Boolean) as string[];
  const newIds = partTaskIds.filter((id) => !taskMap.has(id));
  if (newIds.length > 0) {
    const { data: partTasks } = await admin.from("tasks").select("*").in("id", newIds);
    add(partTasks as Task[] | null, "participant");
  }
  // 已经在 map 里的也标 participant
  for (const id of partTaskIds) {
    const ex = taskMap.get(id);
    if (ex && !ex.my_role!.includes("participant")) ex.my_role!.push("participant");
  }

  // 排序：未完成在前，按 due_at 升序，无 due_at 在最后
  const all = Array.from(taskMap.values()).sort((a, b) => {
    const aDone = a.status === "done";
    const bDone = b.status === "done";
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return b.updated_at.localeCompare(a.updated_at);
  });

  return Response.json({ tasks: all });
}
