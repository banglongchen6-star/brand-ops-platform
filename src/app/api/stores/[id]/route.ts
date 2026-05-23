// 线下门店 —— PUT 更新 / DELETE 删除
import { getAdminClient } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/requireUser";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return Response.json({ error: "门店名称不能为空" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("offline_stores")
    .update({
      brand: String(body.brand || "").trim(),
      name,
      address: String(body.address || "").trim(),
      region: String(body.region || "").trim(),
      notes: String(body.notes || "").trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ store: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("offline_stores").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
