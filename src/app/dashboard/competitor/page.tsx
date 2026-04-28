"use client";

// 竞品情报 — 总览页
// 路径: /dashboard/competitor

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Swords, Plus, Loader2, X, Edit2, Trash2, ExternalLink,
  Sparkles, Filter, Search, TrendingUp, Copy, Check,
  FileText, Trash, Calendar as CalendarIcon,
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

interface Report {
  id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  content_md: string;
  highlights: { competitor_count?: number; sku_count?: number; change_count?: number; event_count?: number } | null;
  created_at: string;
}

export default function CompetitorPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => { load(); loadReports(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/competitors");
    const j = await r.json();
    setCompetitors((j.competitors || []) as Competitor[]);
    setLoading(false);
  }
  async function loadReports() {
    setReportsLoading(true);
    const r = await fetch("/api/competitors/reports?limit=20");
    const j = await r.json();
    setReports((j.reports || []) as Report[]);
    setReportsLoading(false);
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
          <button onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50">
            <Sparkles size={14} />Qwen · AI 周报
            {reports.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 rounded-full">{reports.length}</span>
            )}
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

      {showReportModal && (
        <ReportCenterModal
          reports={reports}
          loading={reportsLoading}
          competitorCount={compList.length + selfList.length}
          onClose={() => setShowReportModal(false)}
          onGenerated={async () => { await loadReports(); }}
          onDelete={async (id) => {
            await fetch(`/api/competitors/reports/${id}`, { method: "DELETE" });
            await loadReports();
          }}
        />
      )}
    </div>
  );
}

// ============ AI 周报中心 ============
function ReportCenterModal({ reports, loading, competitorCount, onClose, onGenerated, onDelete }: {
  reports: Report[];
  loading: boolean;
  competitorCount: number;
  onClose: () => void;
  onGenerated: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [days, setDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (competitorCount === 0) { setError("请先添加至少一个竞品"); return; }
    setGenerating(true); setError("");
    const r = await fetch("/api/competitors/reports/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    const j = await r.json();
    setGenerating(false);
    if (!r.ok) { setError(j.error || "生成失败"); return; }
    setPreviewContent(j.content || "");
    if (j.report) setActiveReport(j.report);
    await onGenerated();
  }

  async function copyContent() {
    const text = activeReport?.content_md || previewContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { alert("复制失败"); }
  }

  const showingContent = activeReport?.content_md || previewContent;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-600" />
            <h3 className="font-semibold text-gray-900">竞品周报中心</h3>
            <span className="text-xs text-gray-400">已存 {reports.length} 份</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="flex-1 grid grid-cols-[260px_1fr] overflow-hidden">
          {/* 左侧：生成 + 历史 */}
          <div className="border-r border-gray-100 p-4 overflow-y-auto">
            {/* 生成区 */}
            <div className="bg-violet-50 rounded-xl p-3 mb-4">
              <div className="text-xs text-gray-700 font-medium mb-2">生成新周报</div>
              <label className="block text-[11px] text-gray-500 mb-1">数据时间段</label>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}
                disabled={generating}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg mb-2 focus:outline-none focus:border-violet-400">
                <option value={7}>过去 7 天</option>
                <option value={14}>过去 14 天</option>
                <option value={30}>过去 30 天</option>
              </select>
              <button onClick={generate} disabled={generating}
                className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generating ? "Qwen 分析中..." : "Qwen 生成周报"}
              </button>
              {error && <div className="mt-2 text-[11px] text-rose-600">{error}</div>}
              <p className="mt-2 text-[10px] text-gray-500">基于所有竞品 + 我们品牌的快照、事件分析</p>
            </div>

            {/* 历史 */}
            <div className="text-xs text-gray-700 font-medium mb-2">历史周报</div>
            {loading ? (
              <div className="py-4 text-center text-xs text-gray-400">
                <Loader2 className="animate-spin inline" size={12} /> 加载中
              </div>
            ) : reports.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400">还没生成过周报</div>
            ) : (
              <div className="space-y-1">
                {reports.map((r) => (
                  <button key={r.id}
                    onClick={() => { setActiveReport(r); setPreviewContent(""); }}
                    className={"w-full text-left px-2 py-2 rounded-lg border text-xs transition-colors " +
                      (activeReport?.id === r.id ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-gray-300")}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <CalendarIcon size={10} className="text-gray-400" />
                      <span className="text-gray-900">{r.period_start.slice(5)} → {r.period_end.slice(5)}</span>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {r.highlights?.competitor_count ?? 0} 竞品 ·
                      {r.highlights?.change_count ?? 0} 变化 ·
                      {r.highlights?.event_count ?? 0} 事件
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(r.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：报告内容 */}
          <div className="flex flex-col overflow-hidden">
            {showingContent ? (
              <>
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    {activeReport ? `${activeReport.period_start} → ${activeReport.period_end}` : "新生成的报告"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={copyContent}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700">
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? "已复制" : "复制 Markdown"}
                    </button>
                    {activeReport && (
                      <button onClick={() => {
                        if (confirm("删除这份报告？")) {
                          onDelete(activeReport.id);
                          setActiveReport(null);
                        }
                      }}
                        className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50">
                        <Trash size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="prose prose-sm max-w-none">
                    {renderReportMd(showingContent)}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">从左侧选一份历史报告，或点上方生成新报告</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 简易 Markdown 渲染（专门为报告优化）
function renderReportMd(md: string): React.ReactNode {
  if (!md) return null;
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      out.push(<h3 key={i} className="text-base font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-100">{line.slice(3)}</h3>);
    } else if (line.startsWith("### ")) {
      out.push(<h4 key={i} className="text-sm font-bold text-gray-800 mt-3 mb-1">{line.slice(4)}</h4>);
    } else if (line.match(/^\d+\.\s/)) {
      out.push(<div key={i} className="my-1 text-sm text-gray-700 pl-1">{renderInlineMd(line)}</div>);
    } else if (line.match(/^[\s]*-\s/)) {
      out.push(
        <div key={i} className="flex items-start gap-2 my-0.5 text-sm text-gray-700 pl-2">
          <span className="text-violet-400 mt-0.5">•</span>
          <span>{renderInlineMd(line.replace(/^[\s]*-\s+/, ""))}</span>
        </div>,
      );
    } else if (line.trim()) {
      out.push(<p key={i} className="my-1.5 text-sm text-gray-700 leading-relaxed">{renderInlineMd(line)}</p>);
    } else {
      out.push(<div key={i} className="h-1" />);
    }
    i++;
  }
  return out;
}
function renderInlineMd(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-violet-700">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="px-1 bg-gray-100 text-violet-700 rounded text-xs">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
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
