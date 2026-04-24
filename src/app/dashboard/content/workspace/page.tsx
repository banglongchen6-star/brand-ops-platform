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
  ThumbsUp, Edit2, Trash2, X, Clock, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Types (match DB) ─────────────────────────────────────────────────────────

interface Platform {
  id: string;
  slug: string;
  name: string;
  color_class: string;
  source: "dailyhot" | "manual";
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

// ── Mock data（Phase 2 起会替换为 DB 拉取） ──────────────────────────────────

const mockTrends = [
  {
    id: "t1", platform: "douyin", title: "用AI写一首送给妈妈的歌，全场哭了",
    desc: "抖音话题爆款，AI作曲+亲情共鸣，播放破亿",
    hot: 12500, rank: 1, author: "@音乐小能人", views: 125000000,
    cover: "https://picsum.photos/seed/t1/400/240",
    music_score: 95, starred: true, read: true, analyzed: true,
  },
  {
    id: "t2", platform: "bilibili", title: "【翻唱】周杰伦《晴天》指弹吉他版",
    desc: "B站热门，一位UP主用智能吉他教程演示",
    hot: 8900, rank: 3, author: "@琴艺少年",
    views: 3200000, likes: 210000, comments: 4500,
    cover: "https://picsum.photos/seed/t2/400/240",
    music_score: 92, starred: false, read: false, analyzed: false,
  },
  {
    id: "t3", platform: "weibo", title: "#某音乐综艺冠军曝光#",
    desc: "微博热搜榜 TOP5，娱乐向，周边关注乐器购买",
    hot: 6700, rank: 5, author: null, views: null,
    cover: null,
    music_score: 75, starred: false, read: true, analyzed: false,
  },
  {
    id: "t4", platform: "zhihu", title: "零基础多久能学会一首歌？",
    desc: "知乎热榜，关于乐器入门的高赞回答",
    hot: 4200, rank: 12, author: "@音乐老师",
    music_score: 88, starred: true, read: false, analyzed: true,
  },
  {
    id: "t5", platform: "xiaohongshu", title: "我妈50岁学吉他三个月，弹给爸爸听",
    desc: "小红书手动录入，情感向爆款",
    hot: null, rank: null, author: "@张三（录入）",
    cover: "https://picsum.photos/seed/t5/400/240",
    music_score: 98, starred: true, read: true, analyzed: true,
    manual: true,
  },
  {
    id: "t6", platform: "douyin", title: "盲选！你能听出是真人还是AI唱的吗",
    desc: "音乐互动类短视频，评论区疯狂",
    hot: 9800, rank: 2, author: "@音乐评测",
    views: 58000000,
    cover: "https://picsum.photos/seed/t6/400/240",
    music_score: 90, starred: false, read: false, analyzed: false,
  },
];

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

  const loadPlatforms = useCallback(async () => {
    setLoadingPlatforms(true);
    const { data, error } = await supabase
      .from("content_platforms")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data) setPlatforms(data as Platform[]);
    setLoadingPlatforms(false);
  }, []);

  useEffect(() => { loadPlatforms(); }, [loadPlatforms]);

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
        <TrendsTab platforms={platforms} loadingPlatforms={loadingPlatforms} onOpenPanel={setPanel} />
      )}
      {activeTab === "create" && <Placeholder label="✨ AI 创作区" />}
      {activeTab === "review" && <Placeholder label="✅ 审核发布" />}
      {activeTab === "analytics" && <Placeholder label="📊 内容复盘" />}

      {panel && (
        <QuickPanelModal
          panel={panel}
          onClose={() => setPanel(null)}
          platforms={platforms}
          onPlatformsChanged={loadPlatforms}
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
}: {
  platforms: Platform[];
  loadingPlatforms: boolean;
  onOpenPanel: (p: QuickPanel) => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>("live");
  const [density, setDensity] = useState<Density>("card");
  const enabledPlatforms = platforms.filter((p) => p.enabled);
  const [activeSlugs, setActiveSlugs] = useState<string[] | null>(null);
  const [musicFilter, setMusicFilter] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 默认选中所有启用平台
  useEffect(() => {
    if (activeSlugs === null && enabledPlatforms.length > 0) {
      setActiveSlugs(enabledPlatforms.map((p) => p.slug));
    }
  }, [enabledPlatforms, activeSlugs]);

  const selected = activeSlugs ?? [];

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
          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">5</span>
        </button>
        <span className="ml-auto text-[11px] text-gray-400">上次刷新：2 分钟前</span>
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
              <button className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                <RefreshCw className="h-3 w-3" />刷新
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

          {/* Content list (mock, Phase 2 将接入 DB) */}
          {density === "card" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {mockTrends
                .filter((t) => subTab !== "starred" || t.starred)
                .filter((t) => subTab !== "hitlib" || t.analyzed)
                .filter((t) => selected.includes(t.platform))
                .filter((t) => !musicFilter || t.music_score >= 70)
                .filter((t) => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()))
                .map((t) => (
                  <TrendCard key={t.id} t={t} platforms={platforms} expanded={expandedId === t.id} onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)} />
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
                  {mockTrends
                    .filter((t) => subTab !== "starred" || t.starred)
                    .filter((t) => subTab !== "hitlib" || t.analyzed)
                    .filter((t) => selected.includes(t.platform))
                    .filter((t) => !musicFilter || t.music_score >= 70)
                    .filter((t) => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()))
                    .map((t) => {
                      const plat = platforms.find((p) => p.slug === t.platform);
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${plat?.color_class ?? "bg-gray-200"}`}>{plat?.name ?? t.platform}</span></td>
                          <td className="px-3 py-2 max-w-md truncate font-medium text-gray-900">{t.title}</td>
                          <td className="px-3 py-2 text-right text-xs text-gray-600">{t.hot?.toLocaleString() ?? "—"}</td>
                          <td className="px-3 py-2 text-right"><ScoreBar score={t.music_score} /></td>
                          <td className="px-3 py-2 text-center">
                            {t.starred && <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" />}
                            {t.analyzed && <Brain className="ml-1 inline h-3 w-3 text-purple-500" />}
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            <button className="mr-1 rounded border border-gray-200 px-2 py-0.5 text-gray-700 hover:bg-gray-50">拆解</button>
                            <button className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-700 hover:bg-amber-100">+ 候选</button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── 单条热点卡片 ─────────────────────────────────────────────────────────────

function TrendCard({
  t, platforms, expanded, onToggle,
}: {
  t: typeof mockTrends[0];
  platforms: Platform[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const plat = platforms.find((p) => p.slug === t.platform);
  const platColor = plat?.color_class ?? "bg-gray-200 text-gray-700";
  const platName = plat?.name ?? t.platform;
  return (
    <div className={`group overflow-hidden rounded-xl border bg-white transition hover:shadow-md ${expanded ? "border-purple-300" : "border-gray-200"}`}>
      {t.cover && (
        <div className="relative h-40 overflow-hidden bg-gray-100">
          <img src={t.cover} alt={t.title} className="h-full w-full object-cover" />
          <div className="absolute left-2 top-2 flex gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${platColor}`}>{platName}</span>
            {t.rank && <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">#{t.rank}</span>}
            {t.manual && <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-white">手动</span>}
          </div>
          <div className="absolute right-2 top-2">
            <button className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
              <Star className={`h-3.5 w-3.5 ${t.starred ? "fill-amber-400 text-amber-400" : ""}`} />
            </button>
          </div>
        </div>
      )}
      <div className="p-3">
        {!t.cover && (
          <div className="mb-2 flex gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${platColor}`}>{platName}</span>
            {t.rank && <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white">#{t.rank}</span>}
          </div>
        )}
        <h3 className={`mb-1.5 font-medium text-gray-900 ${!t.read ? "" : "text-gray-600"}`}>
          {!t.read && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />}
          {t.title}
        </h3>
        {t.desc && <p className="mb-2 line-clamp-2 text-xs text-gray-500">{t.desc}</p>}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {t.hot != null && <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3 text-rose-500" />{formatNum(t.hot)}</span>}
          {t.views != null && <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{formatNum(t.views)}</span>}
          {t.likes != null && <span className="inline-flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{formatNum(t.likes)}</span>}
          {t.author && <span className="text-gray-400">{t.author}</span>}
        </div>
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">音乐度</span>
          <ScoreBar score={t.music_score} />
        </div>

        <div className="flex flex-wrap gap-1">
          <button className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
            <Star className="h-3 w-3" />收藏
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
          <button className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100">
            <Plus className="h-3 w-3" />候选
          </button>
          <button className="rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:bg-gray-50">
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-purple-100 bg-gradient-to-br from-purple-50/50 to-white p-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-purple-700">
            <Sparkles className="h-3 w-3" />AI 拆解结果
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <AnalysisBox label="🎣 钩子" text='"用AI给妈妈写歌"——情感+技术反差开场' />
            <AnalysisBox label="🎬 结构" text="痛点(不会写歌)→过程(用AI)→成果(歌曲)→情绪爆发(妈妈反应)" />
            <AnalysisBox label="💖 情绪" text="亲情共鸣 + 科技惊喜" />
            <AnalysisBox label="👥 人群" text="18-35岁，对家人有情感表达需求" />
          </div>
          <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
            <p className="mb-1 text-xs font-semibold text-green-800">✨ 可复用元素</p>
            <ul className="space-y-0.5 text-xs text-green-900">
              <li>1. 用"送给XX"作为情感锚点</li>
              <li>2. 展示AI/科技辅助的低门槛</li>
              <li>3. 结尾真实反应（哭、惊讶）做情绪爆点</li>
            </ul>
          </div>
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2">
            <p className="text-xs text-blue-900">
              <span className="font-semibold">🎯 改编建议：</span>
              把"AI写歌"换成"用音乐密码Pro自动扒谱"，主题改"送给爸妈弹一首"，完美适配产品
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-gray-500">复制难度：</span>
            <span className="text-amber-600">⭐⭐⭐</span>
            <span className="ml-2 text-gray-500">标签：</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">亲情</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">AI辅助</span>
          </div>
        </div>
      )}
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

function ManualInputView() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <Edit2 className="mx-auto mb-3 h-8 w-8 text-gray-400" />
      <h3 className="mb-1 text-sm font-semibold text-gray-900">手动录入爆款</h3>
      <p className="mx-auto mb-4 max-w-md text-xs text-gray-500">
        小红书、视频号、公众号等没法自动抓取的平台，或同事推荐的优质内容，通过这里录入。
      </p>
      <button className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
        <Plus className="h-4 w-4" />新增录入
      </button>
      <p className="mt-4 text-[10px] text-gray-400">录入后会进入"我的收藏"与"历史"，可直接做 AI 拆解</p>
    </div>
  );
}

// ── 快捷面板弹窗 ────────────────────────────────────────────────────────────

function QuickPanelModal({
  panel, onClose, platforms, onPlatformsChanged,
}: {
  panel: Exclude<QuickPanel, null>;
  onClose: () => void;
  platforms: Platform[];
  onPlatformsChanged: () => void;
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
          {panel === "pool" && <PoolPanelMock />}
          {panel === "general" && <GeneralPanelMock />}
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
            <p className="text-xs text-gray-500">来源：{p.source === "dailyhot" ? "DailyHot 自动" : "手动录入"}</p>
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
    source: initial?.source ?? "manual" as "dailyhot" | "manual",
    enabled: initial?.enabled ?? true,
    sort_order: initial?.sort_order ?? 99,
    link_format: initial?.link_format ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.slug.trim() || !form.name.trim()) {
      alert("slug 和 名称 必填");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      slug: form.slug.trim().toLowerCase(),
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
            <label className="mb-1 block text-xs text-gray-600">Slug（英文唯一标识，如 douyin）</label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              disabled={!!initial}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-50"
              placeholder="douyin"
            />
          </div>
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
              onChange={(e) => setForm({ ...form, source: e.target.value as "dailyhot" | "manual" })}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="dailyhot">DailyHot 自动拉取</option>
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

// ── 候选池 / 通用 面板（仍为 mock，Phase 4 接入） ────────────────────────────

function PoolPanelMock() {
  return (
    <div className="space-y-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">候选池保存的热点/爆款，可直接在「AI 创作区」引用生成选题</p>
        <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5 text-xs">
          <button className="rounded-md bg-gray-900 px-2 py-0.5 text-white">个人</button>
          <button className="rounded-md px-2 py-0.5 text-gray-600 hover:bg-gray-100">团队</button>
        </div>
      </div>
      <p className="py-6 text-center text-xs text-gray-400">（Phase 4 接入真实数据）</p>
    </div>
  );
}

function GeneralPanelMock() {
  return (
    <div className="space-y-4">
      <SettingRow label="自动刷新间隔">
        <select className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
          <option>关闭</option><option>5 分钟</option><option>15 分钟</option><option>30 分钟</option><option>1 小时</option>
        </select>
      </SettingRow>
      <SettingRow label="默认卡片密度">
        <select className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
          <option>大卡片</option><option>紧凑列表</option>
        </select>
      </SettingRow>
      <SettingRow label="候选池默认归属">
        <select className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
          <option>个人私有</option><option>团队共享</option>
        </select>
      </SettingRow>
      <p className="text-[11px] text-gray-400">（通用设置 Phase 4 接入，暂不保存）</p>
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

function AnalysisBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <p className="mb-0.5 font-semibold text-gray-700">{label}</p>
      <p className="text-gray-600">{text}</p>
    </div>
  );
}

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

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-400">
      <p className="mb-2 text-lg font-medium">{label}</p>
      <p className="text-xs">此板块将在 &quot;热点发现&quot; 完成后启动开发</p>
    </div>
  );
}
