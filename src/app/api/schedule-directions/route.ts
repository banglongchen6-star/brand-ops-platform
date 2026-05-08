// 方向字典 列表 / 新建
import { requireUser } from "@/lib/requireUser";
import { requireManager } from "@/lib/requireManager";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("schedule_directions")
    .select("id, name, sort_order, is_active")
    .order("sort_order", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireManager();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "name 不能为空" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("schedule_directions")
    .insert({
      name,
      sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 99,
      is_active: body.is_active !== false,
    })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ item: data });
}
