"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Upload,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  ShoppingCart,
  Megaphone,
  BarChart3,
  Users,
  FileVideo,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORM_COLORS: Record<string, string> = {
  天猫: "#f97316",
  京东: "#ef4444",
  抖音: "#ec4899",
  小红书: "#f43f5e",
  视频号: "#22c55e",
  渠道分销: "#8b5cf6",
  其他: "#94a3b8",
};

const PLATFORM_BG: Record<string, string> = {
  天猫: "bg-orange-50 text-orange-700",
  京东: "bg-red-50 text-red-700",
  抖音: "bg-pink-50 text-pink-700",
  小红书: "bg-rose-50 text-rose-700",
  视频号: "bg-green-50 text-green-700",
  渠道分销: "bg-violet-50 text-violet-700",
  其他: "bg-gray-50 text-gray-500",
};

function formatMoney(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}千万`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n === 0) return "0";
  return n.toLocaleString();
}
function formatNum(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

interface KPIs {
  totalGMV: number;
  totalOrders: number;
  totalAdSpend: number;
  roi: number;
  totalKolSpend: number;
  avgKolRoi: number;
  contentCount: number;
  totalViews: number;
}
interface PlatformData {
  platform: string;
  color: string;
  gmv: number;
  orders: number;
  adSpend: number;
}
interface KolRow {
  id: string;
  name: string;
  platform: string;
  fans_count: number;
  status: string;
  fee: number;
}
interface KolCoop {
  id: string;
  fee: number;
  roi: number;
  actual_views: number;
  status: string;
  start_date: string;
}
interface ContentRow {
  id: string;
  title: string;
  platform: string;
  status: string;
  publish_date: string;
  views: number;
  likes: number;
  comments: number;
}
interface DataResponse {
  kpis: KPIs;
  byPlatform: PlatformData[];
  chartData: Record<string, string | number>[];
  kols: KolRow[];
  kolCoops: KolCoop[];
  content: ContentRow[];
  hasData: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const MONTHS = [
  { value: "", label: "全年" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}月`,
  })),
];

export default function DataPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState("");
  const [data, setData] = useState<DataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (month) params.set("month", month);
      const res = await fetch(`/api/data/sales?${params}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/data/import", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setImportResult({ ok: true, msg: json.message || "导入成功" });
        fetchData();
      } else {
        setImportResult({ ok: false, msg: json.error || "导入失败" });
      }
    } catch {
      setImportResult({ ok: false, msg: "网络错误，请重试" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const kpis = data?.kpis;
  const byPlatform = data?.byPlatform || [];
  const chartData = data?.chartData || [];
  const kols = data?.kols || [];
  const kolCoops = data?.kolCoops || [];
  const content = data?.content || [];
  const hasData = data?.hasData || false;
  const activePlatforms = byPlatform.map((p) => p.platform);
  const totalGMV = byPlatform.reduce((s, p) => s + p.gmv, 0);
  const totalOrders = byPlatform.reduce((s, p) => s + p.orders, 0);
  const totalAdSpend = byPlatform.reduce((s, p) => s + p.adSpend, 0);

  // Content platform counts
  const contentByPlatform = content.reduce((acc, c) => {
    acc[c.platform] = (acc[c.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 min-h-screen bg-gray-50 space-y-5">

      {/* ── 顶部标题栏 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-violet-600" />
            数据中心
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">经营数据全览 · 实时同步</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm text-gray-700 cursor-pointer focus:outline-none focus:border-violet-400">
              {YEARS.map((y) => <option key={y} value={y}>{y}年</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={month} onChange={(e) => setMonth(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm text-gray-700 cursor-pointer focus:outline-none focus:border-violet-400">
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />刷新
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm cursor-pointer hover:bg-violet-700 transition">
            {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            导入Excel
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={handleImport} disabled={importing} />
          </label>
        </div>
      </div>

      {/* 导入结果提示 */}
      {importResult && (
        <div className={cn("flex items-center gap-2 px-4 py-3 rounded-xl text-sm",
          importResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200")}>
          {importResult.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {importResult.msg}
          <button onClick={() => setImportResult(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 暂无数据提示 */}
      {!loading && !hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            当前时间范围暂无销售数据，点击右上角「导入Excel」上传历史数据（.xlsx/.xls 格式）。
          </p>
        </div>
      )}

      {/* ══════════════════════════════════
          第一区块：核心指标汇总
      ══════════════════════════════════ */}
      <Section title="核心指标" subtitle={`${year}年${month ? month + "月" : "全年"} 汇总`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="总销售额（GMV）" value={loading ? null : `¥${formatMoney(totalGMV)}`}
            sub="元" color="violet" icon={<TrendingUp size={16} />} />
          <KpiCard label="总订单数" value={loading ? null : formatNum(totalOrders)}
            sub="单" color="blue" icon={<ShoppingCart size={16} />} />
          <KpiCard label="总推广费" value={loading ? null : `¥${formatMoney(totalAdSpend)}`}
            sub="元" color="pink" icon={<Megaphone size={16} />} />
          <KpiCard label="综合 ROI"
            value={loading ? null : (kpis && kpis.roi > 0 ? `${kpis.roi}x` : "—")}
            sub="销售额 ÷ 推广费" color="green" icon={<BarChart3 size={16} />} />
        </div>
      </Section>

      {/* ══════════════════════════════════
          第二区块：各平台销售额趋势（折线图）
      ══════════════════════════════════ */}
      <Section title="各平台销售额趋势" subtitle={`折线图 · ${month ? "按日" : "按月"}查看 · 单位：元`}>
        {loading ? (
          <div className="h-60 bg-gray-50 rounded-xl animate-pulse" />
        ) : chartData.length === 0 ? (
          <EmptyHint text="暂无数据，请导入 Excel 文件" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => formatMoney(v)} width={52} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`¥${formatMoney(Number(value))}`]}
                labelStyle={{ fontSize: 12, color: "#374151" }}
                contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
              {activePlatforms.map((plat) => (
                <Line key={plat} type="monotone" dataKey={plat}
                  stroke={PLATFORM_COLORS[plat] || "#94a3b8"} strokeWidth={2}
                  dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ══════════════════════════════════
          第三区块：各平台销售明细表
      ══════════════════════════════════ */}
      <Section title="各平台销售明细" subtitle="销售额 / 订单数 / 推广费 / 占比">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : byPlatform.length === 0 ? (
          <EmptyHint text="暂无数据" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <Th align="left">平台</Th>
                  <Th>销售额（元）</Th>
                  <Th>订单数（单）</Th>
                  <Th>推广费（元）</Th>
                  <Th>ROI</Th>
                  <Th>GMV 占比</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byPlatform.map((p) => {
                  const pct = totalGMV > 0 ? (p.gmv / totalGMV) * 100 : 0;
                  const pRoi = p.adSpend > 0 ? p.gmv / p.adSpend : 0;
                  return (
                    <tr key={p.platform} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }} />
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                            PLATFORM_BG[p.platform] || "bg-gray-50 text-gray-500")}>
                            {p.platform}
                          </span>
                        </div>
                      </td>
                      <Td bold>¥{formatMoney(p.gmv)}</Td>
                      <Td>{p.orders > 0 ? formatNum(p.orders) : "—"}</Td>
                      <Td>{p.adSpend > 0 ? `¥${formatMoney(p.adSpend)}` : "—"}</Td>
                      <Td>{pRoi > 0 ? `${pRoi.toFixed(2)}x` : "—"}</Td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* 合计行 */}
              <tfoot>
                <tr className="bg-violet-50 font-semibold text-sm border-t border-violet-100">
                  <td className="py-3 pl-4 text-violet-700">合计</td>
                  <Td bold className="text-violet-700">¥{formatMoney(totalGMV)}</Td>
                  <Td className="text-violet-700">{formatNum(totalOrders)}</Td>
                  <Td className="text-violet-700">¥{formatMoney(totalAdSpend)}</Td>
                  <Td className="text-violet-700">
                    {totalAdSpend > 0 ? `${(totalGMV / totalAdSpend).toFixed(2)}x` : "—"}
                  </Td>
                  <Td>100%</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════
          第四区块：推广费用明细
      ══════════════════════════════════ */}
      <Section title="推广费用分析" subtitle="各渠道推广投入">
        {loading ? (
          <SkeletonTable rows={4} />
        ) : byPlatform.filter(p => p.adSpend > 0).length === 0 ? (
          <EmptyHint text="暂无推广费数据（导入 Excel 时包含「推广费」列即可）" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <Th align="left">推广渠道</Th>
                  <Th>推广费（元）</Th>
                  <Th>带来 GMV（元）</Th>
                  <Th>ROI</Th>
                  <Th>费用占比</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byPlatform.filter(p => p.adSpend > 0).map((p) => {
                  const pct = totalAdSpend > 0 ? (p.adSpend / totalAdSpend) * 100 : 0;
                  const pRoi = p.adSpend > 0 ? p.gmv / p.adSpend : 0;
                  return (
                    <tr key={p.platform} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-gray-700 font-medium">{p.platform}</span>
                        </div>
                      </td>
                      <Td bold>¥{formatMoney(p.adSpend)}</Td>
                      <Td>¥{formatMoney(p.gmv)}</Td>
                      <td className="py-3 text-right pr-4">
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                          pRoi >= 3 ? "bg-green-100 text-green-700" :
                          pRoi >= 1.5 ? "bg-blue-100 text-blue-700" :
                          "bg-red-100 text-red-600")}>
                          {pRoi > 0 ? `${pRoi.toFixed(2)}x` : "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-pink-50 font-semibold text-sm border-t border-pink-100">
                  <td className="py-3 pl-4 text-pink-700">合计</td>
                  <Td bold className="text-pink-700">¥{formatMoney(totalAdSpend)}</Td>
                  <Td className="text-pink-700">¥{formatMoney(totalGMV)}</Td>
                  <Td className="text-pink-700">
                    {totalAdSpend > 0 ? `${(totalGMV / totalAdSpend).toFixed(2)}x` : "—"}
                  </Td>
                  <Td>100%</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════
          第五区块：达人营销汇总
      ══════════════════════════════════ */}
      <Section title="达人营销" subtitle="付费达人合作数据" icon={<Users size={15} className="text-violet-500" />}>
        {/* 指标行 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniCard label="达人总数" value={loading ? null : String(kols.length)} unit="位" />
          <MiniCard label="期间合作费用" value={loading ? null : (kpis ? `¥${formatMoney(kpis.totalKolSpend)}` : "—")} unit="元" />
          <MiniCard label="平均 ROI" value={loading ? null : (kpis && kpis.avgKolRoi > 0 ? `${kpis.avgKolRoi}x` : "—")} unit="" />
        </div>
        {/* 达人列表 */}
        {loading ? (
          <SkeletonTable rows={4} />
        ) : kols.length === 0 ? (
          <EmptyHint text="暂无达人数据，请在「达人管理」模块添加" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <Th align="left">达人名称</Th>
                  <Th align="left">平台</Th>
                  <Th>粉丝数</Th>
                  <Th>合作状态</Th>
                  <Th>报价（元）</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {kols.slice(0, 10).map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 pl-4 font-medium text-gray-800">{k.name}</td>
                    <td className="py-2.5 pl-4">
                      <span className="text-xs text-gray-500">{k.platform}</span>
                    </td>
                    <Td>{k.fans_count ? formatNum(k.fans_count) : "—"}</Td>
                    <td className="py-2.5 text-center">
                      <StatusBadge status={k.status} />
                    </td>
                    <Td>{k.fee ? `¥${formatMoney(k.fee)}` : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {kols.length > 10 && (
              <p className="text-xs text-gray-400 text-center py-2">
                共 {kols.length} 位达人，更多请前往「达人管理」查看
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════
          第六区块：内容运营汇总
      ══════════════════════════════════ */}
      <Section title="内容运营" subtitle="官方账号内容数据" icon={<FileVideo size={15} className="text-violet-500" />}>
        {/* 指标行 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniCard label="发布内容" value={loading ? null : String(content.length)} unit="篇" />
          <MiniCard label="总播放 / 阅读" value={loading ? null : (kpis ? formatNum(kpis.totalViews) : "—")} unit="" />
          <MiniCard label="覆盖平台" value={loading ? null : String(Object.keys(contentByPlatform).length)} unit="个" />
        </div>

        {/* 平台分布 */}
        {!loading && Object.keys(contentByPlatform).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(contentByPlatform).sort((a, b) => b[1] - a[1]).map(([plat, count]) => (
              <div key={plat} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[plat] || "#94a3b8" }} />
                <span className="text-gray-600">{plat}</span>
                <span className="font-semibold text-gray-800">{count}篇</span>
              </div>
            ))}
          </div>
        )}

        {/* 内容列表 */}
        {loading ? (
          <SkeletonTable rows={5} />
        ) : content.length === 0 ? (
          <EmptyHint text="暂无内容数据，请在「内容运营」模块添加" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <Th align="left" className="w-8">#</Th>
                  <Th align="left">内容标题</Th>
                  <Th align="left">平台</Th>
                  <Th>发布日期</Th>
                  <Th>播放 / 阅读</Th>
                  <Th>点赞</Th>
                  <Th>评论</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {content.slice(0, 10).map((c, i) => (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 pl-4 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2.5 pl-2 font-medium text-gray-800 max-w-[240px] truncate">{c.title}</td>
                    <td className="py-2.5 pl-2">
                      <span className="text-xs" style={{ color: PLATFORM_COLORS[c.platform] || "#94a3b8" }}>
                        {c.platform}
                      </span>
                    </td>
                    <Td>{c.publish_date || "—"}</Td>
                    <Td bold>{c.views ? formatNum(c.views) : "—"}</Td>
                    <Td>{c.likes ? formatNum(c.likes) : "—"}</Td>
                    <Td>{c.comments ? formatNum(c.comments) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {content.length > 10 && (
              <p className="text-xs text-gray-400 text-center py-2">
                共 {content.length} 条内容，更多请前往「内容运营」查看
              </p>
            )}
          </div>
        )}
      </Section>

      {/* 底部留白 */}
      <div className="h-6" />
    </div>
  );
}

// ── 通用组件 ──────────────────────────────────

function Section({
  title, subtitle, children, icon,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
        {icon}
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KpiCard({
  label, value, sub, color, icon,
}: {
  label: string;
  value: string | null;
  sub: string;
  color: "violet" | "blue" | "pink" | "green";
  icon: React.ReactNode;
}) {
  const cm = {
    violet: { bg: "bg-violet-50", text: "text-violet-700", icon: "text-violet-400", sub: "text-violet-400" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-400", sub: "text-blue-400" },
    pink: { bg: "bg-pink-50", text: "text-pink-700", icon: "text-pink-400", sub: "text-pink-400" },
    green: { bg: "bg-green-50", text: "text-green-700", icon: "text-green-400", sub: "text-green-400" },
  }[color];
  return (
    <div className={cn("rounded-xl p-4", cm.bg)}>
      <div className="flex items-center justify-between mb-2">
        <p className={cn("text-xs font-medium", cm.sub)}>{label}</p>
        <span className={cm.icon}>{icon}</span>
      </div>
      {value === null ? (
        <div className="h-7 w-20 bg-current opacity-10 rounded animate-pulse" />
      ) : (
        <p className={cn("text-xl font-bold", cm.text)}>{value}</p>
      )}
      <p className={cn("text-xs mt-1", cm.sub)}>{sub}</p>
    </div>
  );
}

function MiniCard({ label, value, unit }: { label: string; value: string | null; unit: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {value === null ? (
        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
      ) : (
        <p className="text-base font-bold text-gray-800">
          {value} <span className="text-xs font-normal text-gray-400">{unit}</span>
        </p>
      )}
    </div>
  );
}

function Th({ children, align = "right", className }: {
  children?: React.ReactNode; align?: "left" | "right" | "center"; className?: string;
}) {
  return (
    <th className={cn("py-2.5 px-4 font-medium whitespace-nowrap",
      align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right",
      className)}>
      {children}
    </th>
  );
}

function Td({ children, bold, className }: {
  children?: React.ReactNode; bold?: boolean; className?: string;
}) {
  return (
    <td className={cn("py-2.5 px-4 text-right text-gray-600 whitespace-nowrap",
      bold && "font-semibold text-gray-800", className)}>
      {children}
    </td>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    合作中: "bg-green-100 text-green-700",
    洽谈中: "bg-blue-100 text-blue-700",
    待联系: "bg-amber-100 text-amber-700",
    已完成: "bg-gray-100 text-gray-500",
    已拒绝: "bg-red-100 text-red-500",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
      map[status] || "bg-gray-100 text-gray-400")}>
      {status || "—"}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-gray-400">{text}</div>
  );
}

function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
