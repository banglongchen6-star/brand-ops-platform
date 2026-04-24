// 热榜同步入库：
//   - source='dailyhot'   → 从 hot_source_configs('dailyhot').api_url 拉 /{slug}
//   - source='trendradar' → 从 hot_source_configs('trendradar').api_url 拉 /s?id={slug}&latest
// URL 和整体启用开关都读 DB，便于后台 UI 编辑；跳过 enabled=false 的来源
// 打音乐相关度分 → upsert 到 content_trends
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Platform {
  id: string;
  slug: string;
  name: string;
  source: string;
  enabled: boolean;
}
interface Keyword {
  keyword: string;
  weight: number;
  category: string;
}
interface SourceConfig {
  slug: string;
  api_url: string;
  enabled: boolean;
}

function scoreMusic(text: string, keywords: Keyword[]): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const k of keywords) {
    if (!k.keyword) continue;
    if (lower.includes(k.keyword.toLowerCase())) {
      if (k.category === "negative") score -= k.weight * 10;
      else score += k.weight * 8;
    }
  }
  return Math.max(0, Math.min(100, score));
}

type Row = {
  platform: string;
  platform_slug: string;
  source_type: string;
  external_id: string;
  title: string;
  description: string;
  author: string;
  cover_url: string;
  source_url: string;
  rank_on_list: number;
  hot_score: number | null;
  music_score: number;
  last_seen_at: string;
};

async function fetchDailyHot(p: Platform, base: string, kwList: Keyword[]): Promise<{ rows: Row[]; error?: string }> {
  const r = await fetch(`${base}/${p.slug}`, { next: { revalidate: 0 } });
  if (!r.ok) return { rows: [], error: `上游 ${r.status}` };
  const json = await r.json();
  const items = (json.data ?? []) as Record<string, unknown>[];
  const rows = items.slice(0, 50).map((it, idx) => {
    const title = String(it.title ?? "");
    const desc = String((it.desc as string) ?? "");
    return {
      platform: p.slug,
      platform_slug: p.slug,
      source_type: "dailyhot",
      external_id: String(it.id ?? `${p.slug}-${idx}`),
      title,
      description: desc,
      author: (it.author as string) ?? "",
      cover_url: (it.cover as string) ?? (it.pic as string) ?? "",
      source_url: (it.url as string) ?? (it.mobileUrl as string) ?? "",
      rank_on_list: idx + 1,
      hot_score: it.hot != null ? Number(it.hot) : null,
      music_score: scoreMusic(title + " " + desc, kwList),
      last_seen_at: new Date().toISOString(),
    };
  });
  return { rows };
}

function parseHot(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  const m = s.match(/^([\d.]+)\s*(万|w|k|W|K)?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "万" || unit === "w") return Math.round(n * 10000);
  if (unit === "k") return Math.round(n * 1000);
  return Math.round(n);
}

async function fetchTrendRadar(p: Platform, base: string, kwList: Keyword[]): Promise<{ rows: Row[]; error?: string }> {
  const url = `${base}/s?id=${encodeURIComponent(p.slug)}&latest`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 BrandOps/TrendSync" },
    next: { revalidate: 0 },
  });
  if (!r.ok) return { rows: [], error: `上游 ${r.status}` };
  const json = await r.json();
  if (json?.status && !["success", "cache"].includes(String(json.status))) {
    return { rows: [], error: `status=${json.status}` };
  }
  const items = (json.items ?? []) as Record<string, unknown>[];
  const rows = items.slice(0, 50).map((it, idx) => {
    const title = String(it.title ?? "");
    const extra = (it.extra ?? {}) as Record<string, unknown>;
    const info = String((extra.info as string) ?? "");
    const hover = extra.hover;
    return {
      platform: p.slug,
      platform_slug: p.slug,
      source_type: "trendradar",
      external_id: String(it.id ?? `${p.slug}-${idx}`),
      title,
      description: info,
      author: "",
      cover_url: "",
      source_url: (it.url as string) ?? (it.mobileUrl as string) ?? "",
      rank_on_list: idx + 1,
      hot_score: parseHot(hover),
      music_score: scoreMusic(title + " " + info, kwList),
      last_seen_at: new Date().toISOString(),
    };
  });
  return { rows };
}

export async function POST() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. 读所有热点来源配置
  const { data: sources } = await supabase
    .from("hot_source_configs")
    .select("slug, api_url, enabled");
  const sourceMap = new Map<string, SourceConfig>(
    (sources ?? []).map((s) => [s.slug, s as SourceConfig])
  );

  // 2. 读启用平台（排除属于被禁用来源的平台）
  const { data: platforms, error: pErr } = await supabase
    .from("content_platforms")
    .select("id,slug,name,source,enabled")
    .in("source", ["dailyhot", "trendradar"])
    .eq("enabled", true);
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 });

  const activePlatforms = (platforms ?? []).filter((p: Platform) => {
    const cfg = sourceMap.get(p.source);
    return cfg && cfg.enabled && cfg.api_url;
  });
  const skipped = (platforms ?? []).length - activePlatforms.length;

  // 3. 读关键词
  const { data: keywords, error: kErr } = await supabase
    .from("content_keyword_library")
    .select("keyword,weight,category")
    .eq("enabled", true);
  if (kErr) return Response.json({ error: kErr.message }, { status: 500 });

  const kwList = (keywords ?? []) as Keyword[];

  // 4. 并行拉取（规避 Vercel 10s 超时）
  const settled = await Promise.allSettled(
    activePlatforms.map(async (p: Platform) => {
      const base = sourceMap.get(p.source)!.api_url.replace(/\/$/, "");
      const { rows, error } = p.source === "trendradar"
        ? await fetchTrendRadar(p, base, kwList)
        : await fetchDailyHot(p, base, kwList);
      return { p, rows, error };
    })
  );

  const result: { platform: string; source: string; fetched: number; upserted: number; error?: string }[] = [];

  for (const s of settled) {
    if (s.status === "rejected") {
      result.push({ platform: "unknown", source: "unknown", fetched: 0, upserted: 0, error: String(s.reason) });
      continue;
    }
    const { p, rows, error } = s.value;
    if (error || rows.length === 0) {
      result.push({ platform: p.slug, source: p.source, fetched: 0, upserted: 0, error });
      continue;
    }
    const { error: upErr, count } = await supabase
      .from("content_trends")
      .upsert(rows, { onConflict: "platform_slug,external_id", ignoreDuplicates: false, count: "exact" });
    if (upErr) {
      result.push({ platform: p.slug, source: p.source, fetched: rows.length, upserted: 0, error: upErr.message });
    } else {
      result.push({ platform: p.slug, source: p.source, fetched: rows.length, upserted: count ?? rows.length });
    }
  }

  return Response.json({
    synced_at: new Date().toISOString(),
    sources: (sources ?? []).map((s) => ({ slug: s.slug, enabled: s.enabled, api_url: s.api_url })),
    skipped_platforms: skipped,
    platforms: result,
    total_upserted: result.reduce((s, x) => s + x.upserted, 0),
  });
}
