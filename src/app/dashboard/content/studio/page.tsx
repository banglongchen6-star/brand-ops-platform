"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  Upload,
  FileText,
  Music,
  Trash2,
  Copy,
  Check,
  TrendingUp,
  Flame,
  ExternalLink,
  Search,
  Save,
  FilePlus,
  ChevronRight,
  ChevronDown,
  Edit2,
  RefreshCw,
  Radio,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

type ContentType = "video" | "image" | "article" | "live";
type TopicStatus = "draft" | "reviewing" | "approved" | "producing" | "published" | "archived";
type InspirationKind = "trend" | "hit";

interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface Trend {
  id: string;
  title: string;
  source: string | null;
  category: string | null;
  heat_score: number | null;
  description: string | null;
  related_url: string | null;
  status: string;
  created_at: string;
}

interface HitAnalysis {
  hook: string;
  structure: string;
  emotion: string;
  topic_angle: string;
  audience: string;
  format: string;
  replicable_elements: string[];
  summary: string;
}

interface HitRecord {
  id: string;
  title: string;
  platform: string | null;
  source_url: string | null;
  views: number | null;
  likes: number | null;
  comments_count: number | null;
  shares: number | null;
  raw_content: string | null;
  ai_analysis: HitAnalysis | null;
  summary: string | null;
  created_at: string;
}

interface ContentAccount {
  id: string;
  platform: string;
  account_name: string;
}

interface Topic {
  id: string;
  title: string;
  platform: string | null;
  content_type: ContentType | null;
  account_id: string | null;
  target_audience: string | null;
  creative_brief: string | null;
  script: string | null;
  key_points: string | null;
  referenced_trend_id: string | null;
  referenced_hit_id: string | null;
  attachments: Attachment[] | null;
  status: TopicStatus;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const platformOptions = ["抖音", "小红书", "视频号", "公众号"];
const contentTypeOptions: { value: ContentType; label: string }[] = [
  { value: "video", label: "短视频" },
  { value: "image", label: "图文" },
  { value: "article", label: "长文" },
  { value: "live", label: "直播" },
];
const statusMap: Record<TopicStatus, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  reviewing: { label: "审核中", color: "bg-amber-50 text-amber-700" },
  approved: { label: "已通过", color: "bg-blue-50 text-blue-700" },
  producing: { label: "制作中", color: "bg-purple-50 text-purple-700" },
  published: { label: "已发布", color: "bg-green-50 text-green-700" },
  archived: { label: "归档", color: "bg-gray-100 text-gray-500" },
};
const trendSources = ["抖音热榜", "小红书热搜", "微博热搜", "B站热门", "视频号", "知乎热榜", "百度热搜", "其他"];
const trendCategories = ["行业趋势", "社会事件", "节日营销", "产品相关", "用户痛点", "竞品动态", "娱乐热点", "其他"];
const hitPlatforms = ["抖音", "小红书", "视频号", "公众号", "B站", "快手", "微博", "其他"];

// ── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_DRAFT = {
  title: "",
  platform: "抖音",
  content_type: "video" as ContentType,
  account_id: "",
  target_audience: "",
  creative_brief: "",
  script: "",
  key_points: "",
  referenced_trend_id: "",
  referenced_hit_id: "",
  attachments: [] as Attachment[],
  status: "draft" as TopicStatus,
};

export default function ContentStudioPage() {
  // data
  const [trends, setTrends] = useState<Trend[]>([]);
  const [hits, setHits] = useState<HitRecord[]>([]);
  const [accounts, setAccounts] = useState<ContentAccount[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  // left panel state
  const [leftTab, setLeftTab] = useState<"trend" | "hit" | "all">("all");
  const [search, setSearch] = useState("");

  // right panel (draft)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  // list view of saved topics
  const [showTopics, setShowTopics] = useState(true);

  // modals
  const [showInspirationModal, setShowInspirationModal] = useState<InspirationKind | null>(null);
  const [showHitDetail, setShowHitDetail] = useState<HitRecord | null>(null);

  // actions
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: h }, { data: a }, { data: p }] = await Promise.all([
      supabase.from("content_trends").select("*").order("created_at", { ascending: false }),
      supabase.from("content_hit_factors").select("*").order("created_at", { ascending: false }),
      supabase.from("content_accounts").select("id, platform, account_name").eq("status", "active"),
      supabase.from("content_pieces").select("*").order("created_at", { ascending: false }),
    ]);
    setTrends((t as Trend[]) || []);
    setHits((h as HitRecord[]) || []);
    setAccounts((a as ContentAccount[]) || []);
    setTopics((p as Topic[]) || []);
    setLoading(false);
  }

  // ── Left panel filtering ──────────────────────────────────────────────────
  const filteredInspirations = [
    ...(leftTab === "hit" ? [] : trends.map((t) => ({ kind: "trend" as const, item: t }))),
    ...(leftTab === "trend" ? [] : hits.map((h) => ({ kind: "hit" as const, item: h }))),
  ]
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        item.title?.toLowerCase().includes(s) ||
        ("description" in item && item.description?.toLowerCase().includes(s)) ||
        ("summary" in item && item.summary?.toLowerCase().includes(s))
      );
    })
    .sort((a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime());

  // ── Draft actions ─────────────────────────────────────────────────────────

  function newDraft() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  function loadTopic(t: Topic) {
    setEditingId(t.id);
    setDraft({
      title: t.title || "",
      platform: t.platform || "抖音",
      content_type: t.content_type || "video",
      account_id: t.account_id || "",
      target_audience: t.target_audience || "",
      creative_brief: t.creative_brief || "",
      script: t.script || "",
      key_points: t.key_points || "",
      referenced_trend_id: t.referenced_trend_id || "",
      referenced_hit_id: t.referenced_hit_id || "",
      attachments: t.attachments || [],
      status: t.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addInspiration(kind: InspirationKind, id: string) {
    if (kind === "trend") {
      if (draft.referenced_trend_id === id) return;
      setDraft({ ...draft, referenced_trend_id: id });
    } else {
      if (draft.referenced_hit_id === id) return;
      setDraft({ ...draft, referenced_hit_id: id });
    }
  }

  function removeInspiration(kind: InspirationKind) {
    if (kind === "trend") setDraft({ ...draft, referenced_trend_id: "" });
    else setDraft({ ...draft, referenced_hit_id: "" });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const uploaded: Attachment[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `topics/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("content-attachments").upload(path, file);
      if (error) {
        alert(`上传失败 ${file.name}：${error.message}`);
        continue;
      }
      const { data: pub } = supabase.storage.from("content-attachments").getPublicUrl(path);
      uploaded.push({ url: pub.publicUrl, name: file.name, type: file.type, size: file.size });
    }
    setDraft((d) => ({ ...d, attachments: [...d.attachments, ...uploaded] }));
    setUploading(false);
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setDraft((d) => ({ ...d, attachments: d.attachments.filter((_, i) => i !== idx) }));
  }

  async function handleGenerate() {
    if (!draft.creative_brief.trim()) {
      alert("请先填写创作简报");
      return;
    }
    setGenerating(true);
    try {
      const trend = trends.find((t) => t.id === draft.referenced_trend_id);
      const hit = hits.find((h) => h.id === draft.referenced_hit_id);
      const resp = await fetch("/api/content/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          platform: draft.platform,
          content_type: draft.content_type,
          target_audience: draft.target_audience,
          creative_brief: draft.creative_brief,
          reference_trend: trend || null,
          reference_hit: hit || null,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        alert("AI 生成失败：" + (json.error || "未知错误"));
        return;
      }
      const r = json.result;
      const scriptText = [
        r.hook ? `【开头钩子】\n${r.hook}` : "",
        r.script ? `\n\n【正文脚本】\n${r.script}` : "",
        r.cta ? `\n\n【结尾引导】\n${r.cta}` : "",
        r.hashtags?.length ? `\n\n【标签】\n${r.hashtags.map((t: string) => "#" + t).join(" ")}` : "",
      ].filter(Boolean).join("");
      setDraft((d) => ({
        ...d,
        title: d.title || r.title || "",
        script: scriptText,
        key_points: r.key_points || d.key_points,
      }));
    } catch (err) {
      alert("请求失败：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft(targetStatus?: TopicStatus) {
    if (!draft.title.trim()) {
      alert("请填写选题标题");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: draft.title.trim(),
      platform: draft.platform,
      content_type: draft.content_type,
      account_id: draft.account_id || null,
      target_audience: draft.target_audience.trim() || null,
      creative_brief: draft.creative_brief.trim() || null,
      script: draft.script.trim() || null,
      key_points: draft.key_points.trim() || null,
      referenced_trend_id: draft.referenced_trend_id || null,
      referenced_hit_id: draft.referenced_hit_id || null,
      attachments: draft.attachments,
      status: targetStatus || draft.status,
      updated_at: new Date().toISOString(),
    };
    let error, newId;
    if (editingId) {
      ({ error } = await supabase.from("content_pieces").update(payload).eq("id", editingId));
    } else {
      const { data, error: err } = await supabase
        .from("content_pieces")
        .insert({ ...payload, created_by: user?.id || null })
        .select("id")
        .single();
      error = err;
      newId = data?.id;
    }
    setSaving(false);
    if (error) {
      alert("保存失败：" + error.message);
      return;
    }
    if (newId) setEditingId(newId);
    if (targetStatus) setDraft({ ...draft, status: targetStatus });
    load();
    alert(targetStatus === "reviewing" ? "已提交审核" : "已保存");
  }

  async function handleDeleteTopic(id: string) {
    if (!confirm("确认删除该选题？")) return;
    const { error } = await supabase.from("content_pieces").delete().eq("id", id);
    if (error) return alert("删除失败：" + error.message);
    if (editingId === id) newDraft();
    load();
  }

  function copyScript() {
    if (!draft.script) return;
    navigator.clipboard.writeText(draft.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedTrend = trends.find((t) => t.id === draft.referenced_trend_id);
  const selectedHit = hits.find((h) => h.id === draft.referenced_hit_id);

  return (
    <div className="flex min-h-screen flex-col p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/dashboard/content" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-3 w-3" />返回内容运营
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Sparkles className="h-5 w-5 text-amber-500" />内容工作台
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInspirationModal("trend")}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <TrendingUp className="h-4 w-4" />录入热点
          </button>
          <button
            onClick={() => setShowInspirationModal("hit")}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Flame className="h-4 w-4" />录入爆款
          </button>
          <button
            onClick={newDraft}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            <FilePlus className="h-4 w-4" />新建选题
          </button>
        </div>
      </div>

      {/* Main layout: left pool + right workspace */}
      <div className="grid gap-4 lg:grid-cols-[380px,1fr] lg:items-start">
        {/* ── LEFT: Inspiration Pool ───────────────────────────────────── */}
        <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              📚 灵感池 <span className="text-xs font-normal text-gray-400">{trends.length + hits.length}</span>
            </h2>
            <div className="mb-2 flex gap-1">
              {([
                ["all", "全部", trends.length + hits.length],
                ["trend", "热点", trends.length],
                ["hit", "爆款", hits.length],
              ] as const).map(([k, label, c]) => (
                <button
                  key={k}
                  onClick={() => setLeftTab(k as typeof leftTab)}
                  className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                    leftTab === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label} <span className="opacity-70">{c}</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索标题/描述..."
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-xs focus:border-gray-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : filteredInspirations.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-xs text-gray-400">
                <p className="mb-1">暂无灵感</p>
                <p>点击顶部"录入热点/爆款"</p>
              </div>
            ) : (
              filteredInspirations.map(({ kind, item }) => (
                <InspirationCard
                  key={`${kind}-${item.id}`}
                  kind={kind}
                  item={item}
                  selected={
                    kind === "trend"
                      ? draft.referenced_trend_id === item.id
                      : draft.referenced_hit_id === item.id
                  }
                  onAdd={() => addInspiration(kind, item.id)}
                  onShowDetail={kind === "hit" ? () => setShowHitDetail(item as HitRecord) : undefined}
                />
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Workspace ─────────────────────────────────────────── */}
        <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                ✍️ {editingId ? "编辑选题" : "新建选题"}
              </h2>
              <span className={`rounded px-2 py-0.5 text-xs ${statusMap[draft.status].color}`}>
                {statusMap[draft.status].label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  onClick={newDraft}
                  className="text-xs text-gray-500 hover:text-gray-900"
                >
                  + 新建
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4 p-5">
            {/* Meta row */}
            <div className="grid grid-cols-3 gap-2">
              <SmallField label="平台">
                <select value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
                  {platformOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SmallField>
              <SmallField label="形式">
                <select value={draft.content_type} onChange={(e) => setDraft({ ...draft, content_type: e.target.value as ContentType })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
                  {contentTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </SmallField>
              <SmallField label="发布账号">
                <select value={draft.account_id} onChange={(e) => setDraft({ ...draft, account_id: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
                  <option value="">未指定</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
              </SmallField>
            </div>

            <SmallField label="选题标题 *">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="如：零基础三天学会一首歌？亲测音乐密码Pro" className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none" />
            </SmallField>

            <SmallField label="目标人群">
              <input value={draft.target_audience} onChange={(e) => setDraft({ ...draft, target_audience: e.target.value })} placeholder="如：18-30岁对乐器感兴趣的新手" className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
            </SmallField>

            {/* Referenced inspirations */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">已引用灵感</span>
                <span className="text-[10px] text-gray-400">从左侧点 + 号添加</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTrend && (
                  <ReferencedChip
                    icon={<TrendingUp className="h-3 w-3 text-orange-500" />}
                    label={selectedTrend.title}
                    onRemove={() => removeInspiration("trend")}
                  />
                )}
                {selectedHit && (
                  <ReferencedChip
                    icon={<Flame className="h-3 w-3 text-rose-500" />}
                    label={selectedHit.title}
                    onRemove={() => removeInspiration("hit")}
                  />
                )}
                {!selectedTrend && !selectedHit && (
                  <span className="text-xs text-gray-400">暂无引用（可留空）</span>
                )}
              </div>
            </div>

            <SmallField label="创作简报">
              <textarea
                value={draft.creative_brief}
                onChange={(e) => setDraft({ ...draft, creative_brief: e.target.value })}
                rows={5}
                placeholder="说明本次内容的核心想法、卖点、期望效果..."
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
              />
            </SmallField>

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                {generating ? <><Loader2 className="h-3 w-3 animate-spin" />AI 生成中...</> : <><Sparkles className="h-3 w-3" />AI 生成脚本</>}
              </button>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">脚本内容</span>
                {draft.script && (
                  <button onClick={copyScript} className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-900">
                    {copied ? <><Check className="h-3 w-3 text-green-600" />已复制</> : <><Copy className="h-3 w-3" />复制</>}
                  </button>
                )}
              </div>
              <textarea
                value={draft.script}
                onChange={(e) => setDraft({ ...draft, script: e.target.value })}
                rows={14}
                placeholder="AI 生成后可在此编辑调整"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
              />
            </div>

            <SmallField label="核心卖点 / 记忆点">
              <textarea value={draft.key_points} onChange={(e) => setDraft({ ...draft, key_points: e.target.value })} rows={2} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
            </SmallField>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">素材（图片 / 视频 / 音频）</span>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-700 hover:bg-gray-50">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {uploading ? "上传中" : "上传"}
                  <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
              {draft.attachments.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                  {draft.attachments.map((a, i) => (
                    <div key={i} className="group relative">
                      <AttachmentPreview att={a} />
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">暂无素材</p>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TopicStatus })} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
              {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveDraft()}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                <Save className="h-3 w-3" />保存草稿
              </button>
              <button
                onClick={() => handleSaveDraft("reviewing")}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                保存并提交审核
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved topics list (collapsible) */}
      <div className="mt-4">
        <button
          onClick={() => setShowTopics((s) => !s)}
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          {showTopics ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          已保存选题 <span className="text-xs text-gray-400">({topics.length})</span>
        </button>
        {showTopics && (
          topics.length === 0 ? (
            <p className="text-xs text-gray-400">暂无保存的选题</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {topics.map((t) => {
                const st = statusMap[t.status];
                const isEditing = editingId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg border bg-white p-3 transition ${
                      isEditing ? "border-amber-400 shadow-sm" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${st.color}`}>{st.label}</span>
                      {t.platform && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{t.platform}</span>}
                    </div>
                    <h4 className="mb-2 line-clamp-1 text-sm font-medium text-gray-900">{t.title}</h4>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => loadTopic(t)}
                        className="inline-flex items-center gap-0.5 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50"
                      >
                        <Edit2 className="h-2.5 w-2.5" />编辑
                      </button>
                      <button
                        onClick={() => handleDeleteTopic(t.id)}
                        className="inline-flex items-center gap-0.5 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {showInspirationModal === "trend" && (
        <TrendFormModal onClose={() => setShowInspirationModal(null)} onSaved={load} />
      )}
      {showInspirationModal === "hit" && (
        <HitFormModal onClose={() => setShowInspirationModal(null)} onSaved={load} />
      )}
      {showHitDetail && (
        <HitDetailModal hit={showHitDetail} onClose={() => setShowHitDetail(null)} />
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function InspirationCard({
  kind,
  item,
  selected,
  onAdd,
  onShowDetail,
}: {
  kind: InspirationKind;
  item: Trend | HitRecord;
  selected: boolean;
  onAdd: () => void;
  onShowDetail?: () => void;
}) {
  const isHit = kind === "hit";
  const hit = isHit ? (item as HitRecord) : null;
  const trend = !isHit ? (item as Trend) : null;
  return (
    <div className={`group rounded-lg border p-2.5 transition ${selected ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${isHit ? "bg-rose-50 text-rose-700" : "bg-orange-50 text-orange-700"}`}>
          {isHit ? <Flame className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
          {isHit ? "爆款" : "热点"}
        </span>
        <button
          onClick={onAdd}
          disabled={selected}
          className={`rounded-full p-1 transition ${selected ? "bg-amber-200 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-900 hover:text-white"}`}
          title={selected ? "已引用" : "加入当前选题"}
        >
          {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
      </div>
      <h4 className="mb-1 line-clamp-2 text-xs font-medium text-gray-900">{item.title}</h4>
      {trend && (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
            {trend.source && <span>{trend.source}</span>}
            {trend.heat_score != null && <span className="inline-flex items-center gap-0.5 text-rose-600"><Flame className="h-2.5 w-2.5" />{trend.heat_score}</span>}
          </div>
          {trend.description && <p className="line-clamp-2 text-[10px] text-gray-500">{trend.description}</p>}
        </>
      )}
      {hit && (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
            {hit.platform && <span>{hit.platform}</span>}
            {hit.views != null && <span>播 {formatNum(hit.views)}</span>}
            {hit.likes != null && <span>赞 {formatNum(hit.likes)}</span>}
          </div>
          {hit.summary && <p className="line-clamp-2 text-[10px] text-gray-500">{hit.summary}</p>}
          {hit.ai_analysis && onShowDetail && (
            <button onClick={onShowDetail} className="mt-1 text-[10px] text-blue-600 hover:underline">
              查看拆解 →
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ReferencedChip({ icon, label, onRemove }: { icon: React.ReactNode; label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
      {icon}
      <span className="max-w-[200px] truncate">{label}</span>
      <button onClick={onRemove} className="rounded-full p-0.5 text-amber-700 hover:bg-amber-200">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function AttachmentPreview({ att }: { att: Attachment }) {
  const isImage = att.type.startsWith("image/");
  const isVideo = att.type.startsWith("video/");
  const isAudio = att.type.startsWith("audio/");
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-gray-200 bg-white hover:border-gray-300">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={att.url} alt={att.name} className="h-20 w-full object-cover" />
      ) : isVideo ? (
        <video src={att.url} className="h-20 w-full object-cover" />
      ) : (
        <div className="flex h-20 w-full items-center justify-center bg-gray-50 text-gray-400">
          {isAudio ? <Music className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>
      )}
      <div className="truncate px-1.5 py-1 text-[10px] text-gray-600" title={att.name}>{att.name}</div>
    </a>
  );
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function formatNum(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + "w";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ── Trend form modal ─────────────────────────────────────────────────────────

function TrendFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    source: "抖音热榜",
    category: "行业趋势",
    heat_score: "",
    description: "",
    related_url: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.title.trim()) return alert("请填写热点标题");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("content_trends").insert({
      title: form.title.trim(),
      source: form.source,
      category: form.category,
      heat_score: form.heat_score ? Number(form.heat_score) : null,
      description: form.description.trim() || null,
      related_url: form.related_url.trim() || null,
      tags: form.tags.trim() ? form.tags.split(/[,，\s]+/).filter(Boolean) : null,
      status: "new",
      captured_at: new Date().toISOString(),
      created_by: user?.id || null,
    });
    setSaving(false);
    if (error) return alert("保存失败：" + error.message);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-5 w-5 text-orange-500" />录入热点</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <SmallField label="标题 *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none" />
          </SmallField>
          <div className="grid grid-cols-2 gap-3">
            <SmallField label="来源">
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
                {trendSources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </SmallField>
            <SmallField label="分类">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
                {trendCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </SmallField>
          </div>
          <SmallField label="热度 (0-100)">
            <input type="number" value={form.heat_score} onChange={(e) => setForm({ ...form, heat_score: e.target.value })} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
          </SmallField>
          <SmallField label="描述">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
          </SmallField>
          <SmallField label="原文链接">
            <input value={form.related_url} onChange={(e) => setForm({ ...form, related_url: e.target.value })} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
          </SmallField>
          <SmallField label="标签（逗号分隔）">
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
          </SmallField>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">取消</button>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hit form modal ───────────────────────────────────────────────────────────

function HitFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    platform: "抖音",
    source_url: "",
    views: "",
    likes: "",
    comments: "",
    shares: "",
    raw_content: "",
  });
  const [analyzing, setAnalyzing] = useState(false);

  async function handleAnalyze() {
    if (!form.title.trim() || !form.raw_content.trim()) return alert("请填写标题和内容");
    setAnalyzing(true);
    try {
      const resp = await fetch("/api/content/analyze-hit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          platform: form.platform,
          source_url: form.source_url.trim() || null,
          views: form.views ? Number(form.views) : null,
          likes: form.likes ? Number(form.likes) : null,
          comments: form.comments ? Number(form.comments) : null,
          shares: form.shares ? Number(form.shares) : null,
          raw_content: form.raw_content.trim(),
        }),
      });
      const json = await resp.json();
      if (!resp.ok) return alert("AI 分析失败：" + (json.error || "未知错误"));
      const analysis = json.analysis;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("content_hit_factors").insert({
        title: form.title.trim(),
        platform: form.platform,
        source_url: form.source_url.trim() || null,
        views: form.views ? Number(form.views) : null,
        likes: form.likes ? Number(form.likes) : null,
        comments_count: form.comments ? Number(form.comments) : null,
        shares: form.shares ? Number(form.shares) : null,
        raw_content: form.raw_content.trim(),
        ai_analysis: analysis,
        summary: analysis.summary || null,
        created_by: user?.id || null,
      });
      if (error) return alert("保存失败：" + error.message);
      onSaved();
      onClose();
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Flame className="h-5 w-5 text-rose-500" />录入爆款（AI 自动拆解）</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <SmallField label="爆款标题 *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none" />
          </SmallField>
          <div className="grid grid-cols-2 gap-3">
            <SmallField label="平台">
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none">
                {hitPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </SmallField>
            <SmallField label="原文链接">
              <input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
            </SmallField>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <SmallField label="播放"><input type="number" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none" /></SmallField>
            <SmallField label="点赞"><input type="number" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none" /></SmallField>
            <SmallField label="评论"><input type="number" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none" /></SmallField>
            <SmallField label="分享"><input type="number" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none" /></SmallField>
          </div>
          <SmallField label="内容/文案/转录 *">
            <textarea value={form.raw_content} onChange={(e) => setForm({ ...form, raw_content: e.target.value })} rows={6} placeholder="粘贴视频口播文字稿或文章正文，越完整越准" className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-gray-900 focus:outline-none" />
          </SmallField>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button onClick={onClose} disabled={analyzing} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">取消</button>
          <button onClick={handleAnalyze} disabled={analyzing} className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {analyzing ? <><Loader2 className="h-3 w-3 animate-spin" />AI 拆解中...</> : <><Sparkles className="h-3 w-3" />AI 分析并保存</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hit detail modal ─────────────────────────────────────────────────────────

function HitDetailModal({ hit, onClose }: { hit: HitRecord; onClose: () => void }) {
  const a = hit.ai_analysis!;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Flame className="h-5 w-5 text-rose-500" />爆款拆解
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{hit.title}</h3>
          {hit.summary && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
              <Sparkles className="mr-1 inline h-3 w-3" />{hit.summary}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <DetailCard label="开头钩子" value={a.hook} />
            <DetailCard label="结构节奏" value={a.structure} />
            <DetailCard label="情绪价值" value={a.emotion} />
            <DetailCard label="选题切入" value={a.topic_angle} />
            <DetailCard label="目标人群" value={a.audience} />
            <DetailCard label="表现形式" value={a.format} />
          </div>
          {a.replicable_elements?.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="mb-1.5 text-xs font-semibold text-green-800">✨ 可复用元素</p>
              <ul className="space-y-1 text-xs text-green-900">
                {a.replicable_elements.map((el, i) => (
                  <li key={i}>{i + 1}. {el}</li>
                ))}
              </ul>
            </div>
          )}
          {hit.source_url && (
            <a href={hit.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
              原文链接 <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="mb-1 text-xs font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-600 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
