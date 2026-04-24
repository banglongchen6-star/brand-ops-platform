// 热点来源配置 CRUD
// GET  /api/hot-sources         — 列出所有来源（含统计：平台数 / 启用数）
// PATCH /api/hot-sources         — 更新单个来源的 api_url / enabled（管理员）
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: sources, error } = await supabase
    .from("hot_source_configs")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 统计每个来源下的平台数量（总数 / 启用数）
  const { data: platforms } = await supabase
    .from("content_platforms")
    .select("source,enabled");

  const counts: Record<string, { total: number; enabled: number }> = {};
  for (const p of platforms ?? []) {
    const s = p.source;
    if (!counts[s]) counts[s] = { total: 0, enabled: 0 };
    counts[s].total++;
    if (p.enabled) counts[s].enabled++;
  }

  const enriched = (sources ?? []).map((s) => ({
    ...s,
    platform_total: counts[s.slug]?.total ?? 0,
    platform_enabled: counts[s.slug]?.enabled ?? 0,
  }));

  return Response.json({ sources: enriched });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const { slug, api_url, enabled } = body as { slug?: string; api_url?: string; enabled?: boolean };
  if (!slug) return Response.json({ error: "缺少 slug" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof api_url === "string") {
    const trimmed = api_url.trim().replace(/\/$/, "");
    if (!trimmed) return Response.json({ error: "api_url 不能为空" }, { status: 400 });
    if (!/^https?:\/\//.test(trimmed)) return Response.json({ error: "api_url 必须以 http:// 或 https:// 开头" }, { status: 400 });
    updates.api_url = trimmed;
  }
  if (typeof enabled === "boolean") updates.enabled = enabled;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.from("hot_source_configs").update(updates).eq("slug", slug);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
