// 批量录入快照（一次更新多个 SKU 的当日数据）
// + GET 拉某竞品所有 SKU 的快照历史
import { getAdminClient } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/requireUser";

interface SnapshotInput {
  sku_id: string;
  price?: number | null;
  sales?: number | null;
  monthly_sales?: number | null;
  rating?: number | null;
  review_count?: number | null;
  in_stock?: boolean;
  notes?: string;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const date = String(body.date || new Date().toISOString().slice(0, 10));
  const items: SnapshotInput[] = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return Response.json({ error: "items 不能为空" }, { status: 400 });

  const admin = getAdminClient();
  // 校验 SKU 都属于此竞品
  const skuIds = items.map((x) => x.sku_id).filter(Boolean);
  const { data: skus } = await admin
    .from("competitor_skus")
    .select("id, current_price, current_sales, rating, review_count")
    .in("id", skuIds)
    .eq("competitor_id", id);
  if (!skus || skus.length !== skuIds.length) {
    return Response.json({ error: "SKU 不存在或不属于该竞品" }, { status: 400 });
  }
  const skuMap = new Map(skus.map((s) => [s.id, s]));

  // 写快照 + 更新 SKU 当前值
  const snapshots = items.map((it) => ({
    sku_id: it.sku_id,
    snapshot_date: date,
    price: it.price ?? null,
    sales: it.sales ?? null,
    monthly_sales: it.monthly_sales ?? null,
    rating: it.rating ?? null,
    review_count: it.review_count ?? null,
    in_stock: it.in_stock ?? true,
    notes: it.notes || "",
    recorded_by: guard.userId,
  }));
  const { error: snapErr } = await admin.from("competitor_sku_snapshots").insert(snapshots);
  if (snapErr) return Response.json({ error: snapErr.message }, { status: 500 });

  // 检测异常（价格变动 > 10%, 销量飙升）
  const alerts: { sku_id: string; type: string; message: string }[] = [];
  for (const it of items) {
    const prev = skuMap.get(it.sku_id);
    if (!prev) continue;
    if (typeof it.price === "number" && prev.current_price) {
      const change = (it.price - Number(prev.current_price)) / Number(prev.current_price);
      if (Math.abs(change) > 0.1) {
        alerts.push({
          sku_id: it.sku_id,
          type: change < 0 ? "price_drop" : "price_rise",
          message: `${(change * 100).toFixed(1)}% ${change > 0 ? "涨价" : "降价"}`,
        });
      }
    }
    if (typeof it.sales === "number" && prev.current_sales) {
      const inc = it.sales - prev.current_sales;
      if (inc > prev.current_sales * 0.2 && inc > 50) {
        alerts.push({ sku_id: it.sku_id, type: "sales_surge", message: `新增 ${inc} 销量` });
      }
    }
    // 同步更新 SKU 当前值
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof it.price === "number") upd.current_price = it.price;
    if (typeof it.sales === "number") upd.current_sales = it.sales;
    if (typeof it.monthly_sales === "number") upd.monthly_sales = it.monthly_sales;
    if (typeof it.rating === "number") upd.rating = it.rating;
    if (typeof it.review_count === "number") upd.review_count = it.review_count;
    if (Object.keys(upd).length > 1) {
      await admin.from("competitor_skus").update(upd).eq("id", it.sku_id);
    }
  }

  return Response.json({ ok: true, recorded: snapshots.length, alerts });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 30, 7), 365);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const admin = getAdminClient();
  // 该竞品所有 SKU
  const { data: skus } = await admin.from("competitor_skus")
    .select("id, name").eq("competitor_id", id);
  const ids = (skus ?? []).map((s) => s.id);
  if (ids.length === 0) return Response.json({ snapshots: [], skus: [] });

  const { data: snaps } = await admin
    .from("competitor_sku_snapshots")
    .select("*")
    .in("sku_id", ids)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });
  return Response.json({ snapshots: snaps ?? [], skus: skus ?? [] });
}
