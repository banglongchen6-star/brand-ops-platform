import { requireAdmin } from "@/lib/requireAdmin";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return Response.json({ error: "ids 必填" }, { status: 400 });
  if (ids.length > 200) return Response.json({ error: "单次最多删除 200 条" }, { status: 400 });

  const admin = getAdminClient();
  const { error, count } = await admin
    .from("tasks")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, deleted: count ?? 0 });
}
