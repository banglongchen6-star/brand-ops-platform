// 选题库 CRUD —— GET 列表 / POST 创建
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("q");

  const admin = getAdminClient();
  let q = admin.from("wx_topic_pool").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let topics = data ?? [];
  if (search) {
    const s = search.toLowerCase();
    topics = topics.filter((t) =>
      (t.title || "").toLowerCase().includes(s) ||
      (t.pain_point || "").toLowerCase().includes(s) ||
      (t.angle || "").toLowerCase().includes(s),
    );
  }

  return Response.json({ topics });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return Response.json({ error: "标题不能为空" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.from("wx_topic_pool").insert({
    title,
    pain_point: body.pain_point || "",
    target_audience: body.target_audience || "",
    angle: body.angle || "",
    reference_notes: body.reference_notes || "",
    tags: Array.isArray(body.tags) ? body.tags : [],
    status: body.status || "candidate",
    priority: Number(body.priority) || 3,
    scheduled_at: body.scheduled_at || null,
    source_type: body.source_type || "manual",
    source_ref: body.source_ref || "",
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ topic: data });
}
