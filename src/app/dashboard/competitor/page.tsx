"use client";

// 竞品情报 — 总览页
// 路径: /dashboard/competitor

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Swords, Plus, Loader2, X, Edit2, Trash2, ExternalLink,
  Sparkles, Filter, Search, TrendingUp,
} from "lucide-react";

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
  sku_count: number;
  created_at: string;
  updated_at: string;
}

const PLATFORMS = [
  { value: "all",         label: "全部",   color: "bg-gray-100 text-gray-700" },
  { value: "douyin",      label: "抖音",   color: "bg-rose-100 text-rose-700" },
  { value: "tmall",       label: "天猫",   color: "bg-orange-100 text-orange-700" },
  { value: "jd",          label: "京东",   color: "bg-red-100 text-red-700" },
  { value: "pinduoduo",   label: "拼多多", color: "bg-amber-100 text-amber-700" },
  { value: "xiaohongshu", label: "小红书", color: "bg-pink-100 text-pink-700" },
  { value: "weidian",     label: "微店",   color: "bg-purple-100 text-purple-700" },
  { value: "other",       label: "其他",   color: "bg-gray-100 text-gray-700" },
];

const POSITIONS = [
  { value: "",          label: "未填" },
  { value: "premium",   label: "高端" },
  { value: "mid",       label: "中端" },
  { value: "value",     label: "性价比" },
  { value: "budget",    label: "低端" },
];

export default function CompetitorPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/competitors");
    const j = await r.json();
    setCompetitors((j.competitors || []) as Competitor[]);
    setLoading(false);
  }

  async function deleteCompetitor(id: string) {
    if (!confirm("删除这个竞品？关联的 SKU、快照、事件都会一并删除。")) return;
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = useMemo(() => {
    return competitors.filter((c) => {
      if (platformFilter !== "all" && c.platform !== platformFilter) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        return (c.name || "").toLowerCase().includes(k)
          || (c.brand || "").toLowerCase().includes(k)
          || (c.category || "").toLowerCase().includes(k);
      }
      return true;
    });
  }, [competitors, platformFilter, keyword]);

  const selfList = filtered.filter((c) => c.is_self);
  const compList = filtered.filter((c) => !c.is_self);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Swords size={22} className="text-violet-600" />
            竞品情报
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            跟踪 {compList.length} 个竞品 · {selfList.length} 个我们品牌 · 共 {competitors.reduce((s, c) => s + (c.sku_count || 0), 0)} 个 SKU
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button disabled
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
            title="P2 阶段实装">
            <Sparkles size={14} />AI 生成周报
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium">
            <Plus size={16} />添加竞品
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter size={14} className="text-gray-400" />
        {PLATFORMS.map((p) => (
          <button key={p.value} onClick={() => setPlatformFilter(p.value)}
            className={"px-3 py-1.5 text-xs rounded-full border transition-colors " +
              (platformFilter === p.value ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-violet-300")}>
            {p.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜店铺/品牌/品类..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:border-violet-400" />
        </div>
      </div>

      {selfList.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">🏠 我们品牌</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selfList.map((c) => (
              <CompetitorCard key={c.id} c={c}
                onEdit={() => { setEditing(c); setShowForm(true); }}
                onDelete={() => deleteCompetitor(c.id)} />
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">⚔️ 竞品</h2>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} />加载中...
        </div>
      ) : compList.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <Swords size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 mb-3">还没有竞品，点右上角添加</p>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">
            <Plus size={14} />添加第一个竞品
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {compList.map((c) => (
            <CompetitorCard key={c.id} c={c}
              onEdit={() => { setEditing(c); setShowForm(true); }}
              onDelete={() => deleteCompetitor(c.id)} />
          ))}
        </div>
      )}

      {showForm && (
        <CompetitorFormModal
          competitor={editing}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await load(); }}
        />
      )}
    </div>
  );
}

function CompetitorCard({ c, onEdit, onDelete }: {
  c: Competitor; onEdit: () => void; onDelete: () => void;
}) {
  const platMeta = PLATFORMS.find((p) => p.value === c.platform) || PLATFORMS[0];
  return (
    <div className={"group bg-white rounded-xl border p-4 hover:border-violet-300 hover:shadow-sm transition-all " +
      (c.is_self ? "border-violet-300 bg-violet-50/30" : "border-gray-200")}>
      <Link href={`/dashboard/competitor/${c.id}`} className="block">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${platMeta.color}`}>
                {platMeta.label}
              </span>
              {c.is_self && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  我们品牌
                </span>
              )}
              {c.priority >= 4 && <span className="text-amber-500 text-xs">★</span>}
            </div>
            <h3 className="font-bold text-gray-900 truncate">{c.name}</h3>
            {c.brand && c.brand !== c.name && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{c.brand}</p>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-0.5 mb-3">
          {c.category && <div>📦 {c.category}</div>}
          {c.brand_position && <div>🎯 {POSITIONS.find((p) => p.value === c.brand_position)?.label || c.brand_position}</div>}
          {c.followers > 0 && <div>👥 {c.followers.toLocaleString()} 粉丝</div>}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 text-xs">
          <span className="text-gray-500"><TrendingUp size={11} className="inline mr-0.5" />{c.sku_count} 个 SKU</span>
          <span className="text-gray-400">更新 {new Date(c.updated_at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}</span>
        </div>
      </Link>

      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
        {c.shop_url && (
          <a href={c.shop_url} target="_blank" rel="noreferrer"
            className="p-1.5 rounded text-gray-400 hover:text-violet-600 hover:bg-violet-50" title="打开店铺">
            <ExternalLink size={12} />
          </a>
        )}
        <button onClick={onEdit}
          className="p-1.5 rounded text-gray-400 hover:text-violet-600 hover:bg-violet-50" title="编辑">
          <Edit2 size={12} />
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50" title="删除">
          <Trash2 size={12} />
        </button>
        <div className="flex-1" />
        <Link href={`/dashboard/competitor/${c.id}`}
          className="text-xs text-violet-600 hover:underline">详情 →</Link>
      </div>
    </div>
  );
}

function CompetitorFormModal({ competitor, onClose, onSaved }: {
  competitor: Competitor | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: competitor?.name || "",
    brand: competitor?.brand || "",
    platform: competitor?.platform || "douyin",
    shop_url: competitor?.shop_url || "",
    category: competitor?.category || "",
    brand_position: competitor?.brand_position || "",
    followers: competitor?.followers || 0,
    priority: competitor?.priority || 3,
    is_self: competitor?.is_self || false,
    notes: competitor?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!form.name.trim()) { setError("店铺/品牌名不能为空"); return; }
    setBusy(true); setError("");
    const url = competitor ? `/api/competitors/${competitor.id}` : "/api/competitors";
    const r = await fetch(url, {
      method: competitor ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) { const j = await r.json(); setError(j.error || "保存失败"); return; }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{competitor ? "编辑" : "新增"}竞品</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        {error && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded">{error}</div>}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">店铺名 *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例：XX 旗舰店"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">品牌</label>
              <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="例：XX 品牌"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">平台 *</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                {PLATFORMS.filter((p) => p.value !== "all").map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">品牌定位</label>
              <select value={form.brand_position} onChange={(e) => setForm({ ...form, brand_position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">店铺链接</label>
            <input value={form.shop_url} onChange={(e) => setForm({ ...form, shop_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">细分品类</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="如：电子琴"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">粉丝数</label>
              <input type="number" value={form.followers} onChange={(e) => setForm({ ...form, followers: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">关注度</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">备注</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} placeholder="店铺特点、关注理由..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
            <input type="checkbox" checked={form.is_self} onChange={(e) => setForm({ ...form, is_self: e.target.checked })} />
            <span>这是「我们品牌」（用于对比展示）</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button onClick={save} disabled={busy}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
