// 个人笔记列表（按日期）+ 创建
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");      // YYYY-MM-DD
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const admin = getAdminClient();
  let q = admin.from("personal_notes")
    .select("id, date, title, content_md, tags, is_archived, last_detect_len, last_detect_at, created_at, updated_at")
    .eq("owner_id", guard.userId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (date) q = q.eq("date", date);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ notes: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const date = String(body.date || new Date().toISOString().slice(0, 10));
  const title = (body.title || "速记").toString().slice(0, 80);

  const admin = getAdminClient();
  const { data, error } = await admin.from("personal_notes").insert({
    owner_id: guard.userId,
    date,
    title,
    content_md: body.content_md || "",
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ note: data });
}
