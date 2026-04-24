// POST /api/content/trends/import —— 粘贴链接导入单条内容到 content_trends
// 解析 Open Graph meta，检测平台，拿音乐度打分，入库
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Keyword { keyword: string; weight: number; category: string }

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

// 从 URL 推断平台 slug
function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("douyin.com") || u.includes("iesdouyin.com") || u.includes("v.douyin")) return "douyin";
  if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "xiaohongshu";
  if (u.includes("bilibili.com") || u.includes("b23.tv")) return "bilibili";
  if (u.includes("weibo.com") || u.includes("weibo.cn")) return "weibo";
  if (u.includes("zhihu.com")) return "zhihu";
  if (u.includes("mp.weixin.qq.com")) return "weixin";
  if (u.includes("kuaishou.com")) return "kuaishou";
  if (u.includes("channels.weixin.qq.com") || u.includes("finder.video.qq.com")) return "shipinhao";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  return "other";
}

// 取 meta[property=og:xxx] 或 meta[name=xxx] 的 content
function pickMeta(html: string, keys: string[]): string {
  for (const key of keys) {
    // property="og:title"
    const m1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, "i").exec(html);
    if (m1?.[1]) return decodeHtml(m1[1]);
    // content 在前
    const m2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, "i").exec(html);
    if (m2?.[1]) return decodeHtml(m2[1]);
  }
  return "";
}

// 取 <title>
function pickTitle(html: string): string {
  const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return m?.[1] ? decodeHtml(m[1].trim()) : "";
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function fetchMeta(url: string) {
  // 用模拟移动 UA，很多站点移动页 meta 更全
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`上游 ${r.status}`);
  const html = await r.text();

  const title =
    pickMeta(html, ["og:title", "twitter:title"]) ||
    pickTitle(html);
  const description =
    pickMeta(html, ["og:description", "twitter:description", "description"]);
  const cover_url =
    pickMeta(html, ["og:image", "twitter:image", "twitter:image:src"]);
  const author =
    pickMeta(html, ["og:author", "author", "article:author"]);
  const canonical =
    pickMeta(html, ["og:url"]) || url;

  return { title, description, cover_url, author, canonical };
}

export async function POST(req: Request) {
  try {
    const { url, override } = await req.json() as {
      url: string;
      override?: { title?: string; description?: string; author?: string; cover_url?: string; platform_slug?: string };
    };
    if (!url || !/^https?:\/\//.test(url)) {
      return Response.json({ error: "请提供有效的 URL（需 http/https 开头）" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. 抓取 meta（失败也继续，可由 override 补）
    let meta: Awaited<ReturnType<typeof fetchMeta>> = {
      title: "", description: "", cover_url: "", author: "", canonical: url,
    };
    let fetchError = "";
    try {
      meta = await fetchMeta(url);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    }

    // 2. 合并 override（用户手动补的字段优先）
    const title = (override?.title || meta.title || "").trim();
    const description = (override?.description || meta.description || "").trim();
    const cover_url = (override?.cover_url || meta.cover_url || "").trim();
    const author = (override?.author || meta.author || "").trim();
    const platform_slug = override?.platform_slug || detectPlatform(url);

    if (!title) {
      return Response.json({
        error: "未能从页面提取到标题，请手动填写",
        fetchError,
        meta,
      }, { status: 422 });
    }

    // 3. 读关键词 → 打分
    const { data: keywords } = await supabase
      .from("content_keyword_library")
      .select("keyword,weight,category")
      .eq("enabled", true);
    const music_score = scoreMusic(title + " " + description, (keywords ?? []) as Keyword[]);

    // 4. upsert（external_id 用规范化的 URL，防重复）
    const external_id = meta.canonical || url;

    const row = {
      platform_slug,
      source_type: "manual" as const,
      external_id,
      title,
      description,
      author,
      cover_url,
      source_url: url,
      rank_on_list: null,
      hot_score: null,
      music_score,
      last_seen_at: new Date().toISOString(),
    };

    const { data, error: upErr } = await supabase
      .from("content_trends")
      .upsert(row, { onConflict: "platform_slug,external_id" })
      .select()
      .single();
    if (upErr) return Response.json({ error: "入库失败：" + upErr.message }, { status: 500 });

    return Response.json({ ok: true, trend: data, fetchError: fetchError || undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "导入失败：" + msg }, { status: 500 });
  }
}
