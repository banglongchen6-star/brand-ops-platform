// DailyHot 同步入库：拉取所有启用的 dailyhot 平台 → 打音乐相关度分 → upsert 到 content_trends
import { createClient } from "@supabase/supabase-js";

const BASE = "https://api-hot.imsyy.top";

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

export async function POST() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. 读启用的 dailyhot 平台
  const { data: platforms, error: pErr } = await supabase
    .from("content_platforms")
    .select("id,slug,name,source,enabled")
    .eq("source", "dailyhot")
    .eq("enabled", true);
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 });

  // 2. 读关键词
  const { data: keywords, error: kErr } = await supabase
    .from("content_keyword_library")
    .select("keyword,weight,category")
    .eq("enabled", true);
  if (kErr) return Response.json({ error: kErr.message }, { status: 500 });

  const kwList = (keywords ?? []) as Keyword[];
  const result: { platform: string; fetched: number; upserted: number; error?: string }[] = [];

  // 3. 逐平台拉取 + upsert
  for (const p of (platforms ?? []) as Platform[]) {
    try {
      const r = await fetch(`${BASE}/${p.slug}`, { next: { revalidate: 0 } });
      if (!r.ok) {
        result.push({ platform: p.slug, fetched: 0, upserted: 0, error: `上游 ${r.status}` });
        continue;
      }
      const json = await r.json();
      const items = (json.data ?? []) as Record<string, unknown>[];

      // 映射 + 打分
      const rows = items.slice(0, 50).map((it, idx) => {
        const title = String(it.title ?? "");
        const desc = String((it.desc as string) ?? "");
        return {
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

      if (rows.length === 0) {
        result.push({ platform: p.slug, fetched: 0, upserted: 0 });
        continue;
      }

      const { error: upErr, count } = await supabase
        .from("content_trends")
        .upsert(rows, {
          onConflict: "platform_slug,external_id",
          ignoreDuplicates: false,
          count: "exact",
        });
      if (upErr) {
        result.push({ platform: p.slug, fetched: rows.length, upserted: 0, error: upErr.message });
      } else {
        result.push({ platform: p.slug, fetched: rows.length, upserted: count ?? rows.length });
      }
    } catch (e) {
      result.push({
        platform: p.slug,
        fetched: 0,
        upserted: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({
    synced_at: new Date().toISOString(),
    platforms: result,
    total_upserted: result.reduce((s, x) => s + x.upserted, 0),
  });
}
