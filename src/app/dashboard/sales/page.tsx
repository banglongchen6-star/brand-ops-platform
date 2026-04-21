"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  Plus,
  Loader2,
  X,
  Pencil,
  Trash2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  RotateCcw,
  Megaphone,
  Check,
} from "lucide-react";
import { supabase, platformLabels } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface SalesRecord {
  id: string;
  platform: string | null;
  date: string | null;
  gmv: number | null;
  order_count: number | null;
  refund_amount: number | null;
  ad_spend: number | null;
  visitor_count: number | null;
  created_at: string | null;
}

type DateRange = "week" | "month" | "custom";

const platformList = [
  { value: "all", label: "全部" },
  { value: "tianmao", label: "天猫" },
  { value: "jingdong", label: "京东" },
  { value: "douyin", label: "抖音" },
  { value: "pinduoduo", label: "拼多多" },
];

const platformColors: Record<string, string> = {
  tianmao: "bg-red-100 text-red-700",
  jingdong: "bg-red-100 text-red-700",
  douyin: "bg-gray-900 text-white",
  pinduoduo: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

function fmt(n: number | null | undefined, prefix = "¥") {
  if (n == null) return "—";
  if (n >= 10000) return `${prefix}${(n / 10000).toFixed(1)}万`;
  return `${prefix}${n.toLocaleString()}`;
}

function getDateRange(range: DateRange, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  if (range === "week") {
    const day = now.getDay() || 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - day + 1);
    return { start: mon.toISOString().split("T")[0], end: today };
  }
  if (range === "month") {
    return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: today };
  }
  return { start: customStart || today, end: customEnd || today };
}

export default function SalesPage() {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformTab, setPlatformTab] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<SalesRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    platform: "tianmao",
    date: new Date().toISOString().split("T")[0],
    gmv: "",
    order_count: "",
    refund_amount: "",
    ad_spend: "",
    visitor_count: "",
  });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { start, end } = getDateRange(dateRange, customStart, customEnd);
    let query = supabase
      .from("sales_data")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });

    if (platformTab !== "all") {
      query = query.eq("platform", platformTab);
    }

    const { data, error } = await query;
    if (!error) setRecords(data || []);
    setLoading(false);
  }, [platformTab, dateRange, customStart, customEnd]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  function openCreate() {
    setEditRecord(null);
    setForm({
      platform: "tianmao",
      date: new Date().toISOString().split("T")[0],
      gmv: "",
      order_count: "",
      refund_amount: "",
      ad_spend: "",
      visitor_count: "",
    });
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(record: SalesRecord) {
    setEditRecord(record);
    setForm({
      platform: record.platform || "tianmao",
      date: record.date || "",
      gmv: record.gmv?.toString() || "",
      order_count: record.order_count?.toString() || "",
      refund_amount: record.refund_amount?.toString() || "",
      ad_spend: record.ad_spend?.toString() || "",
      visitor_count: record.visitor_count?.toString() || "",
    });
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const payload = {
      platform: form.platform,
      date: form.date,
      gmv: form.gmv ? parseFloat(form.gmv) : null,
      order_count: form.order_count ? parseInt(form.order_count) : null,
      refund_amount: form.refund_amount ? parseFloat(form.refund_amount) : null,
      ad_spend: form.ad_spend ? parseFloat(form.ad_spend) : null,
      visitor_count: form.visitor_count ? parseInt(form.visitor_count) : null,
    };

    let error;
    if (editRecord) {
      ({ error } = await supabase.from("sales_data").update(payload).eq("id", editRecord.id));
    } else {
      ({ error } = await supabase.from("sales_data").insert(payload));
    }

    if (error) {
      setFormError(error.message);
    } else {
      setShowModal(false);
      fetchRecords();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("sales_data").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchRecords();
  }

  // Aggregate stats
  const totalGMV = records.reduce((s, r) => s + (r.gmv || 0), 0);
  const totalOrders = records.reduce((s, r) => s + (r.order_count || 0), 0);
  const totalRefund = records.reduce((s, r) => s + (r.refund_amount || 0), 0);
  const totalAdSpend = records.reduce((s, r) => s + (r.ad_spend || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={24} className="text-violet-600" />
            电商销售
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">多平台销售数据录入与统计分析</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-sm"
        >
          <Plus size={16} />
          录入今日数据
        </button>
      </div>

      {/* Platform Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex gap-1">
        {platformList.map((p) => (
          <button
            key={p.value}
            onClick={() => setPlatformTab(p.value)}
            className={cn(
              "flex-1 text-sm font-medium py-2 rounded-xl transition",
              platformTab === p.value
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">时间范围</span>
        <div className="flex gap-1.5">
          {[
            { value: "week" as DateRange, label: "本周" },
            { value: "month" as DateRange, label: "本月" },
            { value: "custom" as DateRange, label: "自定义" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg transition",
                dateRange === opt.value
                  ? "bg-violet-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {dateRange === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-violet-400"
            />
            <span className="text-gray-400 text-xs">至</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-violet-400"
            />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "总GMV",
            value: fmt(totalGMV),
            icon: DollarSign,
            color: "text-violet-600",
            bg: "bg-violet-50",
            sub: `${records.length} 条记录`,
            trend: null,
          },
          {
            label: "总订单量",
            value: totalOrders.toLocaleString(),
            icon: Package,
            color: "text-blue-600",
            bg: "bg-blue-50",
            sub: "笔",
            trend: null,
          },
          {
            label: "退款总额",
            value: fmt(totalRefund),
            icon: RotateCcw,
            color: "text-red-500",
            bg: "bg-red-50",
            sub: totalGMV > 0 ? `退款率 ${((totalRefund / totalGMV) * 100).toFixed(1)}%` : "—",
            trend: null,
          },
          {
            label: "广告总花费",
            value: fmt(totalAdSpend),
            icon: Megaphone,
            color: "text-orange-600",
            bg: "bg-orange-50",
            sub: totalGMV > 0 ? `ROI ${(totalGMV / (totalAdSpend || 1)).toFixed(1)}x` : "—",
            trend: null,
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{s.label}</span>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon size={15} className={s.color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{s.value}</div>
            <div className="text-xs text-gray-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Platform Summary Bar */}
      {platformTab === "all" && records.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">各平台GMV占比</h3>
          <div className="space-y-3">
            {["tianmao", "jingdong", "douyin", "pinduoduo"].map((p) => {
              const pRecords = records.filter((r) => r.platform === p);
              const pGMV = pRecords.reduce((s, r) => s + (r.gmv || 0), 0);
              const pct = totalGMV > 0 ? (pGMV / totalGMV) * 100 : 0;
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full w-16 text-center shrink-0", platformColors[p] || "bg-gray-100 text-gray-600")}>
                    {platformLabels[p]}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-20 text-right shrink-0">{fmt(pGMV)}</span>
                  <span className="text-xs text-gray-400 w-10 text-right shrink-0">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">历史数据</h2>
          <span className="text-xs text-gray-400">共 {records.length} 条</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-violet-400" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ShoppingCart size={36} className="mb-3 text-gray-200" />
            <p className="text-sm">暂无数据，点击「录入今日数据」开始记录</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs text-gray-400 font-medium bg-gray-50">
              <div className="col-span-1">平台</div>
              <div className="col-span-2">日期</div>
              <div className="col-span-2 text-right">GMV</div>
              <div className="col-span-1 text-right">订单量</div>
              <div className="col-span-2 text-right">退款额</div>
              <div className="col-span-2 text-right">广告花费</div>
              <div className="col-span-1 text-right">访客数</div>
              <div className="col-span-1 text-right">操作</div>
            </div>
            <div className="divide-y divide-gray-50">
              {records.map((record) => (
                <div key={record.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-gray-50 transition text-sm">
                  <div className="col-span-1">
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      platformColors[record.platform || ""] || "bg-gray-100 text-gray-600"
                    )}>
                      {platformLabels[record.platform || ""] || record.platform || "—"}
                    </span>
                  </div>
                  <div className="col-span-2 text-gray-600 text-xs">
                    {record.date ? new Date(record.date).toLocaleDateString("zh-CN") : "—"}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-gray-900">
                    {fmt(record.gmv)}
                  </div>
                  <div className="col-span-1 text-right text-gray-600">
                    {record.order_count?.toLocaleString() || "—"}
                  </div>
                  <div className="col-span-2 text-right text-red-500">
                    {fmt(record.refund_amount)}
                  </div>
                  <div className="col-span-2 text-right text-orange-600">
                    {fmt(record.ad_spend)}
                  </div>
                  <div className="col-span-1 text-right text-gray-500 text-xs">
                    {record.visitor_count?.toLocaleString() || "—"}
                  </div>
                  <div className="col-span-1 flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(record)}
                      className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-violet-100 hover:text-violet-600 transition"
                    >
                      <Pencil size={12} />
                    </button>
                    {deleteConfirm === record.id ? (
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition"
                      >
                        <Check size={12} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(record.id)}
                        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {editRecord ? <Pencil size={16} className="text-violet-600" /> : <Plus size={16} className="text-violet-600" />}
                {editRecord ? "编辑销售数据" : "录入销售数据"}
              </h3>
              <button
                onClick={() => { setShowModal(false); setFormError(null); }}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">平台</label>
                  <div className="relative">
                    <select
                      value={form.platform}
                      onChange={(e) => setForm({ ...form, platform: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      {platformList.filter((p) => p.value !== "all").map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">日期 *</label>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">GMV（元）</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gmv}
                    onChange={(e) => setForm({ ...form, gmv: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">订单量（笔）</label>
                  <input
                    type="number"
                    min="0"
                    value={form.order_count}
                    onChange={(e) => setForm({ ...form, order_count: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">退款额（元）</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.refund_amount}
                    onChange={(e) => setForm({ ...form, refund_amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">广告花费（元）</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.ad_spend}
                    onChange={(e) => setForm({ ...form, ad_spend: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">访客数（人）</label>
                <input
                  type="number"
                  min="0"
                  value={form.visitor_count}
                  onChange={(e) => setForm({ ...form, visitor_count: e.target.value })}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(null); }}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editRecord ? "保存修改" : "录入数据"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
