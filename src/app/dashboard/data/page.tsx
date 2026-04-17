"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Download, RefreshCw, ChevronDown,
  AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── 平台颜色 ────────────────────────────────────────────────
const PLAT_COLOR: Record<string, string> = {
  天猫: "#f97316", 京东: "#ef4444", 抖音: "#ec4899",
  小红书: "#f43f5e", 视频号: "#22c55e", 渠道分销: "#8b5cf6", 其他: "#94a3b8",
};

// ── 指标行定义（每平台 4 行）────────────────────────────────
type MKey = "gmv" | "refund" | "adSpend" | "roi";
const PLAT_METRICS: { key: MKey; label: string }[] = [
  { key: "gmv",     label: "销售额"  },
  { key: "refund",  label: "退货额"  },
  { key: "adSpend", label: "推广费"  },
  { key: "roi",     label: "推广ROI" },
];

// ── 星期 ────────────────────────────────────────────────────
const WDAYS = ["日","一","二","三","四","五","六"];
function wday(y: number, m: number, d: number) { return WDAYS[new Date(y, m - 1, d).getDay()]; }
function isWE(y: number, m: number, d: number) { const v = new Date(y,m-1,d).getDay(); return v===0||v===6; }

// ── 格式化 ──────────────────────────────────────────────────
function money(n: number): string {
  if (!n) return "—";
  if (n >= 10_000_000) return `${(n/1e7).toFixed(2)}千万`;
  if (n >= 10_000)     return `${(n/1e4).toFixed(2)}万`;
  return n.toLocaleString();
}
function roi(n: number): string { return n > 0 ? n.toFixed(2) : "—"; }
function cellFmt(v: number, key: MKey): string {
  if (v === 0) return "—";
  if (key === "roi") return roi(v);
  return money(v);
}

// ── 类型 ────────────────────────────────────────────────────
interface Metrics  { gmv: number; orders: number; adSpend: number; refund: number }
interface DateRow  { dateKey: string; platData: Record<string,Metrics>; total: Metrics }
interface PlatSum  { platform: string; color: string; gmv: number; orders: number; adSpend: number; refund: number }
interface KolRow   { id: string; name: string; platform: string; fans_count: number; status: string; fee: number }
interface ContentR { id: string; title: string; platform: string; publish_date: string; views: number; likes: number }
interface KPIs {
  totalGMV: number; totalOrders: number; totalAdSpend: number; totalRefund: number;
  roi: number; totalKolSpend: number; avgKolRoi: number; contentCount: number; totalViews: number;
}
interface DataResp {
  kpis: KPIs; byPlatform: PlatSum[]; activePlatforms: string[];
  dateRows: DateRow[]; kols: KolRow[]; content: ContentR[];
  hasData: boolean; month: string | null; year: number;
}

const CY = new Date().getFullYear();
const YEARS  = [CY, CY - 1, CY - 2];
const MONTHS = [
  { value: "", label: "全年" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i+1}月` })),
];

// 两个固定列的宽度（px）
const COL_PLAT   = 76;
const COL_METRIC = 62;
const COL_DATE   = 54;
const COL_TOTAL  = 72;

// ══════════════════════════════════════════════════════════
export default function DataPage() {
  const [year,  setYear]  = useState(CY);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
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

  // ── 导入 ─────────────────────────────────────────────────
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

  // ── 派生数据 ─────────────────────────────────────────────
  const plats    = data?.activePlatforms || [];
  const dRows    = data?.dateRows || [];
  const dKeys    = dRows.map(r => r.dateKey);
  const kpis     = data?.kpis;
  const monthInt = month ? parseInt(month) : 0;
  const periodLbl = `${year}年${month ? month + "月" : "全年"}`;

  // platData[plat][dateKey] = Metrics
  const pd: Record<string, Record<string,Metrics>> = {};
  plats.forEach(p => {
    pd[p] = {};
    dRows.forEach(r => { pd[p][r.dateKey] = r.platData[p] || { gmv:0, orders:0, adSpend:0, refund:0 }; });
  });

  function cellVal(plat: string, key: MKey, dk: string): number {
    const m = pd[plat]?.[dk];
    if (!m) return 0;
    if (key === "roi")     return m.adSpend > 0 ? m.gmv / m.adSpend : 0;
    if (key === "gmv")     return m.gmv;
    if (key === "refund")  return m.refund;
    if (key === "adSpend") return m.adSpend;
    return 0;
  }
  function rowTot(plat: string, key: MKey): number {
    if (key === "roi") {
      const g = dKeys.reduce((s,dk) => s+(pd[plat]?.[dk]?.gmv||0), 0);
      const a = dKeys.reduce((s,dk) => s+(pd[plat]?.[dk]?.adSpend||0), 0);
      return a > 0 ? g/a : 0;
    }
    if (key === "gmv")     return dKeys.reduce((s,dk) => s+(pd[plat]?.[dk]?.gmv||0), 0);
    if (key === "refund")  return dKeys.reduce((s,dk) => s+(pd[plat]?.[dk]?.refund||0), 0);
    if (key === "adSpend") return dKeys.reduce((s,dk) => s+(pd[plat]?.[dk]?.adSpend||0), 0);
    return 0;
  }

  // 每日各平台汇总
  const daySum: Record<string,{ gmv:number; refund:number; adSpend:number }> = {};
  dKeys.forEach(dk => {
    daySum[dk] = {
      gmv:     plats.reduce((s,p) => s+(pd[p]?.[dk]?.gmv||0), 0),
      refund:  plats.reduce((s,p) => s+(pd[p]?.[dk]?.refund||0), 0),
      adSpend: plats.reduce((s,p) => s+(pd[p]?.[dk]?.adSpend||0), 0),
    };
  });

  const gGmv    = kpis?.totalGMV     || 0;
  const gRefund = kpis?.totalRefund  || 0;
  const gAd     = kpis?.totalAdSpend || 0;
  const gRoi    = kpis?.roi          || 0;
  const gActual = gGmv - gRefund;

  // ── 导出 Excel ───────────────────────────────────────────
  function handleExport() {
    if (!data?.hasData) return;
    const hdr = ["平台","指标", ...dKeys.map(dk => month ? `${month}月${dk}日` : `${dk}月`), "合计"];
    const aoa: (string|number)[][] = [hdr];

    plats.forEach(p => {
      PLAT_METRICS.forEach((m, i) => {
        const row: (string|number)[] = [i===0 ? p : "", m.label];
        dKeys.forEach(dk => {
          const v = cellVal(p, m.key, dk);
          row.push(m.key === "roi" ? parseFloat((v||0).toFixed(2)) : v);
        });
        const t = rowTot(p, m.key);
        row.push(m.key === "roi" ? parseFloat((t||0).toFixed(2)) : t);
        aoa.push(row);
      });
    });
    // 汇总行
    [
      ["电商销售小计", dKeys.map(dk=>daySum[dk]?.gmv||0), gGmv],
      ["退货合计",     dKeys.map(dk=>daySum[dk]?.refund||0), gRefund],
      ["推广费合计",   dKeys.map(dk=>daySum[dk]?.adSpend||0), gAd],
      ["综合ROI",      dKeys.map(dk=>{ const s=daySum[dk]; return s?.adSpend>0 ? parseFloat((s.gmv/s.adSpend).toFixed(2)) : 0; }), parseFloat(gRoi.toFixed(2))],
      ["实际销售(减退货)", dKeys.map(dk=>{ const s=daySum[dk]; return (s?.gmv||0)-(s?.refund||0); }), gActual],
    ].forEach(([lb, vals, tot]) => {
      aoa.push(["汇总", lb as string, ...(vals as number[]), tot as number]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "销售数据");
    XLSX.writeFile(wb, `数据中心_${periodLbl}.xlsx`);
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="p-5 min-h-screen bg-gray-50">

      {/* ── 顶部栏 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">数据中心</h1>
          <p className="text-xs text-gray-400 mt-0.5">{periodLbl} · 经营数据全览</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Sel value={String(year)} onChange={v => setYear(parseInt(v))}>
            {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
          </Sel>
          <Sel value={month} onChange={setMonth}>
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Sel>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />刷新
          </button>
          <button onClick={handleExport} disabled={loading || !data?.hasData}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-40">
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
          {toast.ok ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 无数据提示 */}
      {!loading && !data?.hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">暂无销售数据，点击右上角「导入Excel」上传历史数据（.xlsx / .xls 格式）。</p>
        </div>
      )}

      {/* ── KPI 卡片 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KCard label="总销售额" val={gGmv ? money(gGmv) : "—"}
          sub={`订单 ${kpis?.totalOrders?.toLocaleString() || "—"} 单`} c="text-orange-600" loading={loading} />
        <KCard label="总退货额" val={gRefund ? money(gRefund) : "—"}
          sub={gGmv > 0 ? `退货率 ${((gRefund/gGmv)*100).toFixed(1)}%` : "—"} c="text-red-500" loading={loading} />
        <KCard label="总推广费" val={gAd ? money(gAd) : "—"}
          sub={`综合ROI ${gRoi.toFixed(2)}`} c="text-violet-600" loading={loading} />
        <KCard label="实际销售额" val={gActual > 0 ? money(gActual) : "—"}
          sub="减退货后净额" c="text-emerald-600" loading={loading} />
      </div>

      {/* ══════════════════════════════════════════════════════
          主数据表（列=日期 行=平台×指标）
      ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">

        {/* 表格标题栏 */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{periodLbl} · 销售明细</span>
          {month && dKeys.length > 0 && (
            <span className="text-xs text-gray-400">共 {dKeys.length} 天</span>
          )}
          {loading && <Loader2 size={13} className="animate-spin text-violet-400 ml-auto" />}
        </div>

        <div className="overflow-x-auto">
          <table className="border-collapse text-xs"
            style={{ minWidth: COL_PLAT + COL_METRIC + Math.max(dKeys.length, 3) * COL_DATE + COL_TOTAL }}>

            {/* ── 表头 ── */}
            <thead>
              {/* 月份/年份目标行（可扩展，暂留空）*/}
              <tr className="bg-[#1e1b4b]">
                <th className="sticky left-0 z-20 bg-[#1e1b4b] border-b border-white/10 py-2 px-3 text-left text-[11px] font-bold text-white"
                  style={{ width: COL_PLAT, minWidth: COL_PLAT }}>
                  平台
                </th>
                <th className="sticky z-20 bg-[#1e1b4b] border-b border-white/10 py-2 px-3 text-left text-[11px] font-bold text-white"
                  style={{ left: COL_PLAT, width: COL_METRIC, minWidth: COL_METRIC }}>
                  指标
                </th>
                {dKeys.map(dk => {
                  const di   = parseInt(dk);
                  const wd   = month ? wday(year, monthInt, di) : null;
                  const we   = month ? isWE(year, monthInt, di) : false;
                  return (
                    <th key={dk}
                      className={cn("border-b border-white/10 py-1.5 px-0.5 text-center",
                        we ? "bg-orange-500/80" : "bg-[#1e1b4b]")}
                      style={{ width: COL_DATE, minWidth: COL_DATE }}>
                      {wd && (
                        <div className={cn("text-[9px] mb-0.5 leading-none", we ? "text-orange-100" : "text-violet-300")}>
                          周{wd}
                        </div>
                      )}
                      <div className={cn("text-[11px] font-bold leading-none", we ? "text-white" : "text-violet-100")}>
                        {month ? dk : `${dk}月`}
                      </div>
                      {month && <div className="text-[9px] text-violet-300/70 leading-none mt-0.5">日</div>}
                    </th>
                  );
                })}
                <th className="border-b border-white/10 py-2 px-2 text-center text-[11px] font-bold text-yellow-300 bg-[#2d2a6b]"
                  style={{ width: COL_TOTAL, minWidth: COL_TOTAL }}>
                  合计
                </th>
              </tr>
            </thead>

            <tbody>

              {/* ── 每日总销售额行 ── */}
              <tr className="bg-amber-50 border-b-2 border-amber-300">
                <td className="sticky left-0 z-10 bg-amber-50 border-r border-amber-200 py-2.5 px-3 font-black text-amber-900 whitespace-nowrap"
                  style={{ width: COL_PLAT }}>
                  每日合计
                </td>
                <td className="sticky z-10 bg-amber-50 border-r border-amber-200 py-2.5 px-3 text-amber-700 whitespace-nowrap"
                  style={{ left: COL_PLAT, width: COL_METRIC }}>
                  销售额
                </td>
                {dKeys.map(dk => {
                  const v  = daySum[dk]?.gmv || 0;
                  const we = month ? isWE(year, monthInt, parseInt(dk)) : false;
                  return (
                    <td key={dk} className={cn("py-2 px-0.5 text-center whitespace-nowrap border-l border-amber-200",
                      we && "bg-orange-100/40")}>
                      <span className={v > 0 ? "font-bold text-amber-800" : "text-gray-300"}>
                        {v > 0 ? money(v) : "—"}
                      </span>
                    </td>
                  );
                })}
                <td className="py-2.5 px-2 text-center bg-yellow-50 border-l-2 border-yellow-300">
                  <span className="font-black text-amber-900">{gGmv > 0 ? money(gGmv) : "—"}</span>
                </td>
              </tr>

              {/* ── 无数据骨架 ── */}
              {loading && plats.length === 0 && (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="sticky left-0 bg-white border-r border-gray-100 py-2.5 px-3" style={{ width: COL_PLAT }}>
                      <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="sticky bg-white border-r border-gray-100 py-2.5 px-3" style={{ left: COL_PLAT, width: COL_METRIC }}>
                      <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
                    </td>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="border-l border-gray-50 px-1 py-2.5">
                        <div className="h-3 w-10 bg-gray-100 rounded animate-pulse mx-auto" />
                      </td>
                    ))}
                    <td className="bg-violet-50/20 border-l-2 border-violet-100 px-2 py-2.5 text-center">
                      <div className="h-3 w-12 bg-violet-100 rounded animate-pulse mx-auto" />
                    </td>
                  </tr>
                ))
              )}

              {/* ── 平台分组行 ── */}
              {plats.map(plat => {
                const pc = PLAT_COLOR[plat] || "#94a3b8";
                return PLAT_METRICS.map((m, mIdx) => {
                  const first   = mIdx === 0;
                  const last    = mIdx === PLAT_METRICS.length - 1;
                  const total   = rowTot(plat, m.key);
                  const metricColor =
                    m.key === "roi"     ? "text-blue-500" :
                    m.key === "refund"  ? "text-red-400"  :
                    m.key === "adSpend" ? "text-violet-500" : "text-gray-500";

                  return (
                    <tr key={`${plat}-${m.key}`}
                      className={cn("transition-colors hover:bg-gray-50/60",
                        last ? "border-b-2 border-gray-200" : "border-b border-gray-50")}>

                      {/* 平台名称列（仅第一指标行显示） */}
                      <td className={cn("sticky left-0 z-10 border-r border-gray-100 py-2 px-3 whitespace-nowrap",
                        last && "border-b-2 border-gray-200")}
                        style={{ width: COL_PLAT, background: first ? `${pc}18` : "white" }}>
                        {first ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: pc }} />
                            <span className="font-bold text-gray-800 text-[11px]">{plat}</span>
                          </div>
                        ) : null}
                      </td>

                      {/* 指标标签列 */}
                      <td className={cn("sticky z-10 border-r border-gray-100 py-2 px-3 whitespace-nowrap", metricColor,
                        last && "border-b-2 border-gray-200")}
                        style={{ left: COL_PLAT, width: COL_METRIC, background: "white" }}>
                        {m.label}
                      </td>

                      {/* 日期数据列 */}
                      {dKeys.map(dk => {
                        const v  = cellVal(plat, m.key, dk);
                        const we = month ? isWE(year, monthInt, parseInt(dk)) : false;
                        const vc =
                          v === 0         ? "text-gray-200" :
                          m.key === "roi" ? (v >= 4 ? "text-green-600 font-bold" : v >= 2 ? "text-blue-600" : v >= 1 ? "text-gray-700" : "text-red-400") :
                          m.key === "refund"  ? "text-red-500"    :
                          m.key === "adSpend" ? "text-violet-600" : "text-gray-800";
                        return (
                          <td key={dk} className={cn("py-1.5 px-0.5 text-center whitespace-nowrap border-l border-gray-50",
                            we && "bg-orange-50/25")}>
                            <span className={vc}>{cellFmt(v, m.key)}</span>
                          </td>
                        );
                      })}

                      {/* 合计列 */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap bg-violet-50/40 border-l-2 border-violet-100">
                        <span className={cn("font-semibold",
                          total === 0         ? "text-gray-300" :
                          m.key === "roi"     ? (total >= 4 ? "text-green-600" : total >= 2 ? "text-blue-600" : "text-gray-600") :
                          m.key === "refund"  ? "text-red-500"   :
                          m.key === "adSpend" ? "text-violet-600" : "text-violet-700"
                        )}>{cellFmt(total, m.key)}</span>
                      </td>
                    </tr>
                  );
                });
              })}

              {/* ── 汇总区 ── */}
              <SummRow label="电商销售小计" sub="销售额"  dKeys={dKeys} vals={dk=>daySum[dk]?.gmv||0}    tot={gGmv}    fmt={money} type="orange" month={month} year={year} mi={monthInt} />
              <SummRow label="推广费合计"   sub="推广费"  dKeys={dKeys} vals={dk=>daySum[dk]?.adSpend||0} tot={gAd}     fmt={money} type="violet" month={month} year={year} mi={monthInt} />
              <SummRow label="综合ROI"      sub="ROI"     dKeys={dKeys}
                vals={dk=>{ const s=daySum[dk]; return s?.adSpend>0 ? s.gmv/s.adSpend : 0; }}
                tot={gRoi} fmt={roi} type="blue" month={month} year={year} mi={monthInt} />
              <SummRow label="实际销售额"   sub="减退货"  dKeys={dKeys}
                vals={dk=>{ const s=daySum[dk]; return (s?.gmv||0)-(s?.refund||0); }}
                tot={gActual} fmt={money} type="emerald" month={month} year={year} mi={monthInt} last />

            </tbody>
          </table>
        </div>
      </div>

      {/* ── 达人 & 内容明细 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KolDetail kols={data?.kols || []} loading={loading} />
        <ContentDetail content={data?.content || []} loading={loading} />
      </div>
      <div className="h-8" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  汇总行
// ══════════════════════════════════════════════════════════
function SummRow({
  label, sub, dKeys, vals, tot, fmt: fmtFn, type, month, year, mi, last
}: {
  label: string; sub: string;
  dKeys: string[]; vals: (k: string) => number;
  tot: number; fmt: (n: number) => string;
  type: "orange"|"violet"|"blue"|"emerald";
  month: string; year: number; mi: number;
  last?: boolean;
}) {
  const bg  = { orange:"bg-orange-50/70", violet:"bg-violet-50/70", blue:"bg-blue-50/70", emerald:"bg-emerald-50/80" }[type];
  const tc  = { orange:"text-orange-800", violet:"text-violet-800", blue:"text-blue-700",  emerald:"text-emerald-800" }[type];
  const bdr = last ? "border-b-2 border-gray-400" : "border-b border-gray-100";
  return (
    <tr className={cn(bg, bdr)}>
      <td className={cn("sticky left-0 z-10 border-r border-gray-200 py-2.5 px-3 font-black whitespace-nowrap", bg, tc, last && "border-b-2 border-gray-400")}
        style={{ width: COL_PLAT }}>
        {label}
      </td>
      <td className={cn("sticky z-10 border-r border-gray-200 py-2.5 px-3 whitespace-nowrap font-semibold", bg, tc, last && "border-b-2 border-gray-400")}
        style={{ left: COL_PLAT, width: COL_METRIC }}>
        {sub}
      </td>
      {dKeys.map(dk => {
        const v  = vals(dk);
        const we = month ? isWE(year, mi, parseInt(dk)) : false;
        return (
          <td key={dk} className={cn("py-2 px-0.5 text-center text-xs whitespace-nowrap border-l border-gray-100",
            we && "bg-orange-100/30")}>
            <span className={cn("font-semibold", v > 0 ? tc : "text-gray-300")}>
              {v > 0 ? fmtFn(v) : "—"}
            </span>
          </td>
        );
      })}
      <td className="py-2.5 px-2 text-center bg-yellow-50 border-l-2 border-yellow-300">
        <span className={cn("text-xs font-black", tot > 0 ? tc : "text-gray-300")}>
          {tot > 0 ? fmtFn(tot) : "—"}
        </span>
      </td>
    </tr>
  );
}

// ══════════════════════════════════════════════════════════
//  通用子组件
// ══════════════════════════════════════════════════════════
function KCard({ label, val, sub, c, loading }: { label:string; val:string; sub:string; c:string; loading:boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {loading ? (
        <><div className="h-6 w-20 bg-gray-100 rounded animate-pulse mb-1" /><div className="h-3 w-14 bg-gray-50 rounded animate-pulse" /></>
      ) : (
        <><p className={cn("text-xl font-bold", c)}>{val}</p><p className="text-xs text-gray-400 mt-0.5">{sub}</p></>
      )}
    </div>
  );
}
function Sel({ value, onChange, children }: { value:string; onChange:(v:string)=>void; children:React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm text-gray-700 cursor-pointer focus:outline-none focus:border-violet-400">
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
    </div>
  );
}
function KolDetail({ kols, loading }: { kols:KolRow[]; loading:boolean }) {
  const SC: Record<string,string> = { 合作中:"bg-green-100 text-green-700", 洽谈中:"bg-blue-100 text-blue-700", 待联系:"bg-amber-100 text-amber-700", 已完成:"bg-gray-100 text-gray-500" };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800">达人明细</p>
        <p className="text-xs text-gray-400">当前筛选期间达人列表</p>
      </div>
      <div className="overflow-x-auto">
        {loading ? <div className="p-4 space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-8 bg-gray-50 rounded animate-pulse"/>)}</div>
        : kols.length===0 ? <p className="text-sm text-gray-400 text-center py-10">暂无达人数据</p>
        : <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-xs text-gray-500">
              <th className="py-2 px-4 text-left font-medium">达人名称</th>
              <th className="py-2 px-4 text-left font-medium">平台</th>
              <th className="py-2 px-4 text-right font-medium">粉丝数</th>
              <th className="py-2 px-4 text-center font-medium">状态</th>
              <th className="py-2 px-4 text-right font-medium">报价（元）</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {kols.slice(0,8).map(k=>(
                <tr key={k.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-4 font-medium text-gray-800">{k.name}</td>
                  <td className="py-2.5 px-4 text-xs text-gray-500">{k.platform}</td>
                  <td className="py-2.5 px-4 text-right text-xs text-gray-500">{k.fans_count?(k.fans_count>=10000?`${(k.fans_count/10000).toFixed(1)}万`:String(k.fans_count)):"—"}</td>
                  <td className="py-2.5 px-4 text-center"><span className={cn("text-xs px-2 py-0.5 rounded-full",SC[k.status]||"bg-gray-100 text-gray-400")}>{k.status||"—"}</span></td>
                  <td className="py-2.5 px-4 text-right text-gray-600">{k.fee?`¥${k.fee>=10000?(k.fee/10000).toFixed(1)+"万":k.fee.toLocaleString()}`:"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>}
      </div>
      {kols.length>8&&<p className="text-xs text-gray-400 text-center py-2">共 {kols.length} 位达人</p>}
    </div>
  );
}
function ContentDetail({ content, loading }: { content:ContentR[]; loading:boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800">内容明细</p>
        <p className="text-xs text-gray-400">按播放量排序 · 前 8 条</p>
      </div>
      <div className="overflow-x-auto">
        {loading ? <div className="p-4 space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-8 bg-gray-50 rounded animate-pulse"/>)}</div>
        : content.length===0 ? <p className="text-sm text-gray-400 text-center py-10">暂无内容数据</p>
        : <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-xs text-gray-500">
              <th className="py-2 px-4 text-left font-medium w-6">#</th>
              <th className="py-2 px-4 text-left font-medium">内容标题</th>
              <th className="py-2 px-4 text-left font-medium">平台</th>
              <th className="py-2 px-4 text-right font-medium">播放量</th>
              <th className="py-2 px-4 text-right font-medium">点赞</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {content.slice(0,8).map((c,i)=>(
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-4 text-xs text-gray-400">{i+1}</td>
                  <td className="py-2.5 px-4 font-medium text-gray-800 max-w-[180px] truncate">{c.title}</td>
                  <td className="py-2.5 px-4 text-xs text-gray-500">{c.platform}</td>
                  <td className="py-2.5 px-4 text-right text-gray-700 font-medium">{c.views?(c.views>=10000?`${(c.views/10000).toFixed(1)}万`:c.views.toLocaleString()):"—"}</td>
                  <td className="py-2.5 px-4 text-right text-xs text-gray-500">{c.likes?(c.likes>=10000?`${(c.likes/10000).toFixed(1)}万`:c.likes.toLocaleString()):"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>}
      </div>
      {content.length>8&&<p className="text-xs text-gray-400 text-center py-2">共 {content.length} 条内容</p>}
    </div>
  );
}
