// 一键生成竞品周报（Qwen）
// 拉过去 N 天的快照 + 事件 + SKU 当前状态 → 生成结构化 Markdown 报告 → 存档
import { getAdminClient } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/requireUser";
import { generateText } from "@/lib/aiClient";

interface SnapshotChange {
  competitor_name: string;
  is_self: boolean;
  sku_name: string;
  is_hot: boolean;
  start_price: number | null;
  end_price: number | null;
  price_change_pct: number | null;
  start_sales: number | null;
  end_sales: number | null;
  sales_inc: number | null;
  start_rating: number | null;
  end_rating: number | null;
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const days = Math.min(Math.max(Number(body.days) || 7, 7), 30);
  const competitorIds: string[] | undefined = Array.isArray(body.competitor_ids) ? body.competitor_ids : undefined;

  const periodEnd = new Date();
  const periodStart = new Date(Date.now() - days * 24 * 3600 * 1000);
  const since = periodStart.toISOString().slice(0, 10);

  const admin = getAdminClient();

  // 1. 拉竞品 + SKU
  let cq = admin.from("competitors").select("id, name, brand, platform, category, brand_position, is_self, priority")
    .eq("is_archived", false);
  if (competitorIds && competitorIds.length > 0) cq = cq.in("id", competitorIds);
  const { data: competitors } = await cq;
  if (!competitors || competitors.length === 0) {
    return Response.json({ error: "没有竞品数据，请先添加竞品" }, { status: 400 });
  }
  const cmap = new Map(competitors.map((c) => [c.id, c]));

  const { data: skus } = await admin
    .from("competitor_skus")
    .select("id, competitor_id, name, category, current_price, current_sales, rating, is_hot")
    .in("competitor_id", competitors.map((c) => c.id));
  const smap = new Map((skus ?? []).map((s) => [s.id, s]));

  // 2. 拉快照
  const skuIds = (skus ?? []).map((s) => s.id);
  const snapshots = skuIds.length > 0 ? (await admin
    .from("competitor_sku_snapshots")
    .select("*")
    .in("sku_id", skuIds)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true })).data ?? [] : [];

  // 3. 拉事件
  const { data: events } = await admin
    .from("competitor_events")
    .select("*")
    .in("competitor_id", competitors.map((c) => c.id))
    .gte("event_date", since)
    .order("event_date", { ascending: true });

  // 4. 整理变化
  const changes: SnapshotChange[] = [];
  for (const s of skus ?? []) {
    const skuSnaps = snapshots.filter((x) => x.sku_id === s.id);
    if (skuSnaps.length === 0) continue;
    const first = skuSnaps[0];
    const last = skuSnaps[skuSnaps.length - 1];
    const c = cmap.get(s.competitor_id);
    if (!c) continue;
    const startPrice = first.price != null ? Number(first.price) : null;
    const endPrice = last.price != null ? Number(last.price) : null;
    const pct = (startPrice && endPrice) ? ((endPrice - startPrice) / startPrice) : null;
    const startSales = first.sales != null ? Number(first.sales) : null;
    const endSales = last.sales != null ? Number(last.sales) : null;
    const inc = (startSales != null && endSales != null) ? endSales - startSales : null;
    changes.push({
      competitor_name: c.name,
      is_self: c.is_self,
      sku_name: s.name,
      is_hot: s.is_hot,
      start_price: startPrice,
      end_price: endPrice,
      price_change_pct: pct,
      start_sales: startSales,
      end_sales: endSales,
      sales_inc: inc,
      start_rating: first.rating != null ? Number(first.rating) : null,
      end_rating: last.rating != null ? Number(last.rating) : null,
    });
  }

  // 5. 构 Prompt
  const competitorsBrief = competitors.map((c) => ({
    name: c.name,
    platform: c.platform,
    category: c.category,
    is_self: c.is_self,
  }));

  const eventsBrief = (events ?? []).map((e) => {
    const c = cmap.get(e.competitor_id);
    const sku = e.related_sku_id ? smap.get(e.related_sku_id) : null;
    return {
      competitor: c?.name,
      is_self: c?.is_self,
      type: e.event_type,
      title: e.title,
      description: e.description,
      sku: sku?.name,
      date: e.event_date,
      impact: e.impact_level,
    };
  });

  const periodLabel = `${since} → ${periodEnd.toISOString().slice(0, 10)}`;

  const prompt = {
    system: `你是音乐密码品牌的竞品分析师。音乐密码是专注成年人钢琴教学的在线教育品牌，主打流行钢琴弹唱、简化谱教学。
你的任务：基于过去 ${days} 天竞品 SKU 数据快照 + 重要事件，生成一份给销售经理看的周报。

要求：
- 直接给到「能拿来开会用」的精简内容，不要废话铺陈
- 用具体数字、具体竞品名、具体 SKU 说话
- 区分清楚「竞品」和「我们品牌」（is_self = true 的是我们）
- 行动建议要可执行（不是"加强营销"这种废话），给到具体方向
- 整体不超过 800 字`,
    user: `数据时间段：${periodLabel}

# 竞品列表（${competitors.length} 个，含 ${competitors.filter((c) => c.is_self).length} 个我们品牌）
${JSON.stringify(competitorsBrief, null, 2)}

# SKU 数据变化（${changes.length} 个 SKU）
${JSON.stringify(changes, null, 2)}

# 重要事件（${(events ?? []).length} 条）
${JSON.stringify(eventsBrief, null, 2)}

请按以下结构返回 Markdown 报告（直接输出报告，不要前言）：

## 📊 本周概览
一段话总结：本周竞品市场最值得关注的 2-3 个变化。

## 🔥 TOP 5 动态
列出 5 个最重要的变化（按重要性排序）。每条 1 行。

## 💰 价格趋势
本周整体涨跌情况，挑出明显异常的几个（仅列具体竞品 + SKU + 涨跌幅%）。

## 🆕 新品 / 上新
本周谁上新了？特点是什么？

## 📈 销量变化
谁卖得好？谁突然爆量？

## ⭐ 口碑 / 评分
评分明显变化的 SKU，简短评论。

## 🎯 给我们的行动建议
3-5 条可执行建议，针对我们品牌（音乐密码）。每条要具体（不要写"加强推广"，而要写"针对 X 竞品的 Y 优势，重点宣传我们的 Z"）。`,
  };

  let text: string;
  try {
    text = await generateText({ ...prompt, scope: "content", maxTokens: 3500 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }

  // 6. 存档
  const { data: report, error: insErr } = await admin
    .from("competitor_reports")
    .insert({
      owner_id: guard.userId,
      report_type: "weekly",
      period_start: since,
      period_end: periodEnd.toISOString().slice(0, 10),
      content_md: text,
      highlights: {
        competitor_count: competitors.length,
        sku_count: (skus ?? []).length,
        change_count: changes.length,
        event_count: (events ?? []).length,
      },
      competitor_ids: competitors.map((c) => c.id),
    })
    .select("*")
    .single();

  if (insErr) {
    // 即使存档失败也返回内容，运营至少能看
    return Response.json({ content: text, period: periodLabel, save_error: insErr.message });
  }

  return Response.json({
    report,
    content: text,
    period: periodLabel,
    stats: {
      competitor_count: competitors.length,
      sku_count: (skus ?? []).length,
      change_count: changes.length,
      event_count: (events ?? []).length,
    },
  });
}
