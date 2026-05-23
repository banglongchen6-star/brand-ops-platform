// 线下门店 CRUD —— GET 列表 / POST 创建
import { getAdminClient } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/requireUser";

export async function GET(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const brand = (searchParams.get("brand") || "").trim();
  const region = (searchParams.get("region") || "").trim();

  const admin = getAdminClient();
  let query = admin.from("offline_stores").select("*").order("created_at", { ascending: false });

  if (brand) query = query.eq("brand", brand);
  if (region) query = query.eq("region", region);
  if (q) {
    // 名称 / 地址 / 品牌 / 区域 模糊搜
    query = query.or(
      `name.ilike.%${q}%,address.ilike.%${q}%,brand.ilike.%${q}%,region.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ stores: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return Response.json({ error: "门店名称不能为空" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("offline_stores")
    .insert({
      brand: String(body.brand || "").trim(),
      name,
      address: String(body.address || "").trim(),
      region: String(body.region || "").trim(),
      notes: String(body.notes || "").trim(),
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ store: data });
}
