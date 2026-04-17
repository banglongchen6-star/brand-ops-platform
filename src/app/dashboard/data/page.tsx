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
  TrendingUp,
  Users,
  FileVideo,
  GitBranch,
  Download,
  Upload,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShoppingCart,
  Megaphone,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "sales" | "kol" | "content" | "channel";

const PLATFORM_COLORS: Record<string, string> = {
  天猫: "#f97316",
  京东: "#ef4444",
  抖音: "#ec4899",
  小红书: "#f43f5e",
  视频号: "#22c55e",
  渠道分销: "#8b5cf6",
  其他: "#94a3b8",
};

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "sales", label: "销售看板", icon: <TrendingUp size={15} /> },
  { key: "kol", label: "达人营销", icon: <Users size={15} /> },
  { key: "content", label: "内容运营", icon: <FileVideo size={15} /> },
  { key: "channel", label: "渠道分销", icon: <GitBranch size={15} /> },
];

function formatMoney(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}千万`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
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
  kol_id: string;
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
  const [activeTab, setActiveTab] = useState<Tab>("sales");
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
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Active platforms for chart lines
  const activePlatforms = byPlatform.map((p) => p.platform);

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={24} className="text-violet-600" />
            数据中心
          </h1>
          <p className="text-sm text-gray-500 mt-1">统一汇总销售、达人、内容、渠道数据</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year selector */}
          <div className="relative">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 cursor-pointer focus:outline-none focus:border-violet-400"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Month selector */}
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 cursor-pointer focus:outline-none focus:border-violet-400"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            刷新
          </button>

          {/* Import Excel */}
          <label className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm cursor-pointer hover:bg-violet-700 transition">
            {importing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            导入Excel
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
        </div>
      </div>

      {/* Import result toast */}
      {importResult && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm",
            importResult.ok
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          )}
        >
          {importResult.ok ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {importResult.msg}
          <button
            onClick={() => setImportResult(null)}
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* No data banner */}
      {!loading && !hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-700">
            <span className="font-medium">暂无数据</span> — 当前筛选条件下没有销售数据。
            点击右上角「导入Excel」上传历史数据（支持.xlsx/.xls格式）。
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="总销售额"
          value={kpis ? `¥${formatMoney(kpis.totalGMV)}` : "—"}
          sub={kpis && kpis.totalGMV > 0 ? "元" : "暂无数据"}
          color="violet"
          icon={<TrendingUp size={18} />}
          loading={loading}
        />
        <KpiCard
          label="总订单数"
          value={kpis ? formatNum(kpis.totalOrders) : "—"}
          sub="单"
          color="blue"
          icon={<ShoppingCart size={18} />}
          loading={loading}
        />
        <KpiCard
          label="总推广费"
          value={kpis ? `¥${formatMoney(kpis.totalAdSpend)}` : "—"}
          sub="元"
          color="pink"
          icon={<Megaphone size={18} />}
          loading={loading}
        />
        <KpiCard
          label="综合ROI"
          value={kpis ? (kpis.roi > 0 ? `${kpis.roi}x` : "—") : "—"}
          sub={kpis && kpis.roi > 0 ? "销售额/推广费" : "暂无数据"}
          color="green"
          icon={<BarChart3 size={18} />}
          loading={loading}
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === tab.key
                  ? "border-violet-600 text-violet-600 bg-violet-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "sales" && (
            <SalesTab
              loading={loading}
              chartData={chartData}
              byPlatform={byPlatform}
              activePlatforms={activePlatforms}
              isMonthView={!!month}
            />
          )}
          {activeTab === "kol" && (
            <KolTab
              loading={loading}
              kols={kols}
              kolCoops={kolCoops}
              kpis={kpis}
            />
          )}
          {activeTab === "content" && (
            <ContentTab
              loading={loading}
              content={content}
              kpis={kpis}
            />
          )}
          {activeTab === "channel" && (
            <ChannelTab
              loading={loading}
              byPlatform={byPlatform}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- KPI Card ----

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  color: "violet" | "blue" | "pink" | "green";
  icon: React.ReactNode;
  loading: boolean;
}) {
  const colorMap = {
    violet: { bg: "bg-violet-50", text: "text-violet-700", icon: "text-violet-500", sub: "text-violet-400" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500", sub: "text-blue-400" },
    pink: { bg: "bg-pink-50", text: "text-pink-700", icon: "text-pink-500", sub: "text-pink-400" },
    green: { bg: "bg-green-50", text: "text-green-700", icon: "text-green-500", sub: "text-green-400" },
  };
  const c = colorMap[color];
  return (
    <div className={cn("rounded-xl p-4", c.bg)}>
      <div className="flex items-center justify-between mb-2">
        <p className={cn("text-xs font-medium", c.sub)}>{label}</p>
        <span className={cn(c.icon)}>{icon}</span>
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-current opacity-10 rounded animate-pulse" />
      ) : (
        <p className={cn("text-2xl font-bold", c.text)}>{value}</p>
      )}
      <p className={cn("text-xs mt-1", c.sub)}>{sub}</p>
    </div>
  );
}

// ---- Sales Tab ----

function SalesTab({
  loading,
  chartData,
  byPlatform,
  activePlatforms,
  isMonthView,
}: {
  loading: boolean;
  chartData: Record<string, string | number>[];
  byPlatform: PlatformData[];
  activePlatforms: string[];
  isMonthView: boolean;
}) {
  const totalGMV = byPlatform.reduce((s, p) => s + p.gmv, 0);
  const totalOrders = byPlatform.reduce((s, p) => s + p.orders, 0);

  return (
    <div className="space-y-6">
      {/* Line Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          各平台销售额趋势（元）
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          {isMonthView ? "按日查看" : "按月查看"}
        </p>
        {loading ? (
          <div className="h-56 bg-gray-50 rounded-lg animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-gray-400">
            暂无数据，请导入Excel或添加记录
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatMoney(v)}
                width={55}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`¥${formatMoney(Number(value))}`]}
                labelStyle={{ fontSize: 12, color: "#374151" }}
                contentStyle={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              {activePlatforms.map((plat) => (
                <Line
                  key={plat}
                  type="monotone"
                  dataKey={plat}
                  stroke={PLATFORM_COLORS[plat] || "#94a3b8"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Platform breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">各平台汇总</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : byPlatform.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">暂无数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 text-xs text-gray-400 font-medium pr-4">平台</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right pr-4">销售额</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right pr-4">订单数</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right pr-4">推广费</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">占比</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byPlatform.map((p) => (
                  <tr key={p.platform}>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-medium text-gray-700">{p.platform}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right pr-4 text-gray-700 font-medium">
                      ¥{formatMoney(p.gmv)}
                    </td>
                    <td className="py-2.5 text-right pr-4 text-gray-500">
                      {formatNum(p.orders)}
                    </td>
                    <td className="py-2.5 text-right pr-4 text-gray-500">
                      {p.adSpend > 0 ? `¥${formatMoney(p.adSpend)}` : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${totalGMV > 0 ? (p.gmv / totalGMV) * 100 : 0}%`,
                              backgroundColor: p.color,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-9 text-right">
                          {totalGMV > 0 ? `${((p.gmv / totalGMV) * 100).toFixed(1)}%` : "0%"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="font-semibold">
                  <td className="pt-3 pb-1 text-gray-800">合计</td>
                  <td className="pt-3 pb-1 text-right text-violet-700">
                    ¥{formatMoney(totalGMV)}
                  </td>
                  <td className="pt-3 pb-1 text-right text-gray-600">
                    {formatNum(totalOrders)}
                  </td>
                  <td className="pt-3 pb-1 text-right text-gray-500">
                    ¥{formatMoney(byPlatform.reduce((s, p) => s + p.adSpend, 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- KOL Tab ----

function KolTab({
  loading,
  kols,
  kolCoops,
  kpis,
}: {
  loading: boolean;
  kols: KolRow[];
  kolCoops: KolCoop[];
  kpis: KPIs | undefined;
}) {
  const STATUS_COLORS: Record<string, string> = {
    合作中: "bg-green-100 text-green-700",
    洽谈中: "bg-blue-100 text-blue-700",
    待联系: "bg-amber-100 text-amber-700",
    已完成: "bg-gray-100 text-gray-500",
    已拒绝: "bg-red-100 text-red-500",
  };

  const platformCounts = kols.reduce(
    (acc, k) => {
      acc[k.platform] = (acc[k.platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* KOL summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-violet-50 rounded-xl p-4">
          <p className="text-xs text-violet-500 mb-1">达人总数</p>
          <p className="text-2xl font-bold text-violet-700">{loading ? "—" : kols.length}</p>
        </div>
        <div className="bg-pink-50 rounded-xl p-4">
          <p className="text-xs text-pink-500 mb-1">期间合作费用</p>
          <p className="text-2xl font-bold text-pink-700">
            {loading ? "—" : kpis ? `¥${formatMoney(kpis.totalKolSpend)}` : "—"}
          </p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs text-amber-600 mb-1">平均ROI</p>
          <p className="text-2xl font-bold text-amber-600">
            {loading ? "—" : kpis && kpis.avgKolRoi > 0 ? `${kpis.avgKolRoi}x` : "—"}
          </p>
        </div>
      </div>

      {/* Platform distribution */}
      {!loading && Object.keys(platformCounts).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">平台分布</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(platformCounts).map(([plat, count]) => (
              <div
                key={plat}
                className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PLATFORM_COLORS[plat] || "#94a3b8" }}
                />
                <span className="text-sm text-gray-700">{plat}</span>
                <span className="text-sm font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KOL list */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">达人列表</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : kols.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            暂无达人数据，请在「达人管理」模块添加
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-50">
                  <th className="pb-2 text-xs text-gray-400 font-medium">达人名称</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium">平台</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">粉丝数</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-center">状态</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">报价</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {kols.slice(0, 15).map((k) => (
                  <tr key={k.id}>
                    <td className="py-2.5 font-medium text-gray-800">{k.name}</td>
                    <td className="py-2.5">
                      <span className="text-xs text-gray-500">{k.platform}</span>
                    </td>
                    <td className="py-2.5 text-right text-gray-500">
                      {k.fans_count ? formatNum(k.fans_count) : "—"}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          STATUS_COLORS[k.status] || "bg-gray-100 text-gray-500"
                        )}
                      >
                        {k.status || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-gray-500">
                      {k.fee ? `¥${formatMoney(k.fee)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {kols.length > 15 && (
              <p className="text-xs text-gray-400 text-center pt-3">
                共 {kols.length} 位达人，更多请前往「达人管理」查看
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Content Tab ----

function ContentTab({
  loading,
  content,
  kpis,
}: {
  loading: boolean;
  content: ContentRow[];
  kpis: KPIs | undefined;
}) {
  const platformCounts = content.reduce(
    (acc, c) => {
      acc[c.platform] = (acc[c.platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const maxCount = Math.max(...Object.values(platformCounts), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-violet-50 rounded-xl p-4">
          <p className="text-xs text-violet-500 mb-1">期间发布内容</p>
          <p className="text-2xl font-bold text-violet-700">
            {loading ? "—" : kpis?.contentCount || content.length}
          </p>
        </div>
        <div className="bg-pink-50 rounded-xl p-4">
          <p className="text-xs text-pink-500 mb-1">总播放 / 阅读</p>
          <p className="text-2xl font-bold text-pink-700">
            {loading ? "—" : kpis ? formatNum(kpis.totalViews) : "—"}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 mb-1">覆盖平台</p>
          <p className="text-2xl font-bold text-blue-700">
            {loading ? "—" : Object.keys(platformCounts).length || "—"}
          </p>
        </div>
      </div>

      {/* Platform distribution */}
      {!loading && Object.keys(platformCounts).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">平台内容分布</h3>
          <div className="space-y-3">
            {Object.entries(platformCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([plat, count]) => (
                <div key={plat}>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>{plat}</span>
                    <span className="font-medium">{count} 篇</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        backgroundColor: PLATFORM_COLORS[plat] || "#8b5cf6",
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Content list */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          高播放内容 TOP {Math.min(content.length, 10)}
        </h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : content.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            暂无内容数据，请在「内容运营」模块添加
          </p>
        ) : (
          <div className="space-y-0 divide-y divide-gray-50">
            {content.slice(0, 10).map((c, i) => (
              <div key={c.id} className="flex items-start gap-3 py-3">
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                    i === 0
                      ? "bg-yellow-100 text-yellow-700"
                      : i === 1
                      ? "bg-gray-100 text-gray-600"
                      : i === 2
                      ? "bg-orange-100 text-orange-600"
                      : "bg-gray-50 text-gray-400"
                  )}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                  <p className="text-xs text-gray-400">
                    {c.platform}
                    {c.publish_date && ` · ${c.publish_date}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-700">
                    {c.views ? formatNum(c.views) : "—"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {c.likes ? `${formatNum(c.likes)}赞` : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Channel Tab ----

function ChannelTab({
  loading,
  byPlatform,
}: {
  loading: boolean;
  byPlatform: PlatformData[];
}) {
  // Show 渠道分销 platform data + import guide
  const channelData = byPlatform.find((p) => p.platform === "渠道分销");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-violet-50 rounded-xl p-4">
          <p className="text-xs text-violet-500 mb-1">渠道销售额</p>
          <p className="text-2xl font-bold text-violet-700">
            {loading ? "—" : channelData ? `¥${formatMoney(channelData.gmv)}` : "—"}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 mb-1">渠道订单数</p>
          <p className="text-2xl font-bold text-blue-700">
            {loading ? "—" : channelData ? formatNum(channelData.orders) : "—"}
          </p>
        </div>
      </div>

      {/* All platform GMV breakdown for channels */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          各平台销售明细
        </h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : byPlatform.length === 0 ? (
          <div className="text-center py-8">
            <Upload size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium mb-1">暂无销售数据</p>
            <p className="text-xs text-gray-400">
              点击右上角「导入Excel」上传历史数据
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {byPlatform.map((p) => {
              const total = byPlatform.reduce((s, x) => s + x.gmv, 0);
              const pct = total > 0 ? (p.gmv / total) * 100 : 0;
              return (
                <div key={p.platform}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-gray-700">{p.platform}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">
                        {formatNum(p.orders)} 单
                      </span>
                      <span className="font-semibold text-gray-800">
                        ¥{formatMoney(p.gmv)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: p.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Import guide */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
        <div className="flex items-start gap-3">
          <Download size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-700 mb-1">如何导入历史数据</p>
            <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
              <li>Excel文件需包含：日期、平台、销售额（GMV）等列</li>
              <li>日期格式支持：2026-01-15、2026/1/15、2026.1.15</li>
              <li>平台名称支持：天猫、京东、抖音、小红书、视频号、渠道分销</li>
              <li>支持多个Sheet页，按Sheet页自动识别平台</li>
              <li>已有数据会按「日期+平台」自动去重更新</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
