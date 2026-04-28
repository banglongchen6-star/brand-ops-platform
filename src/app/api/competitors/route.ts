// 竞品 CRUD —— GET 列表 / POST 创建
import { getAdminClient } from "@/lib/supabaseAdmin";

const PLATFORMS = ["douyin", "tmall", "jd", "pinduoduo", "xiaohongshu", "weidian", "other"] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform"); // douyin / tmall / all
  const includeSelf = searchParams.get("include_self") !== "false";

  const admin = getAdminClient();
  let q = admin.from("competitors")
    .select("*")
    .eq("is_archived", false)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (platform && platform !== "all") q = q.eq("platform", platform);
  if (!includeSelf) q = q.eq("is_self", false);

  const { data, error } = await q;
  if (error) {
    // 字段缺失时降级
    if (error.code === "42703" || error.message.includes("is_archived")) {
      const r = await admin.from("competitors").select("*");
      if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
      return Response.json({ competitors: r.data ?? [], degraded: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 附带每个竞品的 SKU 计数
  const ids = (data ?? []).map((c) => c.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: skuRows } = await admin
      .from("competitor_skus")
      .select("competitor_id")
      .in("competitor_id", ids);
    for (const r of skuRows ?? []) {
      counts.set(r.competitor_id, (counts.get(r.competitor_id) ?? 0) + 1);
    }
  }
  const enriched = (data ?? []).map((c) => ({ ...c, sku_count: counts.get(c.id) ?? 0 }));

  return Response.json({ competitors: enriched });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const platform = String(body.platform || "").trim();
  if (!name) return Response.json({ error: "店铺/品牌名不能为空" }, { status: 400 });
  if (!PLATFORMS.includes(platform as typeof PLATFORMS[number])) {
    return Response.json({ error: "platform 非法" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin.from("competitors").insert({
    name,
    brand: body.brand || "",
    platform,
    shop_url: body.shop_url || "",
    category: body.category || "",
    brand_position: body.brand_position || "",
    followers: Number(body.followers) || 0,
    priority: Number(body.priority) || 3,
    is_self: Boolean(body.is_self),
    notes: body.notes || "",
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ competitor: data });
}
