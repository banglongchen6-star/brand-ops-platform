// 单 SKU PATCH / DELETE
import { getAdminClient } from "@/lib/supabaseAdmin";

const EDITABLE = [
  "name", "product_url", "category", "current_price", "original_price",
  "current_sales", "monthly_sales", "rating", "review_count",
  "status", "is_hot", "notes",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; skuId: string }> }) {
  const { skuId } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) updates[k] = body[k];

  const admin = getAdminClient();
  const { error } = await admin.from("competitor_skus").update(updates).eq("id", skuId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; skuId: string }> }) {
  const { skuId } = await params;
  const admin = getAdminClient();
  const { error } = await admin.from("competitor_skus").delete().eq("id", skuId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
