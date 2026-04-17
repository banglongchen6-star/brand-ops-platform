import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year  = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = searchParams.get("month"); // null = full year

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Date range
    let startDate: string;
    let endDate: string;
    if (month) {
      const m = month.padStart(2, "0");
      const daysInMonth = new Date(year, parseInt(month), 0).getDate();
      startDate = `${year}-${m}-01`;
      endDate   = `${year}-${m}-${String(daysInMonth).padStart(2, "0")}`;
    } else {
      startDate = `${year}-01-01`;
      endDate   = `${year}-12-31`;
    }

    const { data: salesData, error: salesError } = await supabase
      .from("sales_data")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (salesError) console.error("Sales query error:", salesError);

    const rows = salesData || [];

    const PLATFORMS = ["天猫", "京东", "抖音", "小红书", "视频号", "渠道分销", "其他"];
    const PLATFORM_COLORS: Record<string, string> = {
      天猫: "#f97316", 京东: "#ef4444", 抖音: "#ec4899",
      小红书: "#f43f5e", 视频号: "#22c55e", 渠道分销: "#8b5cf6", 其他: "#94a3b8",
    };

    // ── KPI 汇总 ──────────────────────────────────────────
    const totalGMV      = rows.reduce((s, r) => s + (Number(r.gmv)           || 0), 0);
    const totalOrders   = rows.reduce((s, r) => s + (Number(r.order_count)   || 0), 0);
    const totalAdSpend  = rows.reduce((s, r) => s + (Number(r.ad_spend)      || 0), 0);
    const totalRefund   = rows.reduce((s, r) => s + (Number(r.refund_amount) || 0), 0);
    const roi = totalAdSpend > 0 ? totalGMV / totalAdSpend : 0;

    // ── 平台汇总 ──────────────────────────────────────────
    const byPlatform = PLATFORMS.map((p) => {
      const pr = rows.filter((r) => r.platform === p);
      return {
        platform: p,
        color:    PLATFORM_COLORS[p] || "#94a3b8",
        gmv:      pr.reduce((s, r) => s + (Number(r.gmv)           || 0), 0),
        orders:   pr.reduce((s, r) => s + (Number(r.order_count)   || 0), 0),
        adSpend:  pr.reduce((s, r) => s + (Number(r.ad_spend)      || 0), 0),
        refund:   pr.reduce((s, r) => s + (Number(r.refund_amount) || 0), 0),
      };
    }).filter((p) => p.gmv > 0 || p.orders > 0);

    const activePlatforms = byPlatform.map((p) => p.platform);

    // ── 日期×平台 dateRows ─────────────────────────────────
    // 生成所有日期标签
    const dateLabels: string[] = [];
    if (month) {
      // 当月每一天
      const daysInMonth = new Date(year, parseInt(month), 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        dateLabels.push(`${String(d).padStart(2, "0")}`);
      }
    } else {
      // 全年每月
      for (let m = 1; m <= 12; m++) {
        dateLabels.push(`${String(m).padStart(2, "0")}`);
      }
    }

    // 构建 dateKey → platform → metrics 的 map
    type Metrics = { gmv: number; orders: number; adSpend: number; refund: number };
    const dateMap: Record<string, Record<string, Metrics>> = {};
    dateLabels.forEach((d) => { dateMap[d] = {}; });

    rows.forEach((r) => {
      const dateStr = String(r.date); // YYYY-MM-DD
      const key = month
        ? dateStr.slice(8, 10)  // DD
        : dateStr.slice(5, 7);  // MM
      if (!dateMap[key]) dateMap[key] = {};
      const plat = r.platform || "其他";
      if (!dateMap[key][plat]) dateMap[key][plat] = { gmv: 0, orders: 0, adSpend: 0, refund: 0 };
      dateMap[key][plat].gmv    += Number(r.gmv)           || 0;
      dateMap[key][plat].orders += Number(r.order_count)   || 0;
      dateMap[key][plat].adSpend+= Number(r.ad_spend)      || 0;
      dateMap[key][plat].refund += Number(r.refund_amount) || 0;
    });

    const dateRows = dateLabels.map((dateKey) => {
      const platData: Record<string, Metrics> = {};
      const total: Metrics = { gmv: 0, orders: 0, adSpend: 0, refund: 0 };
      activePlatforms.forEach((p) => {
        const m = dateMap[dateKey]?.[p] || { gmv: 0, orders: 0, adSpend: 0, refund: 0 };
        platData[p] = m;
        total.gmv     += m.gmv;
        total.orders  += m.orders;
        total.adSpend += m.adSpend;
        total.refund  += m.refund;
      });
      return { dateKey, platData, total };
    });

    // ── KOL ──────────────────────────────────────────────
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

    const totalKolSpend = (kolCoops || []).reduce((s, r) => s + (Number(r.fee) || 0), 0);
    const avgKolRoi = (kolCoops || []).length > 0
      ? (kolCoops || []).reduce((s, r) => s + (Number(r.roi) || 0), 0) / (kolCoops || []).length
      : 0;

    // ── 内容 ──────────────────────────────────────────────
    const { data: contentData } = await supabase
      .from("content_topics")
      .select("id, title, platform, status, publish_date, views, likes, comments")
      .gte("publish_date", startDate)
      .lte("publish_date", endDate)
      .order("views", { ascending: false })
      .limit(20);

    const totalViews = (contentData || []).reduce((s, r) => s + (Number(r.views) || 0), 0);

    return Response.json({
      kpis: {
        totalGMV, totalOrders, totalAdSpend, totalRefund,
        roi: Math.round(roi * 100) / 100,
        totalKolSpend, avgKolRoi: Math.round(avgKolRoi * 100) / 100,
        contentCount: (contentData || []).length, totalViews,
      },
      byPlatform,
      activePlatforms,
      dateRows,
      kols:     kolData    || [],
      kolCoops: kolCoops   || [],
      content:  contentData || [],
      hasData: rows.length > 0,
      month: month || null,
      year,
    });
  } catch (err) {
    console.error("Data API error:", err);
    return Response.json({ error: "获取数据失败" }, { status: 500 });
  }
}
