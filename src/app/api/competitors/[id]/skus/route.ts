// 某竞品下的 SKU GET 列表 / POST 新增
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("competitor_skus")
    .select("*")
    .eq("competitor_id", id)
    .order("is_hot", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ skus: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return Response.json({ error: "SKU 名称不能为空" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.from("competitor_skus").insert({
    competitor_id: id,
    name,
    product_url: body.product_url || "",
    category: body.category || "",
    current_price: body.current_price ?? null,
    original_price: body.original_price ?? null,
    current_sales: Number(body.current_sales) || 0,
    monthly_sales: Number(body.monthly_sales) || 0,
    rating: body.rating ?? null,
    review_count: Number(body.review_count) || 0,
    status: body.status || "active",
    is_hot: Boolean(body.is_hot),
    notes: body.notes || "",
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 同时写一条初始快照
  if (data && (body.current_price || body.current_sales || body.rating)) {
    await admin.from("competitor_sku_snapshots").insert({
      sku_id: data.id,
      snapshot_date: new Date().toISOString().slice(0, 10),
      price: body.current_price ?? null,
      sales: body.current_sales ?? null,
      monthly_sales: body.monthly_sales ?? null,
      rating: body.rating ?? null,
      review_count: body.review_count ?? null,
    });
  }

  return Response.json({ sku: data });
}
