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
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type ContentStatus = "evaluating" | "approved" | "producing" | "published" | "reviewed";
type ContentPlatform = "douyin" | "xiaohongshu" | "bilibili" | "weibo" | "shipinhao" | "all";
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
}

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_TABS: { key: ContentPlatform; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "douyin", label: "抖音" },
  { key: "xiaohongshu", label: "小红书" },
  { key: "bilibili", label: "B站" },
  { key: "weibo", label: "微博" },
  { key: "shipinhao", label: "视频号" },
];

const PLATFORM_COLORS: Record<string, string> = {
  douyin: "bg-black text-white",
  xiaohongshu: "bg-red-500 text-white",
  bilibili: "bg-blue-500 text-white",
  weibo: "bg-orange-500 text-white",
  shipinhao: "bg-green-600 text-white",
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

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
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

// ── Format number ─────────────────────────────────────────────────────────────

function fmtNum(n: number | null): string {
  if (n == null) return "-";
  if (n >= 10000) return (n / 10000).toFixed(1) + "w";
  return String(n);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformTab, setPlatformTab] = useState<ContentPlatform>("all");
  const [showNew, setShowNew] = useState(false);
  const [editDataTopic, setEditDataTopic] = useState<ContentTopic | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

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

  const filtered = platformTab === "all" ? topics : topics.filter((t) => t.platform === platformTab);

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name || p.email || "未知"]));

  async function handleStatusChange(id: string, status: ContentStatus) {
    setUpdatingStatus(id);
    await supabase.from("content_topics").update({ status }).eq("id", id);
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setUpdatingStatus(null);
  }

  // Stats
  const total = topics.length;
  const producing = topics.filter((t) => t.status === "producing").length;
  const published = topics.filter((t) => t.status === "published").length;
  const now = new Date();
  const thisMonth = topics.filter((t) => {
    if (t.status !== "published") return false;
    const d = new Date(t.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">内容运营</h1>
          <p className="text-sm text-gray-500 mt-1">选题管理与多平台内容分发</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700 shadow-sm"
        >
          <Plus size={16} />
          新建选题
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={<FileVideo size={22} className="text-violet-600" />} label="总选题数" value={total} color="bg-violet-50" />
        <StatCard icon={<Filter size={22} className="text-yellow-600" />} label="制作中" value={producing} color="bg-yellow-50" />
        <StatCard icon={<Check size={22} className="text-green-600" />} label="已发布" value={published} color="bg-green-50" />
        <StatCard icon={<Share2 size={22} className="text-blue-600" />} label="本月发布" value={thisMonth} color="bg-blue-50" />
      </div>

      {/* Status Flow */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
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

      {/* Platform Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
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

      {/* Modals */}
      {showNew && (
        <NewTopicModal profiles={profiles} onClose={() => setShowNew(false)} onSuccess={fetchData} />
      )}
      {editDataTopic && (
        <UpdateDataModal topic={editDataTopic} onClose={() => setEditDataTopic(null)} onSuccess={fetchData} />
      )}
    </div>
  );
}
