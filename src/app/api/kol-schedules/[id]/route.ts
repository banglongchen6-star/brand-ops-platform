// 排期 单条 GET / PATCH / DELETE
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = [
  "schedule_date", "category", "category_direction", "tier",
  "kol_name", "kol_id", "amount", "platform",
  "status", "publish_url", "publish_date", "notes",
] as const;

const TIER_VALUES = ["头部", "中部", "腰部", "尾部", "素人", ""] as const;
const STATUS_VALUES = [
  "planned", "contacted", "confirmed", "published", "settled", "cancelled",
] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("kol_schedules").select("*").eq("id", id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "排期不存在" }, { status: 404 });
  return Response.json({ item: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_by: guard.userId, updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) updates[k] = body[k];

  if ("tier" in updates) {
    const t = String(updates.tier ?? "");
    if (!TIER_VALUES.includes(t as typeof TIER_VALUES[number])) {
      return Response.json({ error: "tier 非法" }, { status: 400 });
    }
  }
  if ("status" in updates) {
    const s = String(updates.status ?? "");
    if (!STATUS_VALUES.includes(s as typeof STATUS_VALUES[number])) {
      return Response.json({ error: "status 非法" }, { status: 400 });
    }
  }
  if ("amount" in updates) {
    const n = Number(updates.amount);
    if (!Number.isFinite(n) || n < 0) {
      return Response.json({ error: "amount 必须为非负数字" }, { status: 400 });
    }
    updates.amount = n;
  }
  if ("kol_id" in updates && !updates.kol_id) updates.kol_id = null;
  if ("publish_date" in updates && !updates.publish_date) updates.publish_date = null;

  const admin = getAdminClient();
  const { error } = await admin.from("kol_schedules").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = getAdminClient();
  const { error } = await admin.from("kol_schedules").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
