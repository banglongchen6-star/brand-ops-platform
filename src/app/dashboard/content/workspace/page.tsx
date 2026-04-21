"use client";

/* eslint-disable @next/next/no-img-element */
// 内容运营工作台 —— 前端示意模板（纯静态假数据，不接后端）

import { useState } from "react";
import Link from "next/link";
import {
  Flame, Sparkles, ShieldCheck, BarChart3,
  ArrowLeft, Settings, Bell, Target,
  Search, RefreshCw, LayoutGrid, List, CheckSquare,
  Star, Brain, Plus, Eye, ExternalLink, ChevronDown, ChevronUp,
  ThumbsUp, Edit2, Trash2, X, Clock,
} from "lucide-react";

// ── Mock Data ────────────────────────────────────────────────────────────────

const mockPlatforms = [
  { slug: "douyin", name: "抖音", color: "bg-black text-white", enabled: true, source: "DailyHot" },
  { slug: "xiaohongshu", name: "小红书", color: "bg-rose-500 text-white", enabled: true, source: "手动" },
  { slug: "weibo", name: "微博", color: "bg-orange-500 text-white", enabled: true, source: "DailyHot" },
  { slug: "bilibili", name: "B站", color: "bg-pink-400 text-white", enabled: true, source: "DailyHot" },
  { slug: "zhihu", name: "知乎", color: "bg-blue-500 text-white", enabled: true, source: "DailyHot" },
  { slug: "shipinhao", name: "视频号", color: "bg-green-500 text-white", enabled: false, source: "手动" },
  { slug: "weixin", name: "公众号", color: "bg-emerald-600 text-white", enabled: false, source: "手动" },
];

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

const mockKeywords = [
  { cat: "music", kw: "音乐", weight: 10 },
  { cat: "music", kw: "乐器", weight: 10 },
  { cat: "music", kw: "钢琴", weight: 9 },
  { cat: "music", kw: "吉他", weight: 9 },
  { cat: "music", kw: "唱", weight: 6 },
  { cat: "music", kw: "歌", weight: 6 },
  { cat: "brand", kw: "音乐密码", weight: 10 },
  { cat: "custom", kw: "智能乐器", weight: 8 },
];

// ── Page ─────────────────────────────────────────────────────────────────────

type TabKey = "trends" | "create" | "review" | "analytics";
type SubTab = "live" | "starred" | "hitlib" | "tropes" | "manual" | "history";
type Density = "card" | "list";

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
  const [showSettings, setShowSettings] = useState(false);

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
            <button className="relative rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <Target className="inline h-4 w-4" /> <span className="ml-1">候选池</span>
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">5</span>
            </button>
            <button className="relative rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <button onClick={() => setShowSettings(true)} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50">
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
      {activeTab === "trends" && <TrendsTab />}
      {activeTab === "create" && <Placeholder label="✨ AI 创作区" />}
      {activeTab === "review" && <Placeholder label="✅ 审核发布" />}
      {activeTab === "analytics" && <Placeholder label="📊 内容复盘" />}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── 热点发现 Tab ─────────────────────────────────────────────────────────────

function TrendsTab() {
  const [subTab, setSubTab] = useState<SubTab>("live");
  const [density, setDensity] = useState<Density>("card");
  const [activePlatforms, setActivePlatforms] = useState<string[]>(["douyin", "bilibili", "weibo", "zhihu"]);
  const [musicFilter, setMusicFilter] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      {/* Sub-tab specific content */}
      {subTab === "tropes" ? <TropesView /> : subTab === "manual" ? <ManualInputView /> : (
        <>
          {/* Filter Bar */}
          <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">平台：</span>
              {mockPlatforms.filter((p) => p.enabled).map((p) => {
                const on = activePlatforms.includes(p.slug);
                return (
                  <button
                    key={p.slug}
                    onClick={() => setActivePlatforms((prev) => on ? prev.filter((x) => x !== p.slug) : [...prev, p.slug])}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${
                      on ? p.color : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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

          {/* Content list */}
          {density === "card" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {mockTrends
                .filter((t) => subTab !== "starred" || t.starred)
                .filter((t) => subTab !== "hitlib" || t.analyzed)
                .filter((t) => activePlatforms.includes(t.platform))
                .filter((t) => !musicFilter || t.music_score >= 70)
                .filter((t) => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()))
                .map((t) => (
                  <TrendCard key={t.id} t={t} expanded={expandedId === t.id} onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)} />
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
                    .filter((t) => activePlatforms.includes(t.platform))
                    .filter((t) => !musicFilter || t.music_score >= 70)
                    .filter((t) => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()))
                    .map((t) => {
                      const plat = mockPlatforms.find((p) => p.slug === t.platform)!;
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${plat.color}`}>{plat.name}</span></td>
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

function TrendCard({ t, expanded, onToggle }: { t: typeof mockTrends[0]; expanded: boolean; onToggle: () => void }) {
  const plat = mockPlatforms.find((p) => p.slug === t.platform)!;
  return (
    <div className={`group overflow-hidden rounded-xl border bg-white transition hover:shadow-md ${expanded ? "border-purple-300" : "border-gray-200"}`}>
      {t.cover && (
        <div className="relative h-40 overflow-hidden bg-gray-100">
          <img src={t.cover} alt={t.title} className="h-full w-full object-cover" />
          <div className="absolute left-2 top-2 flex gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${plat.color}`}>{plat.name}</span>
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
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${plat.color}`}>{plat.name}</span>
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

// ── 设置弹窗 ─────────────────────────────────────────────────────────────────

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"platforms" | "keywords" | "general">("platforms");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5" />工作台设置
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex border-b border-gray-100">
          <SettingTab label="📡 平台管理" active={tab === "platforms"} onClick={() => setTab("platforms")} />
          <SettingTab label="🔤 关键词库" active={tab === "keywords"} onClick={() => setTab("keywords")} />
          <SettingTab label="⚙️ 通用" active={tab === "general"} onClick={() => setTab("general")} />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {tab === "platforms" && (
            <div className="space-y-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-gray-500">管理要聚合的平台、启停和来源方式</p>
                <button className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">
                  <Plus className="h-3 w-3" />新增平台
                </button>
              </div>
              {mockPlatforms.map((p) => (
                <div key={p.slug} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                  <span className={`rounded px-2 py-1 text-xs ${p.color}`}>{p.name}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{p.name} <span className="ml-1 text-xs text-gray-400">({p.slug})</span></p>
                    <p className="text-xs text-gray-500">来源：{p.source}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" defaultChecked={p.enabled} className="peer sr-only" />
                    <div className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-green-500 peer-checked:after:translate-x-4"></div>
                  </label>
                  <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          {tab === "keywords" && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">音乐相关关键词库（团队共享）</p>
                  <p className="text-xs text-gray-500">用于热榜自动过滤。权重越高越优先匹配。</p>
                </div>
                <button className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">
                  <Plus className="h-3 w-3" />添加词
                </button>
              </div>
              <div className="space-y-1">
                {["music", "brand", "custom"].map((cat) => (
                  <div key={cat}>
                    <p className="mb-1 text-xs font-semibold text-gray-600">
                      {cat === "music" ? "🎵 音乐类" : cat === "brand" ? "🏷️ 自家品牌" : "⭐ 自定义"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mockKeywords.filter((k) => k.cat === cat).map((k) => (
                        <span key={k.kw} className="group inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs">
                          {k.kw}
                          <span className="rounded bg-gray-200 px-1 text-[10px] text-gray-600">{k.weight}</span>
                          <button className="ml-0.5 text-gray-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "general" && (
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
              <SettingRow label="新热点桌面通知">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-green-500 peer-checked:after:translate-x-4"></div>
                </label>
              </SettingRow>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50">关闭</button>
          <button className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800">保存</button>
        </div>
      </div>
    </div>
  );
}

function SettingTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 px-4 py-2.5 text-sm ${active ? "border-b-2 border-gray-900 font-semibold text-gray-900" : "text-gray-500 hover:text-gray-900"}`}>
      {label}
    </button>
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
      <p className="text-xs">此板块将在 "热点发现" 完成后启动开发</p>
    </div>
  );
}
