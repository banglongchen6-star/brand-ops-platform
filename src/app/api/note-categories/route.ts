// 笔记分类（板块）CRUD —— 每用户私有，首次访问自动种入 5 个默认
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

const DEFAULT_CATEGORIES = [
  { label: "电商运营", icon: "📦", sort_order: 0 },
  { label: "达人营销", icon: "👥", sort_order: 10 },
  { label: "内容运营", icon: "📝", sort_order: 20 },
  { label: "渠道分销", icon: "🏪", sort_order: 30 },
  { label: "客服中心", icon: "🎧", sort_order: 40 },
];

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("note_categories")
    .select("*")
    .eq("owner_id", guard.userId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 空 → 自动种默认 5 个
  if (!data || data.length === 0) {
    const rows = DEFAULT_CATEGORIES.map((c) => ({ ...c, owner_id: guard.userId }));
    const { data: seeded, error: sErr } = await admin
      .from("note_categories")
      .insert(rows)
      .select("*");
    if (sErr) return Response.json({ error: sErr.message }, { status: 500 });
    return Response.json({ categories: seeded ?? [], seeded: true });
  }

  return Response.json({ categories: data });
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const label = String(body.label || "").trim().slice(0, 30);
  if (!label) return Response.json({ error: "板块名不能为空" }, { status: 400 });
  const icon = String(body.icon || "📝").slice(0, 10);

  const admin = getAdminClient();
  // 默认排到末尾
  const { data: maxRow } = await admin
    .from("note_categories")
    .select("sort_order")
    .eq("owner_id", guard.userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxRow?.sort_order ?? 0) + 10;

  const { data, error } = await admin.from("note_categories").insert({
    owner_id: guard.userId, label, icon, sort_order,
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ category: data });
}
