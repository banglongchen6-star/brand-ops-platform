// 竞品重要事件 GET / POST
import { getAdminClient } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/requireUser";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("competitor_events")
    .select("*")
    .eq("competitor_id", id)
    .order("event_date", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ events: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const event_type = String(body.event_type || "other");
  const title = String(body.title || "").trim();
  if (!title) return Response.json({ error: "标题不能为空" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.from("competitor_events").insert({
    competitor_id: id,
    related_sku_id: body.related_sku_id || null,
    event_type,
    title,
    description: body.description || "",
    event_date: body.event_date || new Date().toISOString().slice(0, 10),
    impact_level: body.impact_level || "medium",
    notes: body.notes || "",
    recorded_by: guard.userId,
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ event: data });
}
