"use client";

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Download, RefreshCw, ChevronDown,
  AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef } from "react";

// ── 平台配置 ──────────────────────────────
const PLATFORM_COLOR: Record<string, string> = {
  天猫: "#f97316", 京东: "#ef4444", 抖音: "#ec4899",
  小红书: "#f43f5e", 视频号: "#22c55e", 渠道分销: "#8b5cf6", 其他: "#94a3b8",
};

// ── 指标配置 ──────────────────────────────
type MetricKey = "gmv" | "orders" | "refund" | "adSpend";
const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "gmv",     label: "销售额",   unit: "元" },
  { key: "orders",  label: "订单数",   unit: "单" },
  { key: "refund",  label: "退货金额", unit: "元" },
  { key: "adSpend", label: "推广费",   unit: "元" },
];

// ── 格式化 ────────────────────────────────
function fmt(n: number, isMoney: boolean): string {
  if (!n || isNaN(n)) return "—";
  if (isMoney) {
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)}千万`;
    if (n >= 10_000)     return `${(n / 10_000).toFixed(1)}万`;
    return `¥${n.toLocaleString()}`;
  }
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString();
}

function fmtRaw(n: number): string {
  return n > 0 ? n.toLocaleString() : "0";
}

// ── 类型 ──────────────────────────────────
interface Metrics { gmv: number; orders: number; adSpend: number; refund: number }
interface DateRow  { dateKey: string; platData: Record<string, Metrics>; total: Metrics }
interface PlatData { platform: string; color: string; gmv: number; orders: number; adSpend: number; refund: number }
interface KolRow   { id: string; name: string; platform: string; fans_count: number; status: string; fee: number }
interface KolCoop  { id: string; fee: number; roi: number; actual_views: number }
interface ContentRow { id: string; title: string; platform: string; publish_date: string; views: number; likes: number; comments: number }
interface KPIs { totalGMV: number; totalOrders: number; totalAdSpend: number; totalRefund: number; roi: number; totalKolSpend: number; avgKolRoi: number; contentCount: number; totalViews: number }
interface DataResp {
  kpis: KPIs; byPlatform: PlatData[]; activePlatforms: string[];
  dateRows: DateRow[]; kols: KolRow[]; kolCoops: KolCoop[];
  content: ContentRow[]; hasData: boolean; month: string | null; year: number;
}

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
  const [year,   setYear]   = useState(CURRENT_YEAR);
  const [month,  setMonth]  = useState(String(new Date().getMonth() + 1));
  const [metric, setMetric] = useState<MetricKey>("gmv");
  const [data,   setData]   = useState<DataResp | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [importing,  setImporting]  = useState(false);
  const [toast,      setToast]      = useState<{ ok: boolean; msg: string } | null>(null);
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

  // ── 导入 ─────────────────────────────────
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

  // ── 导出 Excel ───────────────────────────
  function handleExport() {
    if (!data) return;
    const activePlats = data.activePlatforms || [];
    const metaInfo    = METRICS.find(m => m.key === metric)!;
    const isMoney     = metric === "gmv" || metric === "refund" || metric === "adSpend";
    const periodLabel = `${year}年${month ? month + "月" : "全年"}`;

    // 表头
    const header = ["日期", ...activePlats, "合计"];
    const rows: (string | number)[][] = [header];

    // 数据行
    (data.dateRows || []).forEach(row => {
      const dateLabel = data.month
        ? `${year}-${String(month).padStart(2, "0")}-${row.dateKey}`
        : `${year}-${row.dateKey}`;
      const cells: (string | number)[] = [dateLabel];
      activePlats.forEach(p => {
        const v = row.platData[p]?.[metric] || 0;
        cells.push(v);
      });
      cells.push(row.total[metric] || 0);
      rows.push(cells);
    });

    // 合计行
    const totals: (string | number)[] = ["合计"];
    activePlats.forEach(p => {
      const sum = (data.dateRows || []).reduce((s, r) => s + (r.platData[p]?.[metric] || 0), 0);
      totals.push(sum);
    });
    const grandTotal = (data.dateRows || []).reduce((s, r) => s + (r.total[metric] || 0), 0);
    totals.push(grandTotal);
    rows.push(totals);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${metaInfo.label}`);

    // KPI 汇总 sheet
    const kpiRows = [
      ["指标", "数值"],
      ["总销售额（元）", data.kpis?.totalGMV || 0],
      ["总订单数", data.kpis?.totalOrders || 0],
      ["总退货金额（元）", data.kpis?.totalRefund || 0],
      ["总推广费（元）", data.kpis?.totalAdSpend || 0],
      ["推广ROI", data.kpis?.roi || 0],
      ["达人投入费用（元）", data.kpis?.totalKolSpend || 0],
      ["达人平均ROI", data.kpis?.avgKolRoi || 0],
      ["内容发布数", data.kpis?.contentCount || 0],
      ["内容总播放量", data.kpis?.totalViews || 0],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(kpiRows);
    XLSX.utils.book_append_sheet(wb, ws2, "KPI汇总");

    XLSX.writeFile(wb, `数据中心_${periodLabel}_${metaInfo.label}.xlsx`);
  }

  // ── 派生数据 ──────────────────────────────
  const activePlats  = data?.activePlatforms || [];
  const dateRows     = data?.dateRows || [];
  const isMoney      = metric === "gmv" || metric === "refund" || metric === "adSpend";
  const periodLabel  = `${year}年${month ? month + "月" : "全年"}`;
  const metricLabel  = METRICS.find(m => m.key === metric)?.label || "";

  // KPI 卡片数据
  const kpis = data?.kpis;

  // 列合计（每平台）
  const colTotals: Record<string, number> = {};
  activePlats.forEach(p => {
    colTotals[p] = dateRows.reduce((s, r) => s + (r.platData[p]?.[metric] || 0), 0);
  });
  const grandTotal = dateRows.reduce((s, r) => s + (r.total[metric] || 0), 0);

  // 达人 & 内容
  const kolByPlat: Record<string, { count: number; spend: number }> = {};
  (data?.kols || []).forEach(k => {
    if (!kolByPlat[k.platform]) kolByPlat[k.platform] = { count: 0, spend: 0 };
    kolByPlat[k.platform].count++;
  });

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
          <button onClick={handleExport} disabled={loading || !data?.hasData}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm cursor-pointer hover:bg-emerald-700 disabled:opacity-40">
            <Download size={13} />导出Excel
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

      {/* ── KPI 卡片 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard label="总销售额" value={kpis ? fmt(kpis.totalGMV, true) : "—"} sub={`订单 ${kpis ? fmtRaw(kpis.totalOrders) : "—"} 单`} color="text-orange-600" loading={loading} />
        <KpiCard label="总退货金额" value={kpis ? fmt(kpis.totalRefund, true) : "—"} sub={kpis && kpis.totalGMV > 0 ? `退货率 ${((kpis.totalRefund / kpis.totalGMV) * 100).toFixed(1)}%` : "—"} color="text-red-500" loading={loading} />
        <KpiCard label="总推广费" value={kpis ? fmt(kpis.totalAdSpend, true) : "—"} sub={`ROI ${kpis ? kpis.roi.toFixed(2) + "x" : "—"}`} color="text-violet-600" loading={loading} />
        <KpiCard label="内容播放量" value={kpis ? fmt(kpis.totalViews, false) : "—"} sub={`内容 ${kpis ? kpis.contentCount : "—"} 篇`} color="text-blue-600" loading={loading} />
      </div>

      {/* ── 指标切换 ── */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-400 mr-1">查看指标：</span>
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            className={cn("px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors",
              metric === m.key
                ? "bg-violet-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>
            {m.label}（{m.unit}）
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          日期 × 平台 大表
      ══════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">{periodLabel} · {metricLabel}明细</p>
            <p className="text-xs text-gray-400 mt-0.5">纵轴：日期 &nbsp;|&nbsp; 横轴：平台</p>
          </div>
          {!loading && activePlats.length === 0 && (
            <span className="text-xs text-gray-400">暂无平台数据</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* 日期列 */}
                <th className="sticky left-0 z-10 bg-gray-50 py-3 px-4 text-left text-xs font-semibold text-gray-500 w-24 border-r border-gray-100 whitespace-nowrap">
                  {month ? "日期" : "月份"}
                </th>
                {/* 平台列 */}
                {activePlats.map(p => (
                  <th key={p} className="py-3 px-4 text-center text-xs font-semibold whitespace-nowrap min-w-[100px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{ background: PLATFORM_COLOR[p] || "#94a3b8" }} />
                      {p}
                    </div>
                  </th>
                ))}
                {/* 合计列 */}
                <th className="py-3 px-4 text-center text-xs font-semibold text-violet-700 bg-violet-50 whitespace-nowrap border-l border-violet-100 min-w-[100px]">
                  合计
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="sticky left-0 bg-white py-3 px-4 border-r border-gray-100">
                      <div className="h-4 w-12 bg-gray-100 rounded animate-pulse" />
                    </td>
                    {Array.from({ length: Math.max(activePlats.length || 3, 3) + 1 }).map((_, j) => (
                      <td key={j} className="py-3 px-4 text-center">
                        <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mx-auto" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : dateRows.length === 0 ? (
                <tr>
                  <td colSpan={activePlats.length + 2} className="py-16 text-center text-sm text-gray-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                dateRows.map((row, idx) => {
                  const dateLabel = month
                    ? `${month}月${row.dateKey}日`
                    : `${row.dateKey}月`;
                  const totalVal = row.total[metric] || 0;
                  const hasAnyData = activePlats.some(p => (row.platData[p]?.[metric] || 0) > 0);
                  return (
                    <tr key={row.dateKey}
                      className={cn("border-b border-gray-50 transition-colors",
                        hasAnyData ? "hover:bg-gray-50/60" : "opacity-50")}>
                      {/* 日期 */}
                      <td className="sticky left-0 z-10 bg-white py-2.5 px-4 text-xs font-medium text-gray-600 border-r border-gray-100 whitespace-nowrap"
                        style={{ background: idx % 2 === 0 ? "white" : "#fafafa" }}>
                        {dateLabel}
                      </td>
                      {/* 各平台 */}
                      {activePlats.map(p => {
                        const v = row.platData[p]?.[metric] || 0;
                        return (
                          <td key={p} className="py-2.5 px-4 text-center whitespace-nowrap">
                            <span className={cn("text-sm",
                              v > 0 ? "text-gray-800" : "text-gray-300")}>
                              {v > 0 ? fmt(v, isMoney) : "—"}
                            </span>
                          </td>
                        );
                      })}
                      {/* 合计 */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap bg-violet-50/30 border-l border-violet-100">
                        <span className={cn("text-sm font-semibold",
                          totalVal > 0 ? "text-violet-700" : "text-gray-300")}>
                          {totalVal > 0 ? fmt(totalVal, isMoney) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* ── 合计行 ── */}
              {!loading && dateRows.length > 0 && (
                <tr className="bg-violet-50 border-t-2 border-violet-100">
                  <td className="sticky left-0 z-10 bg-violet-50 py-3 px-4 text-xs font-bold text-violet-700 border-r border-violet-100 whitespace-nowrap">
                    合计
                  </td>
                  {activePlats.map(p => (
                    <td key={p} className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="text-sm font-bold text-violet-700">
                        {colTotals[p] > 0 ? fmt(colTotals[p], isMoney) : "—"}
                      </span>
                    </td>
                  ))}
                  <td className="py-3 px-4 text-center whitespace-nowrap bg-violet-100 border-l border-violet-200">
                    <span className="text-sm font-black text-violet-800">
                      {grandTotal > 0 ? fmt(grandTotal, isMoney) : "—"}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 平台汇总卡片 ── */}
      {!loading && (data?.byPlatform || []).length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">平台销售汇总</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            {(data?.byPlatform || []).map(p => (
              <div key={p.platform} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-xs font-semibold text-gray-700 truncate">{p.platform}</span>
                </div>
                <p className="text-base font-bold text-gray-900 truncate">{fmt(p.gmv, true)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{fmtRaw(p.orders)} 单</p>
                {p.refund > 0 && (
                  <p className="text-[10px] text-red-400 mt-0.5">退 {fmt(p.refund, true)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 达人明细 & 内容明细 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

/** KPI 卡片 */
function KpiCard({ label, value, sub, color, loading }: {
  label: string; value: string; sub: string; color: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {loading ? (
        <>
          <div className="h-6 w-24 bg-gray-100 rounded animate-pulse mb-1.5" />
          <div className="h-3.5 w-16 bg-gray-50 rounded animate-pulse" />
        </>
      ) : (
        <>
          <p className={cn("text-xl font-bold", color)}>{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </>
      )}
    </div>
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
function KolDetail({ kols, loading }: {
  kols: { id: string; name: string; platform: string; fans_count: number; status: string; fee: number }[];
  loading: boolean;
}) {
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
function ContentDetail({ content, loading }: {
  content: { id: string; title: string; platform: string; publish_date: string; views: number; likes: number }[];
  loading: boolean;
}) {
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
