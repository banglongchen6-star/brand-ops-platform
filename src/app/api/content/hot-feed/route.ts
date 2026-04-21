// DailyHot API 代理，避免浏览器 CORS 问题
// 上游: https://api-hot.imsyy.top/ (免费开源聚合)

const BASE = "https://api-hot.imsyy.top";

// 支持的平台 slug（DailyHot 路径）
const ALLOWED = new Set([
  "douyin", "weibo", "bilibili", "zhihu",
  "baidu", "toutiao", "tieba", "douban-movie",
]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "douyin";
  if (!ALLOWED.has(platform)) {
    return Response.json({ error: "不支持的平台" }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${BASE}/${platform}`, {
      // 上游数据缓存 5 分钟
      next: { revalidate: 300 },
    });
    if (!upstream.ok) {
      return Response.json({ error: "上游数据源暂不可用" }, { status: 502 });
    }
    const json = await upstream.json();
    // 规范化返回
    const items = (json.data || []).map((item: Record<string, unknown>, idx: number) => ({
      id: String(item.id ?? idx),
      title: String(item.title ?? ""),
      desc: (item.desc as string) || "",
      hot: item.hot != null ? Number(item.hot) : null,
      url: (item.url as string) || (item.mobileUrl as string) || "",
      author: (item.author as string) || "",
      rank: idx + 1,
    }));
    return Response.json({ platform, items, updated_at: json.updateTime || null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "请求失败：" + msg }, { status: 500 });
  }
}
