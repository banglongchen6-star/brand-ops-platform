"use client";

/* eslint-disable @next/next/no-img-element */
// 内容运营工作台 —— Phase 1：平台 + 关键词接入 DB，其余仍为静态原型

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Flame, Sparkles, ShieldCheck, BarChart3,
  ArrowLeft, Settings, Bell, Target,
  Search, RefreshCw, LayoutGrid, List, CheckSquare,
  Star, Brain, Plus, Eye, ExternalLink, ChevronDown, ChevronUp,
  ThumbsUp, Edit2, Trash2, X, Clock, Loader2, Copy, Check, Wand2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getSettings, patchSettings, REFRESH_OPTIONS,
  type WorkspaceSettings,
} from "@/lib/workspaceSettings";
import { useIsAdmin } from "@/lib/useIsAdmin";
import AIConfigModal from "./AIConfigModal";

// ── Types (match DB) ─────────────────────────────────────────────────────────

interface Platform {
  id: string;
  slug: string;
  name: string;
  color_class: string;
  source: "dailyhot" | "manual" | "trendradar";
  enabled: boolean;
  sort_order: number;
  link_format: string | null;
}

interface Keyword {
  id: string;
  category: "music" | "brand" | "custom" | "negative";
  keyword: string;
  weight: number;
  enabled: boolean;
}

// ── DB Trend Row ─────────────────────────────────────────────────────────────

interface Trend {
  id: string;
  platform_slug: string;
  source_type: "dailyhot" | "manual" | "trendradar";
  external_id: string | null;
  title: string;
  description: string | null;
  author: string | null;
  cover_url: string | null;
  source_url: string | null;
  rank_on_list: number | null;
  hot_score: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  music_score: number;
  starred: boolean;
  read: boolean;
  analyzed: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

interface HitFactors {
  id: string;
  trend_id: string;
  hook: string;
  structure: string;
  emotion: string;
  topic_angle: string;
  audience: string;
  format: string;
  replicable_elements: string;
  adaptation_advice: string;
  difficulty: number;
  tags: string[];
  raw_json: Record<string, unknown> | null;
  created_at: string;
}

const mockTropes = [
  { id: "h1", category: "hook", title: '"你以为X要Y年？我用Z天就……"', desc: "打破常识 + 时间反差", usage: 8 },
  { id: "h2", category: "hook", title: '"第一次，真的是第一次"', desc: "首次体验感制造好奇", usage: 5 },
  { id: "s1", category: "structure", title: "痛点 → 反转 → 展示 → 引导", desc: "最稳的4段式", usage: 12 },
  { id: "s2", category: "structure", title: "悬念 → 过程 → 结果 → CTA", desc: "适合教学类", usage: 7 },
  { id: "e1", category: "emotion", title: "亲情共鸣 + 成就感", desc: "父母/家人相关", usage: 9 },
  { id: "e2", category: "emotion", title: "羡慕 + 向往", desc: "普通人也能做到", usage: 6 },
];

// ── Page ─────────────────────────────────────────────────────────────────────

type TabKey = "trends" | "create" | "review" | "analytics";
type SubTab = "live" | "starred" | "hitlib" | "tropes" | "manual" | "history";
type Density = "card" | "list";
type QuickPanel = null | "platforms" | "keywords" | "pool" | "general";

const mainTabs: { key: TabKey; label: string; icon: typeof Flame }[] = [
  { key: "trends", label: "热点发现", icon: Flame },
  { key: "create", label: "AI 创作区", icon: Sparkles },
  { key: "review", label: "审核发布", icon: ShieldCheck },
  { key: "analytics", label: "内容复盘", icon: BarChart3 },
];

const subTabs: { key: SubTab; label: string; icon: typeof Flame }[] = [
  { key: "live", label: "实时热榜", icon: Flame },
  { key: "starred", label: "我的收藏", icon: Star },
  { key: "hitlib", label: "爆款库", icon: Brain },
  { key: "tropes", label: "套路库", icon: Target },
  { key: "manual", label: "手动录入", icon: Edit2 },
  { key: "history", label: "历史", icon: Clock },
];

export default function ContentWorkspacePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("trends");
  const [panel, setPanel] = useState<QuickPanel>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);
  const [poolCount, setPoolCount] = useState(0);

  const loadPlatforms = useCallback(async () => {
    setLoadingPlatforms(true);
    const { data, error } = await supabase
      .from("content_platforms")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data) setPlatforms(data as Platform[]);
    setLoadingPlatforms(false);
  }, []);

  const loadPoolCount = useCallback(async () => {
    const { count } = await supabase
      .from("content_candidate_pool")
      .select("*", { count: "exact", head: true });
    setPoolCount(count ?? 0);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPlatforms(); loadPoolCount(); }, [loadPlatforms, loadPoolCount]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <div className="mb-4">
        <Link href="/dashboard/content" className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-3 w-3" />返回内容运营
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">内容运营工作台</h1>
            <p className="mt-1 text-sm text-gray-500">音乐密码 · 全平台内容生产与管理</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <button onClick={() => setPanel("general")} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Tab Bar ─────────────────────────────────────────────── */}
      <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {mainTabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                active ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────── */}
      {activeTab === "trends" && (
        <TrendsTab
          platforms={platforms}
          loadingPlatforms={loadingPlatforms}
          onOpenPanel={setPanel}
          poolCount={poolCount}
          onPoolChanged={loadPoolCount}
        />
      )}
      {activeTab === "create" && <CreateTab platforms={platforms} />}
      {activeTab === "review" && <Placeholder label="✅ 审核发布" />}
      {activeTab === "analytics" && <Placeholder label="📊 内容复盘" />}

      {panel && (
        <QuickPanelModal
          panel={panel}
          onClose={() => setPanel(null)}
          platforms={platforms}
          onPlatformsChanged={loadPlatforms}
          onPoolChanged={loadPoolCount}
        />
      )}
    </div>
  );
}

// ── 热点发现 Tab ─────────────────────────────────────────────────────────────

function TrendsTab({
  platforms,
  loadingPlatforms,
  onOpenPanel,
  poolCount,
  onPoolChanged,
}: {
  platforms: Platform[];
  loadingPlatforms: boolean;
  onOpenPanel: (p: QuickPanel) => void;
  poolCount: number;
  onPoolChanged: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>("live");
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "card";
    return getSettings().default_density;
  });
  const enabledPlatforms = platforms.filter((p) => p.enabled);
  const [activeSlugs, setActiveSlugs] = useState<string[] | null>(null);
  const [musicFilter, setMusicFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // 默认选中所有启用平台
  useEffect(() => {
    if (activeSlugs === null && enabledPlatforms.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSlugs(enabledPlatforms.map((p) => p.slug));
    }
  }, [enabledPlatforms, activeSlugs]);

  const selected = activeSlugs ?? [];

  const loadTrends = useCallback(async () => {
    setLoadingTrends(true);
    const { data, error } = await supabase
      .from("content_trends")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(200);
    if (!error && data) setTrends(data as Trend[]);
    setLoadingTrends(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTrends(); }, [loadTrends]);

  // 自动刷新（按通用设置的 refresh_interval）
  useEffect(() => {
    function apply() {
      const { refresh_interval } = getSettings();
      if (!refresh_interval) return undefined;
      const id = setInterval(() => {
        fetch("/api/content/hot-feed/sync", { method: "POST" })
          .then((r) => r.ok ? loadTrends() : null)
          .catch(() => {});
      }, refresh_interval * 1000);
      return () => clearInterval(id);
    }
    let cleanup = apply();
    const onChange = () => { cleanup?.(); cleanup = apply(); };
    window.addEventListener("ws-settings-changed", onChange);
    return () => { cleanup?.(); window.removeEventListener("ws-settings-changed", onChange); };
  }, [loadTrends]);

  async function syncHotFeed() {
    setSyncing(true);
    try {
      const r = await fetch("/api/content/hot-feed/sync", { method: "POST" });
      const json = await r.json();
      if (!r.ok) {
        alert("同步失败：" + (json.error ?? r.status));
      } else {
        setLastSyncAt(json.synced_at);
        await loadTrends();
      }
    } catch (e) {
      alert("网络错误：" + (e instanceof Error ? e.message : String(e)));
    }
    setSyncing(false);
  }

  async function toggleStarred(t: Trend) {
    const { error } = await supabase
      .from("content_trends")
      .update({ starred: !t.starred })
      .eq("id", t.id);
    if (error) alert("操作失败：" + error.message);
    else setTrends((prev) => prev.map((x) => x.id === t.id ? { ...x, starred: !x.starred } : x));
  }

  async function markRead(t: Trend) {
    if (t.read) return;
    await supabase.from("content_trends").update({ read: true }).eq("id", t.id);
    setTrends((prev) => prev.map((x) => x.id === t.id ? { ...x, read: true } : x));
  }

  async function addToPool(t: Trend) {
    const scope = getSettings().default_pool_scope;
    const { error } = await supabase
      .from("content_candidate_pool")
      .insert({ trend_id: t.id, scope });
    if (error) {
      if (error.message.includes("duplicate")) alert("该条目已在候选池");
      else alert("加入失败：" + error.message);
    } else {
      onPoolChanged();
      alert(`已加入${scope === "team" ? "团队" : "个人"}候选池`);
    }
  }

  return (
    <>
      {/* Sub-tabs */}
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
        {subTabs.map((t) => {
          const Icon = t.icon;
          const active = subTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Quick Access Bar — 平台管理 / 关键词库 / 候选池 */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
        <button
          onClick={() => onOpenPanel("platforms")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          📡 平台管理
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-gray-500">
            {enabledPlatforms.length}/{platforms.length}
          </span>
        </button>
        <button
          onClick={() => onOpenPanel("keywords")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          🔤 关键词库
        </button>
        <button
          onClick={() => onOpenPanel("pool")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
        >
          <Target className="h-3.5 w-3.5" />候选池
          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">{poolCount}</span>
        </button>
        <span className="ml-auto text-[11px] text-gray-400">
          {lastSyncAt ? `上次同步：${new Date(lastSyncAt).toLocaleTimeString("zh-CN")}` : "点右侧「刷新」拉取热榜"}
        </span>
      </div>

      {/* Sub-tab specific content */}
      {subTab === "tropes" ? <TropesView /> : subTab === "manual" ? <ManualInputView /> : (
        <>
          {/* Filter Bar */}
          <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">平台：</span>
              {loadingPlatforms ? (
                <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
              ) : enabledPlatforms.length === 0 ? (
                <span className="text-xs text-gray-400">暂无启用平台，请到「平台管理」开启</span>
              ) : enabledPlatforms.map((p) => {
                const on = selected.includes(p.slug);
                return (
                  <button
                    key={p.slug}
                    onClick={() => setActiveSlugs((prev) => {
                      const cur = prev ?? [];
                      return on ? cur.filter((x) => x !== p.slug) : [...cur, p.slug];
                    })}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${
                      on ? p.color_class : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索标题/描述..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2 text-xs focus:border-gray-900 focus:bg-white focus:outline-none"
                />
              </div>
              <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
                <option>今天</option>
                <option>近24小时</option>
                <option>近7天</option>
                <option>全部</option>
              </select>
              <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                <input type="checkbox" checked={musicFilter} onChange={(e) => setMusicFilter(e.target.checked)} className="rounded" />
                音乐相关
              </label>
              <button
                onClick={syncHotFeed}
                disabled={syncing}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "同步中..." : "刷新"}
              </button>
              <div className="flex rounded-lg border border-gray-200">
                <button
                  onClick={() => setDensity("card")}
                  className={`rounded-l-lg p-1.5 text-xs ${density === "card" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDensity("list")}
                  className={`rounded-r-lg p-1.5 text-xs ${density === "list" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
              <button className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                <CheckSquare className="h-3 w-3" />多选
              </button>
            </div>
          </div>

          {/* Content list */}
          {loadingTrends ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (() => {
            const filtered = trends
              .filter((t) => subTab !== "starred" || t.starred)
              .filter((t) => subTab !== "hitlib" || t.analyzed)
              .filter((t) => selected.includes(t.platform_slug))
              .filter((t) => !musicFilter || t.music_score >= 70)
              .filter((t) => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()));

            if (filtered.length === 0) {
              return (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">
                    {trends.length === 0
                      ? "还没有热点数据，点右上角「刷新」拉取 DailyHot"
                      : "没有符合筛选条件的热点"}
                  </p>
                </div>
              );
            }

            return density === "card" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((t) => (
                  <TrendCard
                    key={t.id}
                    t={t}
                    platforms={platforms}
                    expanded={expandedId === t.id}
                    onToggle={() => { setExpandedId(expandedId === t.id ? null : t.id); markRead(t); }}
                    onStar={() => toggleStarred(t)}
                    onAddPool={() => addToPool(t)}
                    onAnalyzed={() => setTrends((prev) => prev.map((x) => x.id === t.id ? { ...x, analyzed: true, read: true } : x))}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">平台</th>
                      <th className="px-3 py-2 text-left font-medium">标题</th>
                      <th className="px-3 py-2 text-right font-medium">热度</th>
                      <th className="px-3 py-2 text-right font-medium">音乐度</th>
                      <th className="px-3 py-2 text-center font-medium">状态</th>
                      <th className="px-3 py-2 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((t) => {
                      const plat = platforms.find((p) => p.slug === t.platform_slug);
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${plat?.color_class ?? "bg-gray-200"}`}>{plat?.name ?? t.platform_slug}</span></td>
                          <td className="px-3 py-2 max-w-md truncate font-medium text-gray-900">
                            {t.source_url ? (
                              <a href={t.source_url} target="_blank" rel="noreferrer" className="hover:underline">{t.title}</a>
                            ) : t.title}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-600">{t.hot_score?.toLocaleString() ?? "—"}</td>
                          <td className="px-3 py-2 text-right"><ScoreBar score={t.music_score} /></td>
                          <td className="px-3 py-2 text-center">
                            {t.starred && <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" />}
                            {t.analyzed && <Brain className="ml-1 inline h-3 w-3 text-purple-500" />}
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            <button onClick={() => toggleStarred(t)} className="mr-1 rounded border border-gray-200 px-2 py-0.5 text-gray-700 hover:bg-gray-50">
                              {t.starred ? "取消收藏" : "收藏"}
                            </button>
                            <button onClick={() => addToPool(t)} className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-700 hover:bg-amber-100">+ 候选</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}

// ── 单条热点卡片 ─────────────────────────────────────────────────────────────

function TrendCard({
  t, platforms, expanded, onToggle, onStar, onAddPool, onAnalyzed,
}: {
  t: Trend;
  platforms: Platform[];
  expanded: boolean;
  onToggle: () => void;
  onStar: () => void;
  onAddPool: () => void;
  onAnalyzed: () => void;
}) {
  const [factors, setFactors] = useState<HitFactors | null>(null);
  const [loadingFactors, setLoadingFactors] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // 展开且已拆解时拉取结果
  useEffect(() => {
    if (!expanded || !t.analyzed) return;
    let cancelled = false;
    (async () => {
      setLoadingFactors(true);
      const { data } = await supabase
        .from("content_hit_factors")
        .select("*")
        .eq("trend_id", t.id)
        .maybeSingle();
      if (!cancelled) {
        setFactors((data as HitFactors) ?? null);
        setLoadingFactors(false);
      }
    })();
    return () => { cancelled = true; };
  }, [expanded, t.analyzed, t.id]);

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      const r = await fetch("/api/content/trends/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trend_id: t.id }),
      });
      const json = await r.json();
      if (!r.ok) {
        alert("拆解失败：" + (json.error ?? r.status));
      } else {
        // 重新拉取结果行
        const { data } = await supabase
          .from("content_hit_factors")
          .select("*")
          .eq("trend_id", t.id)
          .maybeSingle();
        setFactors((data as HitFactors) ?? null);
        onAnalyzed();
      }
    } catch (e) {
      alert("网络错误：" + (e instanceof Error ? e.message : String(e)));
    }
    setAnalyzing(false);
  }

  const plat = platforms.find((p) => p.slug === t.platform_slug);
  const platColor = plat?.color_class ?? "bg-gray-200 text-gray-700";
  const platName = plat?.name ?? t.platform_slug;
  const isManual = t.source_type === "manual";
  return (
    <div className={`group overflow-hidden rounded-xl border bg-white transition hover:shadow-md ${expanded ? "border-purple-300" : "border-gray-200"}`}>
      {t.cover_url && (
        <div className="relative h-40 overflow-hidden bg-gray-100">
          <img src={t.cover_url} alt={t.title} className="h-full w-full object-cover" />
          <div className="absolute left-2 top-2 flex gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${platColor}`}>{platName}</span>
            {t.rank_on_list && <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">#{t.rank_on_list}</span>}
            {isManual && <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-white">手动</span>}
          </div>
          <div className="absolute right-2 top-2">
            <button onClick={onStar} className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
              <Star className={`h-3.5 w-3.5 ${t.starred ? "fill-amber-400 text-amber-400" : ""}`} />
            </button>
          </div>
        </div>
      )}
      <div className="p-3">
        {!t.cover_url && (
          <div className="mb-2 flex gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${platColor}`}>{platName}</span>
            {t.rank_on_list && <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white">#{t.rank_on_list}</span>}
            {isManual && <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-white">手动</span>}
          </div>
        )}
        <h3 className={`mb-1.5 font-medium ${t.read ? "text-gray-600" : "text-gray-900"}`}>
          {!t.read && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />}
          {t.title}
        </h3>
        {t.description && <p className="mb-2 line-clamp-2 text-xs text-gray-500">{t.description}</p>}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {t.hot_score != null && <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3 text-rose-500" />{formatNum(t.hot_score)}</span>}
          {t.views != null && <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{formatNum(t.views)}</span>}
          {t.likes != null && <span className="inline-flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{formatNum(t.likes)}</span>}
          {t.author && <span className="text-gray-400">{t.author}</span>}
        </div>
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">音乐度</span>
          <ScoreBar score={t.music_score} />
        </div>

        <div className="flex flex-wrap gap-1">
          <button onClick={onStar} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
            <Star className={`h-3 w-3 ${t.starred ? "fill-amber-400 text-amber-400" : ""}`} />
            {t.starred ? "已收藏" : "收藏"}
          </button>
          <button
            onClick={onToggle}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
              t.analyzed ? "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Brain className="h-3 w-3" />{t.analyzed ? "查看拆解" : "AI 拆解"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button onClick={onAddPool} className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100">
            <Plus className="h-3 w-3" />候选
          </button>
          {t.source_url && (
            <a href={t.source_url} target="_blank" rel="noreferrer" className="rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:bg-gray-50">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-purple-100 bg-gradient-to-br from-purple-50/50 to-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-semibold text-purple-700">
              <Sparkles className="h-3 w-3" />AI 拆解结果
            </div>
            {t.analyzed && !analyzing && (
              <button
                onClick={runAnalyze}
                className="text-[10px] text-purple-600 hover:underline"
              >
                重新拆解
              </button>
            )}
          </div>
          {analyzing ? (
            <div className="flex items-center gap-2 py-4 text-xs text-purple-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />Qwen 正在拆解，约需 10-20 秒…
            </div>
          ) : t.analyzed && loadingFactors ? (
            <div className="py-4"><Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" /></div>
          ) : t.analyzed && factors ? (
            <FactorsView f={factors} />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">该条目尚未拆解，点下方按钮让 Claude 分析爆点</p>
              <button
                onClick={runAnalyze}
                className="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-white px-2 py-1 text-xs text-purple-700 hover:bg-purple-50"
              >
                <Sparkles className="h-3 w-3" />立即 AI 拆解
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI 拆解结果视图 ──────────────────────────────────────────────────────────

function FactorsView({ f }: { f: HitFactors }) {
  const rows: [string, string][] = [
    ["🎣 钩子", f.hook],
    ["🎬 结构", f.structure],
    ["💖 情绪", f.emotion],
    ["🎯 切入", f.topic_angle],
    ["👥 人群", f.audience],
    ["🎨 形式", f.format],
  ];
  const reps = (f.replicable_elements || "").split("\n").filter(Boolean);
  const adv = (f.adaptation_advice || "").split("\n").filter(Boolean);
  const sum = (f.raw_json as Record<string, unknown> | null)?.summary as string | undefined;
  return (
    <div className="space-y-2 text-xs">
      {sum && (
        <div className="rounded-md bg-purple-100/70 px-2 py-1.5 text-purple-900">
          <b>一句话总结：</b>{sum}
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {rows.map(([label, val]) => val && (
          <div key={label} className="rounded-md border border-purple-100 bg-white/70 px-2 py-1.5">
            <div className="text-[10px] text-purple-500">{label}</div>
            <div className="text-gray-700">{val}</div>
          </div>
        ))}
      </div>
      {reps.length > 0 && (
        <div className="rounded-md border border-purple-100 bg-white/70 px-2 py-1.5">
          <div className="mb-1 text-[10px] text-purple-500">✨ 可复用套路</div>
          <ul className="list-disc space-y-0.5 pl-4 text-gray-700">
            {reps.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {adv.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1.5">
          <div className="mb-1 text-[10px] text-amber-700">🎵 音乐密码改编建议</div>
          <ul className="list-disc space-y-0.5 pl-4 text-gray-700">
            {adv.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        <span>复刻难度：{"⭐".repeat(f.difficulty)}{"☆".repeat(5 - f.difficulty)}</span>
        {f.tags && f.tags.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {f.tags.map((tag) => (
              <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">#{tag}</span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// ── 套路库视图 ───────────────────────────────────────────────────────────────

function TropesView() {
  const categories = [
    { key: "hook", label: "🎣 钩子套路", color: "orange" },
    { key: "structure", label: "🎬 结构套路", color: "blue" },
    { key: "emotion", label: "💖 情绪套路", color: "rose" },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-purple-800">
          <Target className="h-4 w-4" />套路库说明
        </p>
        <p className="mt-1 text-xs text-purple-700">
          从拆解过的 <b>23 条爆款</b>中自动提炼的可复用套路，在 AI 创作区可直接勾选引用。
          点击任一套路查看来源爆款、使用次数。
        </p>
      </div>
      {categories.map((cat) => (
        <div key={cat.key} className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{cat.label}</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {mockTropes.filter((t) => t.category === cat.key).map((tr) => (
              <div key={tr.id} className="rounded-lg border border-gray-200 p-3 hover:border-gray-300 hover:shadow-sm">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900">{tr.title}</p>
                  <span className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{tr.usage}条</span>
                </div>
                <p className="mb-2 text-xs text-gray-500">{tr.desc}</p>
                <div className="flex gap-1">
                  <button className="rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50">查看来源</button>
                  <button className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 hover:bg-amber-100">+ 引用创作</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 手动录入视图 ─────────────────────────────────────────────────────────────

// ── 手动录入（粘贴链接批量解析） ─────────────────────────────────────────────

interface ImportLog {
  url: string;
  status: "pending" | "ok" | "fail" | "need_manual";
  title?: string;
  error?: string;
  trend_id?: string;
  meta?: { title?: string; description?: string; cover_url?: string; author?: string };
}

function ManualInputView() {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [manualTarget, setManualTarget] = useState<ImportLog | null>(null);

  // 提取所有 URL（换行分隔或空格分隔）
  function extractUrls(text: string): string[] {
    const matches = text.match(/https?:\/\/[^\s<>"']+/g) ?? [];
    return [...new Set(matches)];
  }

  async function runImport() {
    const urls = extractUrls(raw);
    if (urls.length === 0) {
      alert("没有识别到有效的链接（需 http/https 开头）");
      return;
    }
    setRunning(true);
    const init: ImportLog[] = urls.map((u) => ({ url: u, status: "pending" }));
    setLogs(init);

    // 串行（对方站点反爬更友好）
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      try {
        const r = await fetch("/api/content/trends/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: u }),
        });
        const json = await r.json();
        if (r.ok) {
          setLogs((prev) => prev.map((x, idx) => idx === i
            ? { ...x, status: "ok", title: json.trend?.title, trend_id: json.trend?.id } : x));
        } else if (r.status === 422) {
          setLogs((prev) => prev.map((x, idx) => idx === i
            ? { ...x, status: "need_manual", error: json.error, meta: json.meta } : x));
        } else {
          setLogs((prev) => prev.map((x, idx) => idx === i
            ? { ...x, status: "fail", error: json.error ?? `${r.status}` } : x));
        }
      } catch (e) {
        setLogs((prev) => prev.map((x, idx) => idx === i
          ? { ...x, status: "fail", error: e instanceof Error ? e.message : String(e) } : x));
      }
    }
    setRunning(false);
  }

  function clearAll() {
    setRaw("");
    setLogs([]);
  }

  const okCount = logs.filter((l) => l.status === "ok").length;
  const failCount = logs.filter((l) => l.status === "fail").length;
  const needManualCount = logs.filter((l) => l.status === "need_manual").length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">📥 粘贴链接批量导入</h3>
            <p className="mt-0.5 text-[11px] text-gray-500">
              支持抖音 / 小红书 / B站 / 知乎 / 微博 / 公众号等链接，换行或空格分隔，一次可粘多条
            </p>
          </div>
          {logs.length > 0 && (
            <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-900">清空</button>
          )}
        </div>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder={"https://www.xiaohongshu.com/explore/xxxxxx\nhttps://v.douyin.com/abc/\nhttps://www.bilibili.com/video/BV..."}
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:border-gray-900 focus:bg-white focus:outline-none"
        />

        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-gray-500">
            提示：抖音/小红书的<b>短链（v.douyin.com、xhslink.com）</b>解析率最高
          </p>
          <button
            onClick={runImport}
            disabled={running || !raw.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {running ? (<><Loader2 className="h-4 w-4 animate-spin" />解析中…</>) : (<><Plus className="h-4 w-4" />解析并入库</>)}
          </button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-3 text-xs">
            <span className="text-gray-700 font-semibold">导入结果</span>
            <span className="text-green-600">✅ 成功 {okCount}</span>
            {needManualCount > 0 && <span className="text-amber-600">⚠️ 需手动补 {needManualCount}</span>}
            {failCount > 0 && <span className="text-red-600">❌ 失败 {failCount}</span>}
            {running && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
          </div>
          <div className="space-y-1.5">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs">
                <span className="mt-0.5 flex-shrink-0">
                  {log.status === "pending" && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                  {log.status === "ok" && <Check className="h-3 w-3 text-green-600" />}
                  {log.status === "need_manual" && <Edit2 className="h-3 w-3 text-amber-600" />}
                  {log.status === "fail" && <X className="h-3 w-3 text-red-600" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-gray-700">{log.title || log.url}</div>
                  {log.error && <div className="text-[10px] text-red-500">{log.error}</div>}
                </div>
                {log.status === "need_manual" && (
                  <button
                    onClick={() => setManualTarget(log)}
                    className="flex-shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 hover:bg-amber-100"
                  >
                    手动补全
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {manualTarget && (
        <ManualFillModal
          log={manualTarget}
          onClose={() => setManualTarget(null)}
          onSaved={(title) => {
            setLogs((prev) => prev.map((x) => x.url === manualTarget.url
              ? { ...x, status: "ok", title } : x));
            setManualTarget(null);
          }}
        />
      )}
    </div>
  );
}

function ManualFillModal({
  log, onClose, onSaved,
}: {
  log: ImportLog;
  onClose: () => void;
  onSaved: (title: string) => void;
}) {
  const [title, setTitle] = useState(log.meta?.title ?? "");
  const [description, setDescription] = useState(log.meta?.description ?? "");
  const [author, setAuthor] = useState(log.meta?.author ?? "");
  const [cover, setCover] = useState(log.meta?.cover_url ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) { alert("请填写标题"); return; }
    setSaving(true);
    const r = await fetch("/api/content/trends/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: log.url,
        override: { title, description, author, cover_url: cover },
      }),
    });
    const json = await r.json();
    setSaving(false);
    if (!r.ok) { alert("保存失败：" + (json.error ?? r.status)); return; }
    onSaved(title);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">手动补全内容</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 truncate text-[11px] text-gray-500">{log.url}</p>
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs text-gray-600">标题 *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">描述 / 正文</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-gray-600">作者</label>
              <input value={author} onChange={(e) => setAuthor(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">封面 URL</label>
              <input value={cover} onChange={(e) => setCover(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50">取消</button>
          <button onClick={save} disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60">
            {saving ? "保存中…" : "保存入库"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 快捷面板弹窗 ────────────────────────────────────────────────────────────

function QuickPanelModal({
  panel, onClose, platforms, onPlatformsChanged, onPoolChanged,
}: {
  panel: Exclude<QuickPanel, null>;
  onClose: () => void;
  platforms: Platform[];
  onPlatformsChanged: () => void;
  onPoolChanged: () => void;
}) {
  const titles: Record<Exclude<QuickPanel, null>, string> = {
    platforms: "📡 平台管理",
    keywords: "🔤 关键词库",
    pool: "🎯 候选池",
    general: "⚙️ 通用设置",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">{titles[panel]}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {panel === "platforms" && (
            <PlatformsPanel platforms={platforms} onChanged={onPlatformsChanged} />
          )}
          {panel === "keywords" && <KeywordsPanel />}
          {panel === "pool" && <PoolPanel platforms={platforms} onChanged={onPoolChanged} />}
          {panel === "general" && <GeneralPanel />}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50">关闭</button>
        </div>
      </div>
    </div>
  );
}

// ── 平台管理面板（真实 CRUD） ───────────────────────────────────────────────

const COLOR_PRESETS = [
  "bg-black text-white",
  "bg-rose-500 text-white",
  "bg-orange-500 text-white",
  "bg-pink-400 text-white",
  "bg-blue-500 text-white",
  "bg-green-500 text-white",
  "bg-emerald-600 text-white",
  "bg-purple-500 text-white",
  "bg-amber-500 text-white",
  "bg-gray-700 text-white",
];

function PlatformsPanel({ platforms, onChanged }: { platforms: Platform[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Platform | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleEnabled(p: Platform) {
    setSaving(p.id);
    const { error } = await supabase
      .from("content_platforms")
      .update({ enabled: !p.enabled, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    setSaving(null);
    if (error) alert("切换失败：" + error.message);
    else onChanged();
  }

  async function deletePlatform(p: Platform) {
    if (!confirm(`确认删除平台「${p.name}」？已有热点数据不会被删除，但会无法显示。`)) return;
    const { error } = await supabase.from("content_platforms").delete().eq("id", p.id);
    if (error) alert("删除失败：" + error.message);
    else onChanged();
  }

  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">管理要聚合的平台、启停和来源方式</p>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-3 w-3" />新增平台
        </button>
      </div>
      {platforms.length === 0 && <p className="text-center text-xs text-gray-400 py-8">暂无平台，请点「新增平台」</p>}
      {platforms.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
          <span className={`rounded px-2 py-1 text-xs ${p.color_class}`}>{p.name}</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{p.name} <span className="ml-1 text-xs text-gray-400">({p.slug})</span></p>
            <p className="text-xs text-gray-500">来源：{p.source === "dailyhot" ? "DailyHot 自动" : p.source === "trendradar" ? "TrendRadar 聚合" : "手动录入"}</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={p.enabled}
              disabled={saving === p.id}
              onChange={() => toggleEnabled(p)}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-green-500 peer-checked:after:translate-x-4"></div>
          </label>
          <button onClick={() => setEditing(p)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => deletePlatform(p)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {(editing || creating) && (
        <PlatformFormModal
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function PlatformFormModal({
  initial, onClose, onSaved,
}: {
  initial: Platform | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    slug: initial?.slug ?? "",
    name: initial?.name ?? "",
    color_class: initial?.color_class ?? COLOR_PRESETS[0],
    source: initial?.source ?? "manual" as "dailyhot" | "manual" | "trendradar",
    enabled: initial?.enabled ?? true,
    sort_order: initial?.sort_order ?? 99,
    link_format: initial?.link_format ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) {
      alert("请填写平台名称");
      return;
    }
    setSaving(true);
    // 新建时：若未手动指定 slug，用时间戳生成；编辑时保留原 slug
    const autoSlug = initial ? initial.slug : `p_${Date.now().toString(36)}`;
    const payload = {
      ...form,
      slug: (form.slug.trim() || autoSlug).toLowerCase(),
      name: form.name.trim(),
      updated_at: new Date().toISOString(),
    };
    let error;
    if (initial) {
      ({ error } = await supabase.from("content_platforms").update(payload).eq("id", initial.id));
    } else {
      ({ error } = await supabase.from("content_platforms").insert(payload));
    }
    setSaving(false);
    if (error) alert("保存失败：" + error.message);
    else onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{initial ? "编辑平台" : "新增平台"}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">显示名</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="抖音"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">颜色样式</label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color_class: c })}
                  className={`rounded px-2 py-1 text-xs ${c} ${form.color_class === c ? "ring-2 ring-offset-1 ring-gray-900" : ""}`}
                >
                  样例
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">数据来源</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value as "dailyhot" | "manual" | "trendradar" })}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="dailyhot">DailyHot 自动拉取</option>
              <option value="trendradar">TrendRadar 聚合（newsnow）</option>
              <option value="manual">仅手动录入</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">排序（数字越小越靠前）</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50">取消</button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 关键词库面板（真实 CRUD） ──────────────────────────────────────────────

function KeywordsPanel() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKw, setNewKw] = useState("");
  const [newCat, setNewCat] = useState<Keyword["category"]>("music");
  const [newWeight, setNewWeight] = useState(5);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_keyword_library")
      .select("*")
      .order("category", { ascending: true })
      .order("weight", { ascending: false });
    if (!error && data) setKeywords(data as Keyword[]);
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!newKw.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("content_keyword_library").insert({
      keyword: newKw.trim(),
      category: newCat,
      weight: newWeight,
    });
    setAdding(false);
    if (error) {
      if (error.message.includes("duplicate")) alert("该词已存在");
      else alert("添加失败：" + error.message);
      return;
    }
    setNewKw("");
    load();
  }

  async function remove(k: Keyword) {
    if (!confirm(`删除关键词「${k.keyword}」？`)) return;
    const { error } = await supabase.from("content_keyword_library").delete().eq("id", k.id);
    if (error) alert("删除失败：" + error.message);
    else load();
  }

  const catLabels: Record<Keyword["category"], string> = {
    music: "🎵 音乐类",
    brand: "🏷️ 自家品牌",
    custom: "⭐ 自定义",
    negative: "🚫 负向词（排除）",
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div>
      <div className="mb-3">
        <p className="text-sm font-medium text-gray-900">音乐相关关键词库（团队共享）</p>
        <p className="text-xs text-gray-500">用于热榜自动打分。权重越高越优先匹配，负向词会扣分。</p>
      </div>

      {/* 添加框 */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2">
        <select
          value={newCat}
          onChange={(e) => setNewCat(e.target.value as Keyword["category"])}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
        >
          <option value="music">音乐类</option>
          <option value="brand">品牌</option>
          <option value="custom">自定义</option>
          <option value="negative">负向</option>
        </select>
        <input
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="输入关键词，回车添加"
          className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
        />
        <div className="flex items-center gap-1 text-xs text-gray-500">
          权重
          <input
            type="number"
            min={1}
            max={10}
            value={newWeight}
            onChange={(e) => setNewWeight(Math.max(1, Math.min(10, Number(e.target.value))))}
            className="w-12 rounded border border-gray-200 bg-white px-1 py-0.5 text-center"
          />
        </div>
        <button
          onClick={add}
          disabled={adding || !newKw.trim()}
          className="rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {adding ? "..." : "添加"}
        </button>
      </div>

      {/* 分组显示 */}
      <div className="space-y-3">
        {(["music", "brand", "custom", "negative"] as const).map((cat) => {
          const items = keywords.filter((k) => k.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <p className="mb-1 text-xs font-semibold text-gray-600">{catLabels[cat]}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((k) => (
                  <span key={k.id} className="group inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs">
                    {k.keyword}
                    <span className="rounded bg-gray-200 px-1 text-[10px] text-gray-600">{k.weight}</span>
                    <button
                      onClick={() => remove(k)}
                      className="ml-0.5 text-gray-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {keywords.length === 0 && <p className="text-center text-xs text-gray-400 py-4">暂无关键词</p>}
      </div>
    </div>
  );
}

// ── 候选池面板（真实数据） ──────────────────────────────────────────────────

interface PoolRow {
  id: string;
  trend_id: string;
  scope: "personal" | "team";
  note: string;
  created_at: string;
  content_trends: {
    id: string;
    title: string;
    description: string | null;
    platform_slug: string;
    hot_score: number | null;
    music_score: number;
    source_url: string | null;
    cover_url: string | null;
    analyzed: boolean;
  } | null;
}

function PoolPanel({ platforms, onChanged }: { platforms: Platform[]; onChanged: () => void }) {
  const [scope, setScope] = useState<"personal" | "team">(() => getSettings().default_pool_scope);
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: "personal" | "team") => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_candidate_pool")
      .select("id,trend_id,scope,note,created_at,content_trends(id,title,description,platform_slug,hot_score,music_score,source_url,cover_url,analyzed)")
      .eq("scope", s)
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as unknown as PoolRow[]);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(scope); }, [scope, load]);

  async function remove(r: PoolRow) {
    if (!confirm("从候选池移除该条目？")) return;
    const { error } = await supabase.from("content_candidate_pool").delete().eq("id", r.id);
    if (error) alert("移除失败：" + error.message);
    else { load(scope); onChanged(); }
  }

  async function saveNote(r: PoolRow, note: string) {
    const { error } = await supabase.from("content_candidate_pool").update({ note }).eq("id", r.id);
    if (error) alert("备注保存失败：" + error.message);
    else setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, note } : x));
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">候选池保存的热点/爆款，可在「AI 创作区」引用生成选题</p>
        <div className="flex gap-0.5 rounded-lg border border-gray-200 p-0.5 text-xs">
          <button
            onClick={() => setScope("personal")}
            className={`rounded-md px-2 py-0.5 ${scope === "personal" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >个人</button>
          <button
            onClick={() => setScope("team")}
            className={`rounded-md px-2 py-0.5 ${scope === "team" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >团队</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">
          {scope === "personal" ? "个人" : "团队"}候选池是空的，去热榜点 ➕候选 加入
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const t = r.content_trends;
            if (!t) return (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-400">
                （热点已删除）
                <button onClick={() => remove(r)} className="ml-2 text-red-500 hover:underline">清除</button>
              </div>
            );
            const plat = platforms.find((p) => p.slug === t.platform_slug);
            return (
              <div key={r.id} className="rounded-lg border border-gray-200 p-3 hover:border-gray-300">
                <div className="mb-1.5 flex items-start gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${plat?.color_class ?? "bg-gray-200 text-gray-700"}`}>
                    {plat?.name ?? t.platform_slug}
                  </span>
                  {t.analyzed && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">已拆解</span>}
                  <a
                    href={t.source_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex-1 truncate text-sm font-medium text-gray-900 hover:underline ${!t.source_url ? "pointer-events-none" : ""}`}
                  >
                    {t.title}
                  </a>
                  <button onClick={() => remove(r)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {t.description && <p className="mb-2 line-clamp-1 text-xs text-gray-500">{t.description}</p>}
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  {t.hot_score != null && <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3 text-rose-500" />{formatNum(t.hot_score)}</span>}
                  <span>音乐度 {t.music_score}</span>
                  <span className="text-gray-400">加入于 {new Date(r.created_at).toLocaleDateString("zh-CN")}</span>
                </div>
                <input
                  defaultValue={r.note}
                  onBlur={(e) => { if (e.target.value !== r.note) saveNote(r, e.target.value); }}
                  placeholder="备注（失焦保存）"
                  className="mt-2 w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:border-gray-900 focus:bg-white focus:outline-none"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 通用设置面板（localStorage） ────────────────────────────────────────────

function GeneralPanel() {
  const [settings, setSettings] = useState<WorkspaceSettings>(() => getSettings());
  const [aiOpen, setAiOpen] = useState(false);
  const isAdmin = useIsAdmin();

  function update<K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) {
    const next = patchSettings({ [key]: value } as Partial<WorkspaceSettings>);
    setSettings(next);
  }

  return (
    <div className="space-y-4">
      <SettingRow label="自动刷新间隔">
        <select
          value={settings.refresh_interval}
          onChange={(e) => update("refresh_interval", Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
        >
          {REFRESH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </SettingRow>
      <SettingRow label="默认卡片密度">
        <select
          value={settings.default_density}
          onChange={(e) => update("default_density", e.target.value as "card" | "list")}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
        >
          <option value="card">大卡片</option>
          <option value="list">紧凑列表</option>
        </select>
      </SettingRow>
      <SettingRow label="候选池默认归属">
        <select
          value={settings.default_pool_scope}
          onChange={(e) => update("default_pool_scope", e.target.value as "personal" | "team")}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
        >
          <option value="personal">个人私有</option>
          <option value="team">团队共享</option>
        </select>
      </SettingRow>
      <SettingRow label="桌面通知">
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={settings.desktop_notify}
            onChange={(e) => update("desktop_notify", e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-green-500 peer-checked:after:translate-x-4"></div>
        </label>
      </SettingRow>
      <p className="text-[11px] text-gray-400">设置保存在本浏览器（localStorage），修改后立即生效</p>

      {/* AI 模型配置入口 —— 仅系统管理员可见 */}
      {isAdmin && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="mb-2 text-xs font-semibold text-gray-700">🔑 AI 模型配置（内容运营）</div>
          <p className="mb-3 text-[11px] text-gray-500">
            管理本模块调用 Claude / 千问 / 自定义 OpenAI 兼容模型的 API Key。Key 以加密形式保存，仅系统管理员可见。
          </p>
          <button
            onClick={() => setAiOpen(true)}
            className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
          >
            打开 AI 配置面板 →
          </button>
          <AIConfigModal open={aiOpen} onClose={() => setAiOpen(false)} />
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      {children}
    </div>
  );
}

// ── Utils ────────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-200">
        <span
          className={`block h-full ${score >= 85 ? "bg-green-500" : score >= 70 ? "bg-amber-500" : "bg-gray-400"}`}
          style={{ width: `${score}%` }}
        />
      </span>
      <span className="text-[10px] text-gray-500">{score}</span>
    </span>
  );
}

function formatNum(n: number) {
  if (n >= 10000000) return (n / 10000000).toFixed(1) + "kw";
  if (n >= 10000) return (n / 10000).toFixed(1) + "w";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ── AI 创作区 Tab ────────────────────────────────────────────────────────────

interface PickableTrend {
  id: string;
  title: string;
  description: string | null;
  platform_slug: string;
  analyzed: boolean;
}

interface GenResult {
  title: string;
  hook: string;
  script: string;
  key_points: string;
  cta: string;
  hashtags: string[];
}

function CreateTab({ platforms }: { platforms: Platform[] }) {
  const [source, setSource] = useState<"pool" | "hitlib">("pool");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [poolRows, setPoolRows] = useState<PickableTrend[]>([]);
  const [hitRows, setHitRows] = useState<PickableTrend[]>([]);
  const [loadingLeft, setLoadingLeft] = useState(true);

  const [platform, setPlatform] = useState("douyin");
  const [contentType, setContentType] = useState("video");
  const [audience, setAudience] = useState("18-35岁，对音乐有兴趣但零基础");
  const [brief, setBrief] = useState("");

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 加载左侧素材
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLeft(true);
      if (source === "pool") {
        const scope = getSettings().default_pool_scope;
        const { data } = await supabase
          .from("content_candidate_pool")
          .select("content_trends(id,title,description,platform_slug,analyzed)")
          .eq("scope", scope)
          .order("created_at", { ascending: false })
          .limit(100);
        if (!cancelled) {
          const items = (data ?? [])
            .map((r: { content_trends: PickableTrend | PickableTrend[] | null }) => r.content_trends)
            .flat()
            .filter((x): x is PickableTrend => !!x);
          setPoolRows(items);
        }
      } else {
        const { data } = await supabase
          .from("content_trends")
          .select("id,title,description,platform_slug,analyzed")
          .eq("analyzed", true)
          .order("last_seen_at", { ascending: false })
          .limit(100);
        if (!cancelled) setHitRows((data ?? []) as PickableTrend[]);
      }
      if (!cancelled) setLoadingLeft(false);
    })();
    return () => { cancelled = true; };
  }, [source]);

  const leftRows = source === "pool" ? poolRows : hitRows;
  const picked = leftRows.find((r) => r.id === pickedId) ?? null;

  async function generate() {
    if (!brief.trim()) {
      alert("请填写创作简报");
      return;
    }
    setGenerating(true);
    setResult(null);

    try {
      // 如果选了已拆解爆款，拉取它的 factors 一并作为 reference_hit
      let reference_hit: Record<string, unknown> | undefined;
      let reference_trend: Record<string, unknown> | undefined;
      if (picked) {
        if (picked.analyzed) {
          const { data: f } = await supabase
            .from("content_hit_factors")
            .select("*")
            .eq("trend_id", picked.id)
            .maybeSingle();
          reference_hit = {
            title: picked.title,
            ai_analysis: f ? {
              hook: f.hook,
              structure: f.structure,
              emotion: f.emotion,
              replicable_elements: (f.replicable_elements as string || "").split("\n").filter(Boolean),
            } : undefined,
          };
        } else {
          reference_trend = { title: picked.title, description: picked.description };
        }
      }

      const r = await fetch("/api/content/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          content_type: contentType,
          target_audience: audience,
          creative_brief: brief,
          reference_trend,
          reference_hit,
        }),
      });
      const json = await r.json();
      if (!r.ok) alert("生成失败：" + (json.error ?? r.status));
      else setResult(json.result as GenResult);
    } catch (e) {
      alert("网络错误：" + (e instanceof Error ? e.message : String(e)));
    }
    setGenerating(false);
  }

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {/* 左侧：素材选择 */}
      <div className="lg:col-span-2 space-y-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">📚 引用素材（可选）</p>
            <div className="flex gap-0.5 rounded-lg border border-gray-200 p-0.5 text-xs">
              <button
                onClick={() => { setSource("pool"); setPickedId(null); }}
                className={`rounded-md px-2 py-0.5 ${source === "pool" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >候选池</button>
              <button
                onClick={() => { setSource("hitlib"); setPickedId(null); }}
                className={`rounded-md px-2 py-0.5 ${source === "hitlib" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >爆款库</button>
            </div>
          </div>
          <p className="mb-2 text-[11px] text-gray-500">选一条作为参考，Claude 会结合它的钩子/结构生成脚本</p>
          {loadingLeft ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
          ) : leftRows.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">
              {source === "pool" ? "候选池是空的，去热榜点 ➕候选 加入" : "还没有已拆解的爆款"}
            </p>
          ) : (
            <div className="max-h-[480px] space-y-1.5 overflow-y-auto">
              {leftRows.map((r) => {
                const plat = platforms.find((p) => p.slug === r.platform_slug);
                const on = pickedId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setPickedId(on ? null : r.id)}
                    className={`w-full rounded-lg border p-2 text-left transition ${
                      on ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${plat?.color_class ?? "bg-gray-200 text-gray-700"}`}>
                        {plat?.name ?? r.platform_slug}
                      </span>
                      {r.analyzed && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">已拆解</span>}
                      {on && <Check className="ml-auto h-3 w-3 text-purple-600" />}
                    </div>
                    <p className="line-clamp-2 text-xs font-medium text-gray-900">{r.title}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 右侧：生成参数 + 结果 */}
      <div className="lg:col-span-3 space-y-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-900">创作简报</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-gray-600">目标平台</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
              >
                <option value="douyin">抖音</option>
                <option value="xiaohongshu">小红书</option>
                <option value="shipinhao">视频号</option>
                <option value="bilibili">B站</option>
                <option value="weixin">公众号</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-gray-600">内容形式</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
              >
                <option value="video">短视频口播</option>
                <option value="image_text">图文</option>
                <option value="article">长文</option>
              </select>
            </div>
          </div>

          <div className="mt-2">
            <label className="mb-1 block text-[11px] text-gray-600">目标人群</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div className="mt-2">
            <label className="mb-1 block text-[11px] text-gray-600">创作简报 *</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="例：想介绍音乐密码 Pro 的自动教学功能，突出零基础 30 天能弹一首歌的卖点。目标是吸引有兴趣买乐器送孩子的家长。"
              className="w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
            />
          </div>

          {picked && (
            <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs">
              <p className="text-purple-700"><b>已引用：</b>{picked.title}</p>
              <button onClick={() => setPickedId(null)} className="mt-0.5 text-[10px] text-purple-500 hover:underline">取消引用</button>
            </div>
          )}

          <button
            onClick={generate}
            disabled={generating || !brief.trim()}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? (<><Loader2 className="h-4 w-4 animate-spin" />Claude 正在创作…</>) : (<><Sparkles className="h-4 w-4" />生成脚本</>)}
          </button>
        </div>

        {result && (
          <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/50 to-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-900">生成结果</h3>
              <button
                onClick={() => copy("all", [
                  `标题：${result.title}`,
                  `钩子：${result.hook}`,
                  `正文：${result.script}`,
                  `卖点：${result.key_points}`,
                  `CTA：${result.cta}`,
                  `标签：${result.hashtags.map((h) => "#" + h).join(" ")}`,
                ].join("\n\n"))}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
              >
                {copiedKey === "all" ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copiedKey === "all" ? "已复制" : "一键复制"}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <ResultRow label="📌 标题" value={result.title} onCopy={() => copy("title", result.title)} copied={copiedKey === "title"} />
              <ResultRow label="🎣 开头钩子" value={result.hook} onCopy={() => copy("hook", result.hook)} copied={copiedKey === "hook"} />
              <ResultRow label="📝 正文" value={result.script} onCopy={() => copy("script", result.script)} copied={copiedKey === "script"} multiline />
              <ResultRow label="💡 核心卖点" value={result.key_points} onCopy={() => copy("key_points", result.key_points)} copied={copiedKey === "key_points"} multiline />
              <ResultRow label="📢 CTA" value={result.cta} onCopy={() => copy("cta", result.cta)} copied={copiedKey === "cta"} />
              <div className="rounded-lg border border-purple-100 bg-white/70 px-2 py-1.5">
                <div className="mb-1 text-[10px] text-purple-500">🏷️ 标签</div>
                <div className="flex flex-wrap gap-1">
                  {result.hashtags.map((h) => (
                    <span key={h} className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">#{h}</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-gray-400">后续 Phase 6 将支持&ldquo;一键送入审核发布&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  label, value, onCopy, copied, multiline,
}: {
  label: string; value: string; onCopy: () => void; copied: boolean; multiline?: boolean;
}) {
  return (
    <div className="rounded-lg border border-purple-100 bg-white/70 px-2 py-1.5">
      <div className="mb-0.5 flex items-center justify-between">
        <div className="text-[10px] text-purple-500">{label}</div>
        <button onClick={onCopy} className="text-[10px] text-gray-400 hover:text-gray-700">
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <div className={`text-gray-800 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-400">
      <p className="mb-2 text-lg font-medium">{label}</p>
      <p className="text-xs">此板块将在 &quot;热点发现&quot; 完成后启动开发</p>
    </div>
  );
}
