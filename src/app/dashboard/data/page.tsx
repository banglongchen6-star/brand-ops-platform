"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, RefreshCw, ChevronDown,
  AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── 平台配置 ──────────────────────────────
const PLATFORMS = ["天猫", "京东", "抖音", "小红书", "视频号", "渠道分销", "其他"];

const PLATFORM_COLOR: Record<string, { dot: string; badge: string }> = {
  天猫:   { dot: "#f97316", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  京东:   { dot: "#ef4444", badge: "bg-red-50 text-red-700 border-red-200" },
  抖音:   { dot: "#ec4899", badge: "bg-pink-50 text-pink-700 border-pink-200" },
  小红书: { dot: "#f43f5e", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  视频号: { dot: "#22c55e", badge: "bg-green-50 text-green-700 border-green-200" },
  渠道分销:{ dot: "#8b5cf6", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  其他:   { dot: "#94a3b8", badge: "bg-gray-50 text-gray-500 border-gray-200" },
};

// ── 格式化 ────────────────────────────────
function fmt(n: number, type: "money" | "num" | "roi" | "pct") {
  if (n === 0 || isNaN(n)) return "—";
  if (type === "money") {
    if (n >= 10000000) return `${(n / 10000000).toFixed(2)}千万`;
    if (n >= 10000)    return `${(n / 10000).toFixed(1)}万`;
    return `¥${n.toLocaleString()}`;
  }
  if (type === "num") {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
    return n.toLocaleString();
  }
  if (type === "roi")  return `${n.toFixed(2)}x`;
  if (type === "pct")  return `${n.toFixed(1)}%`;
  return String(n);
}

// ── 类型 ──────────────────────────────────
interface PlatData { platform: string; color: string; gmv: number; orders: number; adSpend: number }
interface KolRow   { id: string; name: string; platform: string; fans_count: number; status: string; fee: number }
interface KolCoop  { id: string; fee: number; roi: number; actual_views: number }
interface ContentRow { id: string; title: string; platform: string; publish_date: string; views: number; likes: number; comments: number }
interface KPIs { totalGMV: number; totalOrders: number; totalAdSpend: number; roi: number; totalKolSpend: number; avgKolRoi: number; contentCount: number; totalViews: number }
interface DataResp { kpis: KPIs; byPlatform: PlatData[]; kols: KolRow[]; kolCoops: KolCoop[]; content: ContentRow[]; hasData: boolean }

// ── 年月选择 ──────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const YEARS  = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const MONTHS = [
  { value: "", label: "全年" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` })),
];

// ══════════════════════════════════════════
//  主页面
// ══════════════════════════════════════════
export default function DataPage() {
  const [year,  setYear]  = useState(CURRENT_YEAR);
  const [month, setMonth] = useState("");
  const [data,  setData]  = useState<DataResp | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ year: String(year) });
      if (month) p.set("month", month);
      const res = await fetch(`/api/data/sales?${p}`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setToast(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res  = await fetch("/api/data/import", { method: "POST", body: fd });
      const json = await res.json();
      setToast(res.ok ? { ok: true, msg: json.message || "导入成功" } : { ok: false, msg: json.error || "导入失败" });
      if (res.ok) fetchData();
    } catch { setToast({ ok: false, msg: "网络错误，请重试" }); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  // ── 构建各平台数据 map ───────────────────
  const platMap: Record<string, PlatData> = {};
  (data?.byPlatform || []).forEach(p => { platMap[p.platform] = p; });

  const activePlats = PLATFORMS.filter(p => platMap[p]?.gmv || platMap[p]?.orders);
  const showPlats   = activePlats.length ? activePlats : PLATFORMS.slice(0, 5); // fallback

  const totalGMV      = showPlats.reduce((s, p) => s + (platMap[p]?.gmv || 0), 0);
  const totalOrders   = showPlats.reduce((s, p) => s + (platMap[p]?.orders || 0), 0);
  const totalAdSpend  = showPlats.reduce((s, p) => s + (platMap[p]?.adSpend || 0), 0);
  const totalROI      = totalAdSpend > 0 ? totalGMV / totalAdSpend : 0;

  // KOL 按平台分组（简单用 kols.platform）
  const kolByPlat: Record<string, { count: number; spend: number; views: number }> = {};
  (data?.kols || []).forEach(k => {
    if (!kolByPlat[k.platform]) kolByPlat[k.platform] = { count: 0, spend: 0, views: 0 };
    kolByPlat[k.platform].count++;
    kolByPlat[k.platform].spend += k.fee || 0;
  });
  (data?.kolCoops || []).forEach(c => {
    // kolCoops 无平台，全部归入总量（单独显示合计列）
    if (!kolByPlat["__total__"]) kolByPlat["__total__"] = { count: 0, spend: 0, views: 0 };
    kolByPlat["__total__"].spend += c.fee || 0;
    kolByPlat["__total__"].views += c.actual_views || 0;
  });
  const totalKolSpend = data?.kpis?.totalKolSpend || 0;
  const totalKolViews = kolByPlat["__total__"]?.views || 0;
  const totalKolCount = (data?.kols || []).length;
  const avgKolROI     = data?.kpis?.avgKolRoi || 0;

  // 内容按平台分组
  const contentByPlat: Record<string, { count: number; views: number; likes: number }> = {};
  (data?.content || []).forEach(c => {
    if (!contentByPlat[c.platform]) contentByPlat[c.platform] = { count: 0, views: 0, likes: 0 };
    contentByPlat[c.platform].count++;
    contentByPlat[c.platform].views += c.views || 0;
    contentByPlat[c.platform].likes += c.likes || 0;
  });
  const totalContent = data?.kpis?.contentCount || 0;
  const totalViews   = data?.kpis?.totalViews || 0;
  const totalLikes   = (data?.content || []).reduce((s, c) => s + (c.likes || 0), 0);

  const periodLabel = `${year}年${month ? month + "月" : "全年"}`;

  return (
    <div className="p-6 min-h-screen bg-gray-50">

      {/* ── 顶部栏 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">数据中心</h1>
          <p className="text-xs text-gray-400 mt-0.5">{periodLabel} · 经营数据全览</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Selector value={String(year)} onChange={v => setYear(parseInt(v))}>
            {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
          </Selector>
          <Selector value={month} onChange={setMonth}>
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Selector>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />刷新
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm cursor-pointer hover:bg-violet-700">
            {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            导入Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={handleImport} disabled={importing} />
          </label>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn("flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm",
          toast.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200")}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 无数据提示 */}
      {!loading && !data?.hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            暂无销售数据，点击右上角「导入Excel」上传历史数据（.xlsx / .xls 格式）。
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════
          汇总大表
      ══════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">

            {/* ── 表头：平台列 ── */}
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="sticky left-0 z-10 bg-gray-50 py-3 px-4 text-left text-xs font-semibold text-gray-500 w-28 border-r border-gray-100">
                  分类
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 w-32 border-r border-gray-100">
                  指标
                </th>
                {showPlats.map(p => (
                  <th key={p} className="py-3 px-4 text-center text-xs font-semibold whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: PLATFORM_COLOR[p]?.dot || "#94a3b8" }} />
                      {p}
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 text-center text-xs font-semibold text-violet-700 bg-violet-50 whitespace-nowrap border-l border-violet-100">
                  合计
                </th>
              </tr>
            </thead>

            <tbody>

              {/* ════════════════════════════
                  一、销售数据
              ════════════════════════════ */}
              <GroupHeader cols={showPlats.length + 3} color="bg-orange-50 text-orange-700">
                一、销售数据
              </GroupHeader>

              {/* 销售额 */}
              <DataRow
                loading={loading}
                category="销售"
                label="销售额（元）"
                highlight
                plats={showPlats}
                getCellVal={p => platMap[p]?.gmv || 0}
                formatVal={v => fmt(v, "money")}
                total={totalGMV}
                formatTotal={v => fmt(v, "money")}
                totalBold
              />

              {/* 销售数量 */}
              <DataRow
                loading={loading}
                category=""
                label="销售数量（单）"
                plats={showPlats}
                getCellVal={p => platMap[p]?.orders || 0}
                formatVal={v => fmt(v, "num")}
                total={totalOrders}
                formatTotal={v => fmt(v, "num")}
              />

              {/* 推广费 */}
              <DataRow
                loading={loading}
                category=""
                label="推广费（元）"
                plats={showPlats}
                getCellVal={p => platMap[p]?.adSpend || 0}
                formatVal={v => fmt(v, "money")}
                total={totalAdSpend}
                formatTotal={v => fmt(v, "money")}
              />

              {/* ROI */}
              <DataRow
                loading={loading}
                category=""
                label="推广 ROI"
                plats={showPlats}
                getCellVal={p => {
                  const pd = platMap[p];
                  return (pd?.adSpend && pd.adSpend > 0) ? pd.gmv / pd.adSpend : 0;
                }}
                formatVal={v => fmt(v, "roi")}
                total={totalROI}
                formatTotal={v => fmt(v, "roi")}
                colorVal={v => v >= 3 ? "text-green-600 font-semibold" : v >= 1.5 ? "text-blue-600" : v > 0 ? "text-red-500" : "text-gray-400"}
              />

              {/* GMV 占比 */}
              <DataRow
                loading={loading}
                category=""
                label="GMV 占比"
                plats={showPlats}
                getCellVal={p => totalGMV > 0 ? ((platMap[p]?.gmv || 0) / totalGMV) * 100 : 0}
                formatVal={v => fmt(v, "pct")}
                total={100}
                formatTotal={_ => "100%"}
              />

              {/* ════════════════════════════
                  二、达人营销
              ════════════════════════════ */}
              <GroupHeader cols={showPlats.length + 3} color="bg-pink-50 text-pink-700">
                二、达人营销
              </GroupHeader>

              {/* 合作达人数 */}
              <DataRow
                loading={loading}
                category="达人"
                label="合作达人数（位）"
                plats={showPlats}
                getCellVal={p => kolByPlat[p]?.count || 0}
                formatVal={v => v > 0 ? String(v) : "—"}
                total={totalKolCount}
                formatTotal={v => String(v) || "—"}
              />

              {/* 达人投入费用 */}
              <DataRow
                loading={loading}
                category=""
                label="达人合作费（元）"
                plats={showPlats}
                getCellVal={p => kolByPlat[p]?.spend || 0}
                formatVal={v => fmt(v, "money")}
                total={totalKolSpend}
                formatTotal={v => fmt(v, "money")}
              />

              {/* 达人带来播放 */}
              <DataRow
                loading={loading}
                category=""
                label="达人带来播放量"
                plats={showPlats}
                getCellVal={_ => 0}                 // 播放量无平台拆分，全放合计
                formatVal={_ => "—"}
                total={totalKolViews}
                formatTotal={v => fmt(v, "num")}
              />

              {/* 平均 ROI */}
              <DataRow
                loading={loading}
                category=""
                label="达人平均 ROI"
                plats={showPlats}
                getCellVal={_ => 0}
                formatVal={_ => "—"}
                total={avgKolROI}
                formatTotal={v => fmt(v, "roi")}
                colorVal={v => v >= 3 ? "text-green-600 font-semibold" : v > 0 ? "text-blue-600" : "text-gray-400"}
              />

              {/* ════════════════════════════
                  三、内容运营
              ════════════════════════════ */}
              <GroupHeader cols={showPlats.length + 3} color="bg-blue-50 text-blue-700">
                三、内容运营
              </GroupHeader>

              {/* 发布内容数 */}
              <DataRow
                loading={loading}
                category="内容"
                label="发布内容数（篇）"
                plats={showPlats}
                getCellVal={p => contentByPlat[p]?.count || 0}
                formatVal={v => v > 0 ? String(v) : "—"}
                total={totalContent}
                formatTotal={v => v > 0 ? String(v) : "—"}
              />

              {/* 播放量 */}
              <DataRow
                loading={loading}
                category=""
                label="播放 / 阅读量"
                plats={showPlats}
                getCellVal={p => contentByPlat[p]?.views || 0}
                formatVal={v => fmt(v, "num")}
                total={totalViews}
                formatTotal={v => fmt(v, "num")}
              />

              {/* 点赞数 */}
              <DataRow
                loading={loading}
                category=""
                label="点赞数"
                plats={showPlats}
                getCellVal={p => contentByPlat[p]?.likes || 0}
                formatVal={v => fmt(v, "num")}
                total={totalLikes}
                formatTotal={v => fmt(v, "num")}
              />

            </tbody>
          </table>
        </div>
      </div>

      {/* ── 达人明细 & 内容明细（折叠列表）── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <KolDetail kols={data?.kols || []} loading={loading} />
        <ContentDetail content={data?.content || []} loading={loading} />
      </div>

      <div className="h-8" />
    </div>
  );
}

// ══════════════════════════════════════════
//  子组件
// ══════════════════════════════════════════

/** 分组标题行 */
function GroupHeader({ children, cols, color }: {
  children: React.ReactNode; cols: number; color: string;
}) {
  return (
    <tr>
      <td colSpan={cols} className={cn("py-2 px-4 text-xs font-bold tracking-wide border-t border-b", color)}>
        {children}
      </td>
    </tr>
  );
}

/** 数据行 */
function DataRow({
  loading, category, label, plats, getCellVal, formatVal,
  total, formatTotal, highlight, totalBold, colorVal,
}: {
  loading: boolean;
  category: string;
  label: string;
  plats: string[];
  getCellVal: (p: string) => number;
  formatVal: (v: number) => string;
  total: number;
  formatTotal: (v: number) => string;
  highlight?: boolean;
  totalBold?: boolean;
  colorVal?: (v: number) => string;
}) {
  return (
    <tr className={cn("border-b border-gray-50 transition-colors hover:bg-gray-50/60",
      highlight && "bg-violet-50/30")}>
      {/* 分类 */}
      <td className="sticky left-0 z-10 py-3 px-4 text-xs font-semibold text-gray-500 bg-white border-r border-gray-100 align-middle whitespace-nowrap"
        style={{ background: highlight ? "#f5f3ff30" : "white" }}>
        {category}
      </td>
      {/* 指标名 */}
      <td className="py-3 px-4 text-xs text-gray-600 border-r border-gray-50 whitespace-nowrap">
        {label}
      </td>
      {/* 各平台数据 */}
      {plats.map(p => {
        const v = getCellVal(p);
        const str = loading ? "" : formatVal(v);
        const colorCls = (!loading && colorVal) ? colorVal(v) : "";
        return (
          <td key={p} className="py-3 px-4 text-center whitespace-nowrap">
            {loading ? (
              <div className="h-4 w-12 bg-gray-100 rounded animate-pulse mx-auto" />
            ) : (
              <span className={cn("text-sm", colorCls || (highlight ? "font-semibold text-gray-800" : "text-gray-600"))}>
                {str}
              </span>
            )}
          </td>
        );
      })}
      {/* 合计 */}
      <td className="py-3 px-4 text-center whitespace-nowrap bg-violet-50/40 border-l border-violet-100">
        {loading ? (
          <div className="h-4 w-14 bg-violet-100 rounded animate-pulse mx-auto" />
        ) : (
          <span className={cn("text-sm",
            totalBold ? "font-bold text-violet-700" : "font-semibold text-violet-600",
            colorVal ? colorVal(total) : "")}>
            {formatTotal(total)}
          </span>
        )}
      </td>
    </tr>
  );
}

/** 下拉选择器 */
function Selector({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm text-gray-700 cursor-pointer focus:outline-none focus:border-violet-400">
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

/** 达人明细列表 */
function KolDetail({ kols, loading }: { kols: { id: string; name: string; platform: string; fans_count: number; status: string; fee: number }[]; loading: boolean }) {
  const STATUS_COLOR: Record<string, string> = {
    合作中: "bg-green-100 text-green-700",
    洽谈中: "bg-blue-100 text-blue-700",
    待联系: "bg-amber-100 text-amber-700",
    已完成: "bg-gray-100 text-gray-500",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800">达人明细</p>
        <p className="text-xs text-gray-400">当前筛选期间达人列表</p>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-50 rounded animate-pulse" />)}
          </div>
        ) : kols.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">暂无达人数据</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="py-2 px-4 text-left font-medium">达人名称</th>
                <th className="py-2 px-4 text-left font-medium">平台</th>
                <th className="py-2 px-4 text-right font-medium">粉丝数</th>
                <th className="py-2 px-4 text-center font-medium">状态</th>
                <th className="py-2 px-4 text-right font-medium">报价（元）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {kols.slice(0, 8).map(k => (
                <tr key={k.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-4 font-medium text-gray-800">{k.name}</td>
                  <td className="py-2.5 px-4 text-xs text-gray-500">{k.platform}</td>
                  <td className="py-2.5 px-4 text-right text-gray-500 text-xs">
                    {k.fans_count ? (k.fans_count >= 10000 ? `${(k.fans_count/10000).toFixed(1)}万` : String(k.fans_count)) : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", STATUS_COLOR[k.status] || "bg-gray-100 text-gray-400")}>
                      {k.status || "—"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-600">
                    {k.fee ? `¥${k.fee >= 10000 ? (k.fee/10000).toFixed(1)+"万" : k.fee.toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {kols.length > 8 && <p className="text-xs text-gray-400 text-center py-2">共 {kols.length} 位达人</p>}
    </div>
  );
}

/** 内容明细列表 */
function ContentDetail({ content, loading }: { content: { id: string; title: string; platform: string; publish_date: string; views: number; likes: number }[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800">内容明细</p>
        <p className="text-xs text-gray-400">按播放量排序 · 前 8 条</p>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-50 rounded animate-pulse" />)}
          </div>
        ) : content.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">暂无内容数据</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="py-2 px-4 text-left font-medium w-6">#</th>
                <th className="py-2 px-4 text-left font-medium">内容标题</th>
                <th className="py-2 px-4 text-left font-medium">平台</th>
                <th className="py-2 px-4 text-right font-medium">播放量</th>
                <th className="py-2 px-4 text-right font-medium">点赞</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {content.slice(0, 8).map((c, i) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-4 text-xs text-gray-400">{i + 1}</td>
                  <td className="py-2.5 px-4 font-medium text-gray-800 max-w-[180px] truncate">{c.title}</td>
                  <td className="py-2.5 px-4 text-xs text-gray-500">{c.platform}</td>
                  <td className="py-2.5 px-4 text-right text-gray-700 font-medium">
                    {c.views ? (c.views >= 10000 ? `${(c.views/10000).toFixed(1)}万` : c.views.toLocaleString()) : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-500 text-xs">
                    {c.likes ? (c.likes >= 10000 ? `${(c.likes/10000).toFixed(1)}万` : c.likes.toLocaleString()) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {content.length > 8 && <p className="text-xs text-gray-400 text-center py-2">共 {content.length} 条内容</p>}
    </div>
  );
}
