import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = searchParams.get("month"); // null = full year

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Build date range
    let startDate: string;
    let endDate: string;
    if (month) {
      const m = month.padStart(2, "0");
      const daysInMonth = new Date(year, parseInt(month), 0).getDate();
      startDate = `${year}-${m}-01`;
      endDate = `${year}-${m}-${daysInMonth}`;
    } else {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    // Fetch sales data
    const { data: salesData, error: salesError } = await supabase
      .from("sales_data")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (salesError) {
      console.error("Sales query error:", salesError);
    }

    const rows = salesData || [];

    // Platform list
    const PLATFORMS = ["天猫", "京东", "抖音", "小红书", "视频号", "渠道分销", "其他"];
    const PLATFORM_COLORS: Record<string, string> = {
      天猫: "#f97316",
      京东: "#ef4444",
      抖音: "#ec4899",
      小红书: "#f43f5e",
      视频号: "#22c55e",
      渠道分销: "#8b5cf6",
      其他: "#94a3b8",
    };

    // Aggregate KPIs
    const totalGMV = rows.reduce((s, r) => s + (Number(r.gmv) || 0), 0);
    const totalOrders = rows.reduce((s, r) => s + (Number(r.order_count) || 0), 0);
    const totalAdSpend = rows.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0);
    const roi = totalAdSpend > 0 ? totalGMV / totalAdSpend : 0;

    // Per-platform totals
    const byPlatform = PLATFORMS.map((p) => {
      const pRows = rows.filter((r) => r.platform === p);
      return {
        platform: p,
        color: PLATFORM_COLORS[p] || "#94a3b8",
        gmv: pRows.reduce((s, r) => s + (Number(r.gmv) || 0), 0),
        orders: pRows.reduce((s, r) => s + (Number(r.order_count) || 0), 0),
        adSpend: pRows.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0),
      };
    }).filter((p) => p.gmv > 0 || p.orders > 0);

    // Time series for line chart
    // Group by date label (day or month)
    const dateLabels: string[] = [];
    const dateMap: Record<string, Record<string, number>> = {};

    rows.forEach((r) => {
      const dateStr = String(r.date);
      // For yearly view, group by month; for monthly view, by day
      const label = month
        ? dateStr.slice(5, 10).replace("-", "/") // MM/DD
        : dateStr.slice(0, 7).replace("-", "/"); // YYYY/MM → MM

      if (!dateMap[label]) {
        dateMap[label] = {};
        dateLabels.push(label);
      }
      const plat = r.platform || "其他";
      dateMap[label][plat] = (dateMap[label][plat] || 0) + (Number(r.gmv) || 0);
      dateMap[label]["总计"] = (dateMap[label]["总计"] || 0) + (Number(r.gmv) || 0);
    });

    // Deduplicate labels (in case of year grouping)
    const uniqueLabels = Array.from(new Set(dateLabels));

    const chartData = uniqueLabels.map((label) => {
      const entry: Record<string, string | number> = { date: label };
      const platforms = byPlatform.map((p) => p.platform);
      platforms.forEach((p) => {
        entry[p] = dateMap[label]?.[p] || 0;
      });
      entry["总计"] = dateMap[label]?.["总计"] || 0;
      return entry;
    });

    // Fetch KOL data
    const { data: kolData } = await supabase
      .from("kols")
      .select("id, name, platform, fans_count, status, fee")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: kolCoops } = await supabase
      .from("kol_cooperations")
      .select("*")
      .gte("start_date", startDate)
      .lte("start_date", endDate);

    const totalKolSpend = (kolCoops || []).reduce(
      (s, r) => s + (Number(r.fee) || 0),
      0
    );
    const avgKolRoi =
      (kolCoops || []).length > 0
        ? (kolCoops || []).reduce((s, r) => s + (Number(r.roi) || 0), 0) /
          (kolCoops || []).length
        : 0;

    // Fetch content data
    const { data: contentData } = await supabase
      .from("content_topics")
      .select("id, title, platform, status, publish_date, views, likes, comments")
      .gte("publish_date", startDate)
      .lte("publish_date", endDate)
      .order("views", { ascending: false })
      .limit(20);

    const totalViews = (contentData || []).reduce(
      (s, r) => s + (Number(r.views) || 0),
      0
    );

    return Response.json({
      kpis: {
        totalGMV,
        totalOrders,
        totalAdSpend,
        roi: Math.round(roi * 100) / 100,
        totalKolSpend,
        avgKolRoi: Math.round(avgKolRoi * 100) / 100,
        contentCount: (contentData || []).length,
        totalViews,
      },
      byPlatform,
      chartData,
      kols: kolData || [],
      kolCoops: kolCoops || [],
      content: contentData || [],
      hasData: rows.length > 0,
    });
  } catch (err) {
    console.error("Data API error:", err);
    return Response.json({ error: "获取数据失败" }, { status: 500 });
  }
}
