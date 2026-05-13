// 个人笔记列表（按日期）+ 创建
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const categoryId = searchParams.get("category_id");
  const limit = Math.min(Number(searchParams.get("limit")) || 500, 1000);

  const admin = getAdminClient();
  let q = admin.from("personal_notes")
    .select("id, date, title, content_md, tags, category_id, sort_order, is_archived, linked_task_ids, push_enabled, push_frequency, push_hour, push_minute, push_weekday, last_detect_len, last_detect_at, created_at, updated_at")
    .eq("owner_id", guard.userId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (date) q = q.eq("date", date);
  if (categoryId) q = q.eq("category_id", categoryId);

  const { data, error } = await q;
  if (error) {
    // 字段缺失兼容回退 —— 分层尝试，避免丢 category_id
    if (error.code === "42703" || /column .* does not exist/i.test(error.message)) {
      // 1) 先尝试去掉 push 系列字段（migration p2 没跑），但保留 category_id / push_enabled
      let qb = admin.from("personal_notes")
        .select("id, date, title, content_md, tags, category_id, sort_order, is_archived, linked_task_ids, push_enabled, last_detect_len, last_detect_at, created_at, updated_at")
        .eq("owner_id", guard.userId)
        .eq("is_archived", false)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(limit);
      if (date) qb = qb.eq("date", date);
      if (categoryId) qb = qb.eq("category_id", categoryId);
      const r2 = await qb;
      if (!r2.error) return Response.json({ notes: r2.data ?? [], degraded: "no_push_schedule" });

      // 2) 再尝试不带 push_enabled（连最早一版 push 字段也没跑）
      let qb2 = admin.from("personal_notes")
        .select("id, date, title, content_md, tags, category_id, sort_order, is_archived, linked_task_ids, last_detect_len, last_detect_at, created_at, updated_at")
        .eq("owner_id", guard.userId)
        .eq("is_archived", false)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(limit);
      if (date) qb2 = qb2.eq("date", date);
      if (categoryId) qb2 = qb2.eq("category_id", categoryId);
      const r3 = await qb2;
      if (!r3.error) return Response.json({ notes: r3.data ?? [], degraded: "no_push" });

      // 3) 最后才掉 category_id（最老的 schema）
      const r4 = await admin.from("personal_notes")
        .select("id, date, title, content_md, tags, is_archived, last_detect_len, last_detect_at, created_at, updated_at")
        .eq("owner_id", guard.userId)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (r4.error) return Response.json({ error: r4.error.message }, { status: 500 });
      return Response.json({ notes: r4.data ?? [], degraded: "no_category" });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ notes: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const date = String(body.date || new Date().toISOString().slice(0, 10));
  const title = (body.title ?? "").toString().slice(0, 80);
  const categoryId: string | null = body.category_id || null;

  const admin = getAdminClient();
  const { data, error } = await admin.from("personal_notes").insert({
    owner_id: guard.userId,
    date,
    title,
    content_md: body.content_md || "",
    category_id: categoryId,
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ note: data });
}
