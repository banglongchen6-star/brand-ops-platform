"use client";

import { useEffect, useState } from "react";
import {
  FileVideo,
  Plus,
  X,
  Loader2,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2,
  ChevronRight,
  Edit2,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  ShieldCheck,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "workbench" | "generate" | "compliance" | "records";
type ContentStatus = "evaluating" | "approved" | "producing" | "published" | "reviewed";
type ContentPlatform = "douyin" | "xiaohongshu" | "bilibili" | "weibo" | "shipinhao" | "weixin" | "all";
type ContentType = "video" | "image" | "live" | "article";
type ContentSource = "trending" | "original" | "competitor" | "kol";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface ContentTopic {
  id: string;
  title: string;
  platform: string;
  type: ContentType;
  source: ContentSource;
  status: ContentStatus;
  assignee_id: string | null;
  deadline: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  remark: string | null;
  created_at: string;
  publish_date?: string | null;
}

type GeneratedPlatform = {
  title: string;
  title_alts: string[];
  body: string;
  tags: string[];
  tips: string;
};

type ComplianceIssue = {
  type: string;
  severity: "高" | "中" | "低";
  original: string;
  suggestion: string;
  fixed: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS_6 = ["抖音", "B站", "小红书", "视频号", "公众号", "微博"];

const PLATFORM_DB_KEY: Record<string, string> = {
  "抖音": "douyin",
  "B站": "bilibili",
  "小红书": "xiaohongshu",
  "视频号": "shipinhao",
  "公众号": "weixin",
  "微博": "weibo",
};

const PLATFORM_DISPLAY_COLORS: Record<string, string> = {
  "抖音": "bg-gray-900 text-white",
  "B站": "bg-blue-500 text-white",
  "小红书": "bg-red-500 text-white",
  "视频号": "bg-green-600 text-white",
  "公众号": "bg-emerald-600 text-white",
  "微博": "bg-orange-500 text-white",
};

const PLATFORM_TABS: { key: ContentPlatform; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "douyin", label: "抖音" },
  { key: "xiaohongshu", label: "小红书" },
  { key: "bilibili", label: "B站" },
  { key: "weibo", label: "微博" },
  { key: "shipinhao", label: "视频号" },
  { key: "weixin", label: "公众号" },
];

const PLATFORM_COLORS: Record<string, string> = {
  douyin: "bg-gray-900 text-white",
  xiaohongshu: "bg-red-500 text-white",
  bilibili: "bg-blue-500 text-white",
  weibo: "bg-orange-500 text-white",
  shipinhao: "bg-green-600 text-white",
  weixin: "bg-emerald-600 text-white",
};

const STATUS_STEPS: { key: ContentStatus; label: string }[] = [
  { key: "evaluating", label: "待评估" },
  { key: "approved", label: "已立项" },
  { key: "producing", label: "制作中" },
  { key: "published", label: "已发布" },
  { key: "reviewed", label: "已复盘" },
];

const STATUS_COLORS: Record<ContentStatus, string> = {
  evaluating: "bg-gray-100 text-gray-600",
  approved: "bg-blue-100 text-blue-700",
  producing: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  reviewed: "bg-violet-100 text-violet-700",
};

const TYPE_LABELS: Record<ContentType, string> = {
  video: "视频",
  image: "图文",
  live: "直播",
  article: "文章",
};

const TYPE_COLORS: Record<ContentType, string> = {
  video: "bg-purple-100 text-purple-700",
  image: "bg-pink-100 text-pink-700",
  live: "bg-red-100 text-red-700",
  article: "bg-blue-100 text-blue-700",
};

const SOURCE_LABELS: Record<ContentSource, string> = {
  trending: "热点",
  original: "原创",
  competitor: "竞品",
  kol: "达人",
};

const SOURCE_COLORS: Record<ContentSource, string> = {
  trending: "bg-orange-100 text-orange-700",
  original: "bg-teal-100 text-teal-700",
  competitor: "bg-indigo-100 text-indigo-700",
  kol: "bg-violet-100 text-violet-700",
};

const SOP_STEPS = [
  { time: "09:00", label: "选题确认", desc: "确认今日发布选题" },
  { time: "09:20", label: "AI生成", desc: "多平台内容批量生成" },
  { time: "09:50", label: "合规检查", desc: "违规词及平台规则检测" },
  { time: "10:10", label: "发布上线", desc: "各平台同步发布" },
  { time: "18:00", label: "数据复盘", desc: "更新发布数据并复盘" },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtNum(n: number | null): string {
  if (n == null) return "-";
  if (n >= 10000) return (n / 10000).toFixed(1) + "w";
  return String(n);
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── New Topic Modal ───────────────────────────────────────────────────────────

function NewTopicModal({
  profiles,
  onClose,
  onSuccess,
}: {
  profiles: Profile[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    platform: "douyin",
    type: "video" as ContentType,
    source: "original" as ContentSource,
    assignee_id: "",
    deadline: "",
    remark: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("content_topics").insert({
      title: form.title.trim(),
      platform: form.platform,
      type: form.type,
      source: form.source,
      assignee_id: form.assignee_id || null,
      deadline: form.deadline || null,
      remark: form.remark.trim() || null,
      status: "evaluating",
    });
    setSaving(false);
    if (!error) {
      onSuccess();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">新建选题</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">标题 *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="请输入选题标题"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">平台</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {PLATFORM_TABS.filter((p) => p.key !== "all").map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">类型</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ContentType })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {(Object.entries(TYPE_LABELS) as [ContentType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">来源</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as ContentSource })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {(Object.entries(SOURCE_LABELS) as [ContentSource, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">负责人</label>
              <select
                value={form.assignee_id}
                onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">未分配</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">截止日期</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <textarea
              rows={2}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              placeholder="其他备注"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Update Data Modal ─────────────────────────────────────────────────────────

function UpdateDataModal({
  topic,
  onClose,
  onSuccess,
}: {
  topic: ContentTopic;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    views: String(topic.views ?? ""),
    likes: String(topic.likes ?? ""),
    comments: String(topic.comments ?? ""),
    shares: String(topic.shares ?? ""),
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("content_topics").update({
      views: form.views ? Number(form.views) : null,
      likes: form.likes ? Number(form.likes) : null,
      comments: form.comments ? Number(form.comments) : null,
      shares: form.shares ? Number(form.shares) : null,
    }).eq("id", topic.id);
    setSaving(false);
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">更新发布数据</h2>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{topic.title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {[
            { key: "views", label: "播放量", icon: <Eye size={14} className="text-gray-400" /> },
            { key: "likes", label: "点赞数", icon: <ThumbsUp size={14} className="text-gray-400" /> },
            { key: "comments", label: "评论数", icon: <MessageSquare size={14} className="text-gray-400" /> },
            { key: "shares", label: "分享数", icon: <Share2 size={14} className="text-gray-400" /> },
          ].map(({ key, label, icon }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="w-8 flex justify-center">{icon}</div>
              <label className="text-sm text-gray-600 w-16 flex-shrink-0">{label}</label>
              <input
                type="number"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="0"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 1: 今日工作台 ─────────────────────────────────────────────────────────

function WorkbenchTab({
  topics,
  onNavigate,
}: {
  topics: ContentTopic[];
  onNavigate: (tab: Tab) => void;
}) {
  const today = getTodayStr();
  const publishedToday = topics.filter(
    (t) => t.status === "published" && (
      (t.publish_date && t.publish_date.startsWith(today)) ||
      (!t.publish_date && t.created_at.startsWith(today))
    )
  );

  const publishedPlatformKeys = new Set(publishedToday.map((t) => t.platform));

  return (
    <div className="space-y-6">
      {/* 6-platform progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">今日发布进度</h3>
          <span className="text-xs text-gray-400">{today}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PLATFORMS_6.map((p) => {
            const dbKey = PLATFORM_DB_KEY[p];
            const done = publishedPlatformKeys.has(dbKey);
            return (
              <div
                key={p}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl py-4 border-2 transition-all",
                  done
                    ? cn(PLATFORM_DISPLAY_COLORS[p], "border-transparent shadow-sm")
                    : "border-dashed border-gray-200 bg-gray-50 text-gray-400"
                )}
              >
                {done ? (
                  <Check size={18} className="mb-1" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 mb-1" />
                )}
                <span className="text-xs font-medium">{p}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          今日已发布 {publishedToday.length} 篇 / 共 {PLATFORMS_6.length} 个平台
        </p>
      </div>

      {/* SOP steps */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">今日工作流程</h3>
        <div className="space-y-3">
          {SOP_STEPS.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </div>
                {idx < SOP_STEPS.length - 1 && <div className="w-0.5 h-4 bg-violet-100 mt-1" />}
              </div>
              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-violet-500 font-mono font-medium">{step.time}</span>
                  <span className="text-sm font-medium text-gray-800">{step.label}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate("generate")}
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-2xl p-5 text-left transition-colors shadow-sm"
        >
          <Zap size={22} className="mb-2 text-violet-200" />
          <p className="font-semibold text-sm">AI生产线</p>
          <p className="text-xs text-violet-200 mt-0.5">批量生成多平台内容</p>
        </button>
        <button
          onClick={() => onNavigate("compliance")}
          className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl p-5 text-left transition-colors shadow-sm"
        >
          <ShieldCheck size={22} className="mb-2 text-orange-200" />
          <p className="font-semibold text-sm">合规检查</p>
          <p className="text-xs text-orange-200 mt-0.5">违规词与平台规则检测</p>
        </button>
        <button
          onClick={() => onNavigate("records")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-5 text-left transition-colors shadow-sm"
        >
          <BookOpen size={22} className="mb-2 text-emerald-200" />
          <p className="font-semibold text-sm">发布记录</p>
          <p className="text-xs text-emerald-200 mt-0.5">选题管理与数据跟踪</p>
        </button>
      </div>

      {/* Recent published */}
      {publishedToday.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">今日已发布</h3>
          <div className="space-y-2">
            {publishedToday.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <p className="text-sm text-gray-800 flex-1 truncate mr-3">{t.title}</p>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", PLATFORM_COLORS[t.platform] || "bg-gray-200 text-gray-700")}>
                  {PLATFORM_TABS.find((p) => p.key === t.platform)?.label || t.platform}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: AI生产线 ───────────────────────────────────────────────────────────

function GenerateTab() {
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([...PLATFORMS_6]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, GeneratedPlatform> | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string>("");

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleGenerate() {
    if (!topic.trim()) { setError("请输入选题"); return; }
    if (selectedPlatforms.length === 0) { setError("请至少选择一个平台"); return; }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, brief, platforms: selectedPlatforms }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setResult(data.platforms); setExpanded(Object.fromEntries(selectedPlatforms.map((p) => [p, true]))); }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  }

  function buildCopyAll(p: string, d: GeneratedPlatform) {
    return `【${p}】\n标题：${d.title}\n\n正文：\n${d.body}\n\n标签：${d.tags.join(" ")}\n\n备注：${d.tips}`;
  }

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">内容生成参数</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">选题 *</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            placeholder="例：30岁零基础学钢琴，一个月能弹出完整曲子吗？"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">创作方向（可选）</label>
          <textarea
            rows={2}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            placeholder="例：突出真实案例、弱化产品推广感、重点强调30天学习法..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">发布平台</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS_6.map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  selectedPlatforms.includes(p)
                    ? cn(PLATFORM_DISPLAY_COLORS[p], "border-transparent shadow-sm")
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              AI正在生成...预计20-40秒
            </>
          ) : (
            <>
              <Zap size={16} />
              开始生成
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {selectedPlatforms.map((p) => {
            const d = result[p];
            if (!d) return null;
            const isOpen = expanded[p];
            const copyAllKey = `all-${p}`;
            const copyBodyKey = `body-${p}`;
            const copyTitleKey = `title-${p}`;
            return (
              <div key={p} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", PLATFORM_DISPLAY_COLORS[p])}>
                      {p}
                    </span>
                    <span className="text-sm font-medium text-gray-800 line-clamp-1">{d.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => copyText(buildCopyAll(p, d), copyAllKey)}
                      className="flex items-center gap-1 text-xs text-violet-600 border border-violet-200 rounded-lg px-2 py-1 hover:bg-violet-50"
                    >
                      {copied === copyAllKey ? <Check size={11} /> : <Copy size={11} />}
                      全部复制
                    </button>
                    <button
                      onClick={() => setExpanded((prev) => ({ ...prev, [p]: !isOpen }))}
                      className="p-1 rounded-lg hover:bg-gray-100"
                    >
                      {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="p-4 space-y-4">
                    {/* Titles */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">推荐标题</span>
                        <button onClick={() => copyText(d.title, copyTitleKey)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600">
                          {copied === copyTitleKey ? <Check size={10} /> : <Copy size={10} />} 复制
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 bg-violet-50 rounded-lg px-3 py-2">{d.title}</p>
                      {d.title_alts && d.title_alts.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <span className="text-xs text-gray-400">备选标题</span>
                          {d.title_alts.map((alt, i) => (
                            <p key={i} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">{alt}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">正文 / 脚本</span>
                        <button onClick={() => copyText(d.body, copyBodyKey)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600">
                          {copied === copyBodyKey ? <Check size={10} /> : <Copy size={10} />} 复制
                        </button>
                      </div>
                      <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                        {d.body}
                      </pre>
                    </div>

                    {/* Tags */}
                    {d.tags && d.tags.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-1.5">标签</span>
                        <div className="flex flex-wrap gap-1.5">
                          {d.tags.map((tag, i) => (
                            <button
                              key={i}
                              onClick={() => copyText(tag, `tag-${p}-${i}`)}
                              className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tips */}
                    {d.tips && (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <p className="text-xs text-amber-700"><span className="font-medium">发布提示：</span>{d.tips}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab 3: 合规检查 ───────────────────────────────────────────────────────────

function ComplianceTab() {
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("通用");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ issues: ComplianceIssue[]; summary: string; passed: boolean; score: number } | null>(null);
  const [error, setError] = useState("");

  const platformOptions = ["通用", ...PLATFORMS_6];

  async function handleCheck() {
    if (!content.trim()) { setError("请输入待检查内容"); return; }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/content/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, platform: platform === "通用" ? "" : platform }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setResult(data); }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  const severityColor = (s: "高" | "中" | "低") => {
    if (s === "高") return "bg-red-100 text-red-700 border-red-200";
    if (s === "中") return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  };

  const scoreColor = (score: number) => {
    if (score >= 85) return "bg-green-100 text-green-700";
    if (score >= 60) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">合规检查</h3>

        {/* Platform selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">目标平台</label>
          <div className="flex flex-wrap gap-2">
            {platformOptions.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  platform === p
                    ? p === "通用"
                      ? "bg-gray-800 text-white border-transparent"
                      : cn(PLATFORM_DISPLAY_COLORS[p], "border-transparent shadow-sm")
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Content textarea */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">待检查内容</label>
          <textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            placeholder="粘贴需要检查的内容稿件..."
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              AI正在检查...
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              开始检查
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          {/* Score + Summary */}
          <div className="flex items-center gap-4">
            <div className={cn("w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-2xl font-bold", scoreColor(result.score))}>
              {result.score}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", result.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                  {result.passed ? "通过" : "未通过"}
                </span>
                <span className="text-xs text-gray-500">{platform} 平台</span>
              </div>
              <p className="text-sm text-gray-700">{result.summary}</p>
            </div>
          </div>

          {/* Issues */}
          {result.issues.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500">发现 {result.issues.length} 个问题</p>
              {result.issues.map((issue, i) => (
                <div key={i} className={cn("border rounded-xl p-4 space-y-2", severityColor(issue.severity))}>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", severityColor(issue.severity))}>
                      {issue.severity}
                    </span>
                    <span className="text-xs font-medium">{issue.type}</span>
                  </div>
                  <div className="bg-white/60 rounded-lg px-3 py-2 space-y-1">
                    <p className="text-xs text-gray-600"><span className="font-medium">原文：</span>{issue.original}</p>
                    <p className="text-xs text-gray-600"><span className="font-medium">风险：</span>{issue.suggestion}</p>
                    <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 mt-1"><span className="font-medium">建议：</span>{issue.fixed}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-xl p-4">
              <Check size={16} />
              <p className="text-sm font-medium">内容合规，无违规问题</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: 发布记录 ───────────────────────────────────────────────────────────

function RecordsTab({
  topics,
  profiles,
  loading,
  onRefresh,
}: {
  topics: ContentTopic[];
  profiles: Profile[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [platformTab, setPlatformTab] = useState<ContentPlatform>("all");
  const [showNew, setShowNew] = useState(false);
  const [editDataTopic, setEditDataTopic] = useState<ContentTopic | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const filtered = platformTab === "all" ? topics : topics.filter((t) => t.platform === platformTab);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name || p.email || "未知"]));

  async function handleStatusChange(id: string, status: ContentStatus) {
    setUpdatingStatus(id);
    await supabase.from("content_topics").update({ status }).eq("id", id);
    onRefresh();
    setUpdatingStatus(null);
  }

  return (
    <div className="space-y-4">
      {/* Status Flow Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-medium text-gray-500 mb-3">内容流程</p>
        <div className="flex items-center gap-0">
          {STATUS_STEPS.map((step, idx) => {
            const count = topics.filter((t) => t.status === step.key).length;
            const isLast = idx === STATUS_STEPS.length - 1;
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs mb-1">
                    {count}
                  </div>
                  <span className="text-xs text-gray-600 font-medium">{step.label}</span>
                </div>
                {!isLast && <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform tabs + new button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {PLATFORM_TABS.map((p) => {
            const cnt = p.key === "all" ? topics.length : topics.filter((t) => t.platform === p.key).length;
            return (
              <button
                key={p.key}
                onClick={() => setPlatformTab(p.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  platformTab === p.key
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-violet-300"
                )}
              >
                {p.label}
                <span className={cn("ml-1 text-xs", platformTab === p.key ? "text-violet-200" : "text-gray-400")}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700 shadow-sm"
        >
          <Plus size={16} />
          新建选题
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <FileVideo size={28} className="text-violet-300" />
          </div>
          <p className="text-gray-400 text-sm">暂无选题数据</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">标题</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">平台</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">类型</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">来源</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">负责人</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">截止日期</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">数据</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((topic) => (
                  <tr key={topic.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 max-w-[200px] truncate">{topic.title}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PLATFORM_COLORS[topic.platform] || "bg-gray-200 text-gray-700")}>
                        {PLATFORM_TABS.find((p) => p.key === topic.platform)?.label || topic.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TYPE_COLORS[topic.type])}>
                        {TYPE_LABELS[topic.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SOURCE_COLORS[topic.source])}>
                        {SOURCE_LABELS[topic.source]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={topic.status}
                        disabled={updatingStatus === topic.id}
                        onChange={(e) => handleStatusChange(topic.id, e.target.value as ContentStatus)}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-400",
                          STATUS_COLORS[topic.status]
                        )}
                      >
                        {STATUS_STEPS.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {topic.assignee_id ? (profileMap[topic.assignee_id] || "-") : <span className="text-gray-300">未分配</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {topic.deadline ? (
                        <span className={cn(new Date(topic.deadline) < new Date() && topic.status !== "published" && topic.status !== "reviewed" ? "text-red-500 font-medium" : "")}>
                          {topic.deadline}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {topic.status === "published" || topic.status === "reviewed" ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-0.5"><Eye size={11} />{fmtNum(topic.views)}</span>
                          <span className="flex items-center gap-0.5"><ThumbsUp size={11} />{fmtNum(topic.likes)}</span>
                          <span className="flex items-center gap-0.5"><MessageSquare size={11} />{fmtNum(topic.comments)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">未发布</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(topic.status === "published" || topic.status === "reviewed") && (
                        <button
                          onClick={() => setEditDataTopic(topic)}
                          className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 border border-violet-200 rounded-lg px-2 py-1 hover:bg-violet-50"
                        >
                          <Edit2 size={11} />
                          更新数据
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <NewTopicModal profiles={profiles} onClose={() => setShowNew(false)} onSuccess={onRefresh} />
      )}
      {editDataTopic && (
        <UpdateDataModal topic={editDataTopic} onClose={() => setEditDataTopic(null)} onSuccess={onRefresh} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<Tab>("workbench");
  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    const [topicsRes, profilesRes] = await Promise.all([
      supabase.from("content_topics").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    setTopics(topicsRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "workbench", label: "今日工作台", icon: <ClipboardList size={15} /> },
    { key: "generate", label: "AI生产线", icon: <Zap size={15} /> },
    { key: "compliance", label: "合规检查", icon: <ShieldCheck size={15} /> },
    { key: "records", label: "发布记录", icon: <BookOpen size={15} /> },
  ];

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">内容运营工作台</h1>
          <p className="text-sm text-gray-500 mt-1">音乐密码 · 六平台内容生产与管理</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === t.key
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "workbench" && (
        <WorkbenchTab topics={topics} onNavigate={setActiveTab} />
      )}
      {activeTab === "generate" && <GenerateTab />}
      {activeTab === "compliance" && <ComplianceTab />}
      {activeTab === "records" && (
        <RecordsTab
          topics={topics}
          profiles={profiles}
          loading={loading}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
