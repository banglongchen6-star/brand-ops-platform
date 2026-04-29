"use client";

// 竞品详情 + SKU 管理 + 录入快照 + 趋势图 + 事件
// 路径: /dashboard/competitor/[id]

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Loader2, X, Edit2, Trash2, ExternalLink,
  TrendingUp, AlertCircle, Save, Calendar as CalendarIcon, Flame,
  Sparkles, Image as ImageIcon, Upload, ClipboardPaste,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface Competitor {
  id: string;
  name: string;
  brand: string;
  platform: string;
  shop_url: string;
  category: string;
  brand_position: string;
  followers: number;
  priority: number;
  is_self: boolean;
  notes: string;
}

interface Sku {
  id: string;
  competitor_id: string;
  name: string;
  product_url: string;
  category: string;
  current_price: number | null;
  original_price: number | null;
  current_sales: number;
  monthly_sales: number;
  rating: number | null;
  review_count: number;
  status: string;
  is_hot: boolean;
  notes: string;
  updated_at: string;
}

interface Snapshot {
  id: string;
  sku_id: string;
  snapshot_date: string;
  price: number | null;
  sales: number | null;
  monthly_sales: number | null;
  rating: number | null;
  review_count: number | null;
}

interface CompetitorEvent {
  id: string;
  competitor_id: string;
  related_sku_id: string | null;
  event_type: string;
  title: string;
  description: string;
  event_date: string;
  impact_level: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音", tmall: "天猫", jd: "京东", pinduoduo: "拼多多",
  xiaohongshu: "小红书", weidian: "微店", other: "其他",
};

const POSITION_LABELS: Record<string, string> = {
  premium: "高端", mid: "中端", value: "性价比", budget: "低端",
};

const EVENT_TYPES = [
  { value: "new_product",   label: "🆕 上新",   color: "bg-green-100 text-green-700" },
  { value: "price_change",  label: "💰 调价",   color: "bg-amber-100 text-amber-700" },
  { value: "promotion",     label: "🎯 促销",   color: "bg-rose-100 text-rose-700" },
  { value: "livestream",    label: "📡 直播",   color: "bg-violet-100 text-violet-700" },
  { value: "collab",        label: "🤝 联名",   color: "bg-blue-100 text-blue-700" },
  { value: "other",         label: "📌 其他",   color: "bg-gray-100 text-gray-700" },
];

const CHART_COLORS = ["#7c3aed", "#2563eb", "#ea580c", "#059669", "#e11d48", "#0891b2", "#7c2d12", "#be185d"];

export default function CompetitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [events, setEvents] = useState<CompetitorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSkuForm, setShowSkuForm] = useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [showSnapshotForm, setShowSnapshotForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [chartMetric, setChartMetric] = useState<"price" | "sales" | "rating">("price");
  const [chartDays, setChartDays] = useState(30);
  const [alerts, setAlerts] = useState<{ sku_id: string; type: string; message: string }[]>([]);

  useEffect(() => { loadAll(); }, [id, chartDays]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadCompetitor(), loadSkus(), loadSnapshots(), loadEvents()]);
    setLoading(false);
  }
  async function loadCompetitor() {
    const r = await fetch(`/api/competitors/${id}`);
    const j = await r.json();
    if (j.competitor) setCompetitor(j.competitor);
  }
  async function loadSkus() {
    const r = await fetch(`/api/competitors/${id}/skus`);
    const j = await r.json();
    setSkus((j.skus || []) as Sku[]);
  }
  async function loadSnapshots() {
    const r = await fetch(`/api/competitors/${id}/snapshots?days=${chartDays}`);
    const j = await r.json();
    setSnapshots((j.snapshots || []) as Snapshot[]);
  }
  async function loadEvents() {
    const r = await fetch(`/api/competitors/${id}/events`);
    const j = await r.json();
    setEvents((j.events || []) as CompetitorEvent[]);
  }

  async function deleteSku(skuId: string) {
    if (!confirm("删除这个 SKU？关联的快照都会删除。")) return;
    await fetch(`/api/competitors/${id}/skus/${skuId}`, { method: "DELETE" });
    await Promise.all([loadSkus(), loadSnapshots()]);
  }

  // 整理趋势数据
  const chartData = useMemo(() => {
    if (skus.length === 0 || snapshots.length === 0) return [];
    // 按日期 → SKU → 值 聚合
    const byDate = new Map<string, Record<string, number | null>>();
    for (const s of snapshots) {
      const v = chartMetric === "price" ? s.price : chartMetric === "sales" ? s.sales : s.rating;
      if (v == null) continue;
      if (!byDate.has(s.snapshot_date)) byDate.set(s.snapshot_date, {});
      byDate.get(s.snapshot_date)![s.sku_id] = Number(v);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [snapshots, skus, chartMetric]);

  if (loading || !competitor) {
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
      <Loader2 className="animate-spin mr-2" size={18} />加载中...
    </div>;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* 顶部 */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/dashboard/competitor" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-gray-900">{competitor.name}</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {PLATFORM_LABELS[competitor.platform] || competitor.platform}
            </span>
            {competitor.is_self && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                我们品牌
              </span>
            )}
            {competitor.priority >= 4 && <span className="text-amber-500">★</span>}
          </div>
          <p className="text-xs text-gray-500">
            {competitor.brand && <span>{competitor.brand} · </span>}
            {competitor.category && <span>{competitor.category} · </span>}
            {competitor.brand_position && <span>{POSITION_LABELS[competitor.brand_position]} · </span>}
            {competitor.followers > 0 && <span>{competitor.followers.toLocaleString()} 粉丝</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {competitor.shop_url && (
            <a href={competitor.shop_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <ExternalLink size={12} />打开店铺
            </a>
          )}
          <button onClick={() => setShowSnapshotForm(true)} disabled={skus.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40">
            <Plus size={13} />录入今日数据
          </button>
        </div>
      </div>

      {/* 异常告警 */}
      {alerts.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-1 text-amber-800 text-sm font-semibold mb-1">
            <AlertCircle size={14} />检测到 {alerts.length} 个异常
          </div>
          <ul className="text-xs text-amber-700 space-y-0.5 ml-5">
            {alerts.map((a, i) => {
              const sku = skus.find((s) => s.id === a.sku_id);
              return <li key={i}>{sku?.name}：{a.message}</li>;
            })}
          </ul>
          <button onClick={() => setAlerts([])} className="text-xs text-amber-600 hover:underline mt-1 ml-5">
            知道了
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* 主体 */}
        <div className="space-y-4">
          {/* SKU 列表 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp size={16} className="text-violet-600" />
                SKU 列表 ({skus.length})
              </h2>
              <button onClick={() => { setEditingSku(null); setShowSkuForm(true); }}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-violet-600 text-white rounded-md hover:bg-violet-700">
                <Plus size={11} />添加 SKU
              </button>
            </div>
            {skus.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                还没有 SKU，点上方添加
              </div>
            ) : (
              <div className="space-y-2">
                {skus.map((s) => (
                  <SkuRow key={s.id} sku={s}
                    onEdit={() => { setEditingSku(s); setShowSkuForm(true); }}
                    onDelete={() => deleteSku(s.id)} />
                ))}
              </div>
            )}
          </div>

          {/* 趋势图 */}
          {skus.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">趋势图</h2>
                <div className="flex items-center gap-2">
                  <div className="inline-flex border border-gray-200 rounded-lg p-0.5">
                    {[
                      { v: "price",  label: "价格" },
                      { v: "sales",  label: "销量" },
                      { v: "rating", label: "评分" },
                    ].map((m) => (
                      <button key={m.v} onClick={() => setChartMetric(m.v as "price" | "sales" | "rating")}
                        className={"px-2.5 py-1 text-xs rounded-md " +
                          (chartMetric === m.v ? "bg-violet-600 text-white" : "text-gray-600")}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <select value={chartDays} onChange={(e) => setChartDays(Number(e.target.value))}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none">
                    <option value={7}>近 7 天</option>
                    <option value={30}>近 30 天</option>
                    <option value={90}>近 90 天</option>
                  </select>
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  暂无快照数据，点右上角「录入今日数据」开始记录
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      labelFormatter={(d) => `日期：${d}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {skus.map((s, i) => (
                      <Line key={s.id} type="monotone" dataKey={s.id} name={s.name}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2}
                        dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* 右侧：事件时间线 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 self-start sticky top-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <CalendarIcon size={14} className="text-violet-600" />
              事件时间线
            </h2>
            <button onClick={() => setShowEventForm(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-violet-600 text-white rounded-md hover:bg-violet-700">
              <Plus size={10} />添加
            </button>
          </div>
          {events.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              暂无事件记录
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {events.map((e) => {
                const meta = EVENT_TYPES.find((x) => x.value === e.event_type) || EVENT_TYPES[5];
                return (
                  <div key={e.id} className="border-l-2 border-violet-200 pl-3 pb-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.color}`}>
                        {meta.label}
                      </span>
                      {e.impact_level === "high" && <span className="text-[10px] text-rose-600">高影响</span>}
                    </div>
                    <h4 className="text-sm font-medium text-gray-900">{e.title}</h4>
                    {e.description && <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{e.event_date}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SKU 表单 */}
      {showSkuForm && (
        <SkuFormModal
          competitorId={id} sku={editingSku}
          onClose={() => setShowSkuForm(false)}
          onSaved={async () => { setShowSkuForm(false); await loadSkus(); await loadSnapshots(); }}
        />
      )}

      {/* 录入快照 */}
      {showSnapshotForm && (
        <SnapshotFormModal
          competitorId={id} skus={skus}
          onClose={() => setShowSnapshotForm(false)}
          onSaved={async (newAlerts) => {
            setShowSnapshotForm(false);
            await Promise.all([loadSkus(), loadSnapshots()]);
            if (newAlerts && newAlerts.length > 0) setAlerts(newAlerts);
          }}
        />
      )}

      {/* 添加事件 */}
      {showEventForm && (
        <EventFormModal
          competitorId={id} skus={skus}
          onClose={() => setShowEventForm(false)}
          onSaved={async () => { setShowEventForm(false); await loadEvents(); }}
        />
      )}
    </div>
  );
}

// ============ SKU 行 ============
function SkuRow({ sku, onEdit, onDelete }: { sku: Sku; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group border border-gray-100 rounded-lg p-3 hover:border-violet-300 hover:bg-violet-50/30 transition-all">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {sku.is_hot && <Flame size={11} className="text-rose-500" />}
            <h3 className="font-medium text-gray-900 text-sm truncate">{sku.name}</h3>
            {sku.product_url && (
              <a href={sku.product_url} target="_blank" rel="noreferrer"
                className="text-gray-400 hover:text-violet-600">
                <ExternalLink size={11} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            {sku.current_price != null && (
              <span className="font-semibold text-gray-900">¥{Number(sku.current_price).toFixed(2)}
                {sku.original_price && Number(sku.original_price) > Number(sku.current_price) && (
                  <span className="ml-1 text-[10px] text-gray-400 line-through">¥{Number(sku.original_price).toFixed(2)}</span>
                )}
              </span>
            )}
            {sku.current_sales > 0 && <span>累计销 {sku.current_sales.toLocaleString()}</span>}
            {sku.monthly_sales > 0 && <span>月销 {sku.monthly_sales.toLocaleString()}</span>}
            {sku.rating != null && <span>⭐ {Number(sku.rating).toFixed(1)}</span>}
            {sku.review_count > 0 && <span>{sku.review_count} 评价</span>}
          </div>
          {sku.notes && <p className="text-[11px] text-gray-400 mt-1">{sku.notes}</p>}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit}
            className="p-1 rounded text-gray-400 hover:text-violet-600 hover:bg-violet-50">
            <Edit2 size={11} />
          </button>
          <button onClick={onDelete}
            className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ SKU 表单 ============
function SkuFormModal({ competitorId, sku, onClose, onSaved }: {
  competitorId: string; sku: Sku | null;
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: sku?.name || "",
    product_url: sku?.product_url || "",
    category: sku?.category || "",
    current_price: sku?.current_price != null ? String(sku.current_price) : "",
    original_price: sku?.original_price != null ? String(sku.original_price) : "",
    current_sales: sku?.current_sales || 0,
    monthly_sales: sku?.monthly_sales || 0,
    rating: sku?.rating != null ? String(sku.rating) : "",
    review_count: sku?.review_count || 0,
    is_hot: sku?.is_hot || false,
    notes: sku?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ===== 截图识别 =====
  const [showVision, setShowVision] = useState(!sku); // 新建时默认展开
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [visionResult, setVisionResult] = useState<{ confidence?: string; notes?: string; filled?: string[] } | null>(null);

  function setImage(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setVisionResult(null);
  }

  // 监听粘贴
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!showVision) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) { setImage(file); e.preventDefault(); break; }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [showVision]);

  async function parseImage() {
    if (!imageFile) return;
    setParsing(true); setError(""); setVisionResult(null);
    const fd = new FormData();
    fd.append("image", imageFile);
    const r = await fetch("/api/competitors/parse-sku-image", { method: "POST", body: fd });
    const j = await r.json();
    setParsing(false);
    if (!r.ok) { setError(j.error || "识别失败"); return; }
    const d = j.data || {};
    const filled: string[] = [];
    setForm((prev) => {
      const next = { ...prev };
      if (d.name) { next.name = String(d.name); filled.push("名称"); }
      if (d.category) { next.category = String(d.category); filled.push("品类"); }
      if (d.current_price != null) { next.current_price = String(d.current_price); filled.push("当前价"); }
      if (d.original_price != null) { next.original_price = String(d.original_price); filled.push("原价"); }
      if (d.current_sales != null) { next.current_sales = Number(d.current_sales); filled.push("累计销量"); }
      if (d.monthly_sales != null) { next.monthly_sales = Number(d.monthly_sales); filled.push("月销"); }
      if (d.rating != null) { next.rating = String(d.rating); filled.push("评分"); }
      if (d.review_count != null) { next.review_count = Number(d.review_count); filled.push("评价数"); }
      if (d.is_hot === true) { next.is_hot = true; filled.push("爆款"); }
      return next;
    });
    setVisionResult({ confidence: d.confidence, notes: d.notes, filled });
  }

  function clearImage() {
    setImageFile(null); setImagePreview(""); setVisionResult(null);
  }

  async function save() {
    if (!form.name.trim()) { setError("SKU 名称不能为空"); return; }
    setBusy(true); setError("");
    const body = {
      ...form,
      current_price: form.current_price === "" ? null : Number(form.current_price),
      original_price: form.original_price === "" ? null : Number(form.original_price),
      rating: form.rating === "" ? null : Number(form.rating),
    };
    const url = sku
      ? `/api/competitors/${competitorId}/skus/${sku.id}`
      : `/api/competitors/${competitorId}/skus`;
    const r = await fetch(url, {
      method: sku ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) { const j = await r.json(); setError(j.error || "保存失败"); return; }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{sku ? "编辑" : "添加"} SKU</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        {error && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded">{error}</div>}

        {/* 截图识别区 */}
        <div className="mb-4 border border-violet-200 bg-violet-50/40 rounded-xl overflow-hidden">
          <button onClick={() => setShowVision(!showVision)}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-violet-700 hover:bg-violet-50">
            <Sparkles size={14} />
            <span>Qwen-VL · 截图智能识别</span>
            <span className="text-[10px] text-gray-500">（粘贴或拖拽商品页截图，AI 自动填表）</span>
            <span className="ml-auto text-xs">{showVision ? "▼" : "▶"}</span>
          </button>
          {showVision && (
            <div className="px-4 pb-4 space-y-3 border-t border-violet-100">
              {!imagePreview ? (
                <label className="block mt-3 border-2 border-dashed border-violet-300 rounded-lg p-6 text-center cursor-pointer hover:bg-violet-50 transition-colors">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) setImage(e.target.files[0]); }} />
                  <Upload size={20} className="mx-auto text-violet-500 mb-2" />
                  <p className="text-sm text-gray-700">点击上传截图，或</p>
                  <p className="text-xs text-violet-600 mt-1 flex items-center justify-center gap-1">
                    <ClipboardPaste size={11} />
                    Cmd+V 直接粘贴（Mac 截屏后）
                  </p>
                  <p className="text-[10px] text-gray-400 mt-2">支持 JPG/PNG/WebP，≤ 8MB</p>
                </label>
              ) : (
                <div className="mt-3">
                  <div className="relative rounded-lg overflow-hidden bg-gray-100 mb-2 max-h-64">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="预览" className="w-full h-auto max-h-64 object-contain" />
                    <button onClick={clearImage}
                      className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full hover:bg-black/80">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={parseImage} disabled={parsing}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                      {parsing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {parsing ? "Qwen-VL 识别中..." : "开始识别"}
                    </button>
                    <button onClick={clearImage}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                      换一张
                    </button>
                    {visionResult && (
                      <span className="text-[11px] text-gray-500 ml-auto">
                        置信度：<span className={
                          visionResult.confidence === "high" ? "text-green-600 font-medium" :
                          visionResult.confidence === "low" ? "text-amber-600" : "text-blue-600"
                        }>{visionResult.confidence === "high" ? "高" : visionResult.confidence === "low" ? "低" : "中"}</span>
                      </span>
                    )}
                  </div>
                  {visionResult?.filled && visionResult.filled.length > 0 && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-800">
                      ✓ 已自动填入：{visionResult.filled.join(" / ")}
                    </div>
                  )}
                  {visionResult?.notes && (
                    <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      💡 {visionResult.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">商品名称 *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">商品链接</label>
            <input value={form.product_url} onChange={(e) => setForm({ ...form, product_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">当前价 (¥)</label>
              <input type="number" step="0.01" value={form.current_price}
                onChange={(e) => setForm({ ...form, current_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">原价 (¥)</label>
              <input type="number" step="0.01" value={form.original_price}
                onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">累计销量</label>
              <input type="number" value={form.current_sales}
                onChange={(e) => setForm({ ...form, current_sales: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">月销量</label>
              <input type="number" value={form.monthly_sales}
                onChange={(e) => setForm({ ...form, monthly_sales: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">评分 (0-5)</label>
              <input type="number" step="0.1" min="0" max="5" value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">评价数</label>
              <input type="number" value={form.review_count}
                onChange={(e) => setForm({ ...form, review_count: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">备注</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_hot} onChange={(e) => setForm({ ...form, is_hot: e.target.checked })} />
            <Flame size={12} className="text-rose-500" /> 标记为爆款
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button onClick={save} disabled={busy}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 录入快照（批量） ============
function SnapshotFormModal({ competitorId, skus, onClose, onSaved }: {
  competitorId: string; skus: Sku[];
  onClose: () => void; onSaved: (alerts?: { sku_id: string; type: string; message: string }[]) => Promise<void>;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<Record<string, {
    price: string; sales: string; monthly_sales: string; rating: string; review_count: string;
  }>>(() => {
    const m: Record<string, { price: string; sales: string; monthly_sales: string; rating: string; review_count: string }> = {};
    for (const s of skus) {
      m[s.id] = {
        price: s.current_price?.toString() || "",
        sales: s.current_sales?.toString() || "",
        monthly_sales: s.monthly_sales?.toString() || "",
        rating: s.rating?.toString() || "",
        review_count: s.review_count?.toString() || "",
      };
    }
    return m;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(skuId: string, field: keyof typeof items[string], value: string) {
    setItems((prev) => ({ ...prev, [skuId]: { ...prev[skuId], [field]: value } }));
  }

  async function save() {
    setBusy(true); setError("");
    const payload = skus.map((s) => ({
      sku_id: s.id,
      price: items[s.id]?.price ? Number(items[s.id].price) : null,
      sales: items[s.id]?.sales ? Number(items[s.id].sales) : null,
      monthly_sales: items[s.id]?.monthly_sales ? Number(items[s.id].monthly_sales) : null,
      rating: items[s.id]?.rating ? Number(items[s.id].rating) : null,
      review_count: items[s.id]?.review_count ? Number(items[s.id].review_count) : null,
    })).filter((it) => it.price !== null || it.sales !== null || it.rating !== null);
    if (payload.length === 0) { setError("至少填一项数据"); setBusy(false); return; }

    const r = await fetch(`/api/competitors/${competitorId}/snapshots`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, items: payload }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setError(j.error || "保存失败"); return; }
    await onSaved(j.alerts);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">录入今日数据 ({skus.length} 个 SKU)</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        {error && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded">{error}</div>}

        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs text-gray-600">日期：</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-violet-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-2 py-2 font-medium">SKU</th>
                <th className="text-right px-2 py-2 font-medium w-20">当前价</th>
                <th className="text-right px-2 py-2 font-medium w-20">累计销</th>
                <th className="text-right px-2 py-2 font-medium w-20">月销</th>
                <th className="text-right px-2 py-2 font-medium w-16">评分</th>
                <th className="text-right px-2 py-2 font-medium w-20">评价数</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      {s.is_hot && <Flame size={10} className="text-rose-500" />}
                      <span className="truncate max-w-[200px]" title={s.name}>{s.name}</span>
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" step="0.01" value={items[s.id]?.price || ""}
                      onChange={(e) => update(s.id, "price", e.target.value)}
                      className="w-full text-right px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-violet-400" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" value={items[s.id]?.sales || ""}
                      onChange={(e) => update(s.id, "sales", e.target.value)}
                      className="w-full text-right px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-violet-400" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" value={items[s.id]?.monthly_sales || ""}
                      onChange={(e) => update(s.id, "monthly_sales", e.target.value)}
                      className="w-full text-right px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-violet-400" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" step="0.1" min="0" max="5" value={items[s.id]?.rating || ""}
                      onChange={(e) => update(s.id, "rating", e.target.value)}
                      className="w-full text-right px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-violet-400" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" value={items[s.id]?.review_count || ""}
                      onChange={(e) => update(s.id, "review_count", e.target.value)}
                      className="w-full text-right px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-violet-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button onClick={save} disabled={busy}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}保存快照
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 添加事件 ============
function EventFormModal({ competitorId, skus, onClose, onSaved }: {
  competitorId: string; skus: Sku[];
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    event_type: "new_product",
    title: "",
    description: "",
    event_date: new Date().toISOString().slice(0, 10),
    impact_level: "medium",
    related_sku_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!form.title.trim()) { setError("标题不能为空"); return; }
    setBusy(true); setError("");
    const r = await fetch(`/api/competitors/${competitorId}/events`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        related_sku_id: form.related_sku_id || null,
      }),
    });
    setBusy(false);
    if (!r.ok) { const j = await r.json(); setError(j.error || "保存失败"); return; }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">添加事件</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        {error && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded">{error}</div>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">类型</label>
              <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">影响等级</label>
              <select value={form.impact_level} onChange={(e) => setForm({ ...form, impact_level: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">标题 *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例：上新 X 系列电子琴"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">描述</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} placeholder="详细情况..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">日期</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">关联 SKU（可选）</label>
              <select value={form.related_sku_id} onChange={(e) => setForm({ ...form, related_sku_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                <option value="">无</option>
                {skus.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button onClick={save} disabled={busy}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}保存
          </button>
        </div>
      </div>
    </div>
  );
}
