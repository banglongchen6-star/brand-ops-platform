"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Lightbulb,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  Sparkles,
  Upload,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ContentType = "video" | "image" | "article" | "live";
type TopicStatus = "draft" | "reviewing" | "approved" | "producing" | "published" | "archived";

interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface ContentAccount {
  id: string;
  platform: string;
  account_name: string;
}

interface Trend {
  id: string;
  title: string;
  description: string | null;
}

interface HitRecord {
  id: string;
  title: string;
  ai_analysis: {
    hook: string;
    structure: string;
    emotion: string;
    replicable_elements: string[];
  } | null;
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

const platformOptions = ["抖音", "小红书", "视频号", "公众号"];
const contentTypeOptions: { value: ContentType; label: string }[] = [
  { value: "video", label: "短视频" },
  { value: "image", label: "图文" },
  { value: "article", label: "长文" },
  { value: "live", label: "直播" },
];

const statusMap: Record<TopicStatus, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-700 border-gray-200" },
  reviewing: { label: "审核中", color: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "已通过", color: "bg-blue-50 text-blue-700 border-blue-200" },
  producing: { label: "制作中", color: "bg-purple-50 text-purple-700 border-purple-200" },
  published: { label: "已发布", color: "bg-green-50 text-green-700 border-green-200" },
  archived: { label: "归档", color: "bg-gray-100 text-gray-500 border-gray-200" },
};

export default function ContentTopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [accounts, setAccounts] = useState<ContentAccount[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [hits, setHits] = useState<HitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TopicStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState({
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
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: a }, { data: tr }, { data: h }] = await Promise.all([
      supabase.from("content_pieces").select("*").order("created_at", { ascending: false }),
      supabase.from("content_accounts").select("id, platform, account_name").eq("status", "active"),
      supabase.from("content_trends").select("id, title, description").in("status", ["new", "tracking"]),
      supabase.from("content_hit_factors").select("id, title, ai_analysis").order("created_at", { ascending: false }).limit(50),
    ]);
    setTopics((t as Topic[]) || []);
    setAccounts((a as ContentAccount[]) || []);
    setTrends((tr as Trend[]) || []);
    setHits((h as HitRecord[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      platform: "抖音",
      content_type: "video",
      account_id: "",
      target_audience: "",
      creative_brief: "",
      script: "",
      key_points: "",
      referenced_trend_id: "",
      referenced_hit_id: "",
      attachments: [],
      status: "draft",
    });
    setShowForm(true);
  }

  function openEdit(t: Topic) {
    setEditing(t);
    setForm({
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
    setShowForm(true);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
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
      uploaded.push({
        url: pub.publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }
    setForm((f) => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
    setUploading(false);
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  }

  async function handleGenerate() {
    if (!form.creative_brief.trim()) {
      alert("请先填写创作简报，AI 才能生成脚本");
      return;
    }
    setGenerating(true);
    try {
      const trend = trends.find((t) => t.id === form.referenced_trend_id);
      const hit = hits.find((h) => h.id === form.referenced_hit_id);
      const resp = await fetch("/api/content/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          platform: form.platform,
          content_type: form.content_type,
          target_audience: form.target_audience,
          creative_brief: form.creative_brief,
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
      setForm((f) => ({
        ...f,
        title: f.title || r.title || "",
        script: scriptText,
        key_points: r.key_points || "",
      }));
    } catch (err) {
      alert("请求失败：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      alert("请填写选题标题");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title.trim(),
      platform: form.platform,
      content_type: form.content_type,
      account_id: form.account_id || null,
      target_audience: form.target_audience.trim() || null,
      creative_brief: form.creative_brief.trim() || null,
      script: form.script.trim() || null,
      key_points: form.key_points.trim() || null,
      referenced_trend_id: form.referenced_trend_id || null,
      referenced_hit_id: form.referenced_hit_id || null,
      attachments: form.attachments,
      status: form.status,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("content_pieces").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("content_pieces").insert({ ...payload, created_by: user?.id || null }));
    }
    setSaving(false);
    if (error) {
      alert("保存失败：" + error.message);
      return;
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除该选题？")) return;
    const { error } = await supabase.from("content_pieces").delete().eq("id", id);
    if (error) {
      alert("删除失败：" + error.message);
      return;
    }
    load();
  }

  async function handleStatusChange(id: string, status: TopicStatus) {
    const { error } = await supabase.from("content_pieces").update({ status }).eq("id", id);
    if (error) {
      alert("更新失败：" + error.message);
      return;
    }
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  function copyScript(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filtered = filterStatus === "all" ? topics : topics.filter((t) => t.status === filterStatus);
  const counts = {
    all: topics.length,
    draft: topics.filter((t) => t.status === "draft").length,
    reviewing: topics.filter((t) => t.status === "reviewing").length,
    approved: topics.filter((t) => t.status === "approved").length,
    producing: topics.filter((t) => t.status === "producing").length,
    published: topics.filter((t) => t.status === "published").length,
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard/content" className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />返回内容运营
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Lightbulb className="h-6 w-6 text-amber-500" />选题创作
          </h1>
          <p className="mt-1 text-sm text-gray-500">基于热点与爆款元素，AI 辅助生成选题脚本</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          <Plus className="h-4 w-4" />新建选题
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["all", "全部", counts.all],
          ["draft", "草稿", counts.draft],
          ["reviewing", "审核中", counts.reviewing],
          ["approved", "已通过", counts.approved],
          ["producing", "制作中", counts.producing],
          ["published", "已发布", counts.published],
        ] as const).map(([k, label, c]) => (
          <button
            key={k}
            onClick={() => setFilterStatus(k as TopicStatus | "all")}
            className={`rounded-full border px-3 py-1 text-sm ${
              filterStatus === k ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {label} <span className="ml-1 text-xs opacity-70">{c}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-400">
          <Lightbulb className="mb-3 h-8 w-8" /><p className="text-sm">暂无选题，点击右上角新建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const st = statusMap[t.status];
            const expanded = expandedId === t.id;
            const account = accounts.find((a) => a.id === t.account_id);
            return (
              <div key={t.id} className="group rounded-xl border border-gray-200 bg-white transition hover:shadow-sm">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-2 py-0.5 text-xs ${st.color}`}>{st.label}</span>
                        {t.platform && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{t.platform}</span>}
                        {t.content_type && <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{contentTypeOptions.find(o => o.value === t.content_type)?.label}</span>}
                        {account && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">@{account.account_name}</span>}
                      </div>
                      <h3 className="mb-1 font-semibold text-gray-900">{t.title}</h3>
                      {t.creative_brief && (
                        <p className="line-clamp-2 text-sm text-gray-600">{t.creative_brief}</p>
                      )}
                      {t.attachments && t.attachments.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <File className="h-3 w-3" />{t.attachments.length} 个素材
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value as TopicStatus)}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                      >
                        {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <div className="flex gap-1">
                        <button onClick={() => setExpandedId(expanded ? null : t.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                          {expanded ? <><ChevronUp className="h-3 w-3" />收起</> : <><ChevronDown className="h-3 w-3" />查看</>}
                        </button>
                        <button onClick={() => openEdit(t)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">编辑</button>
                        <button onClick={() => handleDelete(t.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-3 border-t border-gray-100 bg-gray-50/50 p-4">
                    {t.script && (
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-700">📝 脚本</p>
                          <button
                            onClick={() => copyScript(t.id, t.script!)}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            {copiedId === t.id ? <><Check className="h-3 w-3 text-green-600" />已复制</> : <><Copy className="h-3 w-3" />复制</>}
                          </button>
                        </div>
                        <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">{t.script}</div>
                      </div>
                    )}
                    {t.key_points && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-gray-700">💡 核心卖点</p>
                        <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">{t.key_points}</div>
                      </div>
                    )}
                    {t.attachments && t.attachments.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-gray-700">📎 素材</p>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          {t.attachments.map((a, i) => (
                            <AttachmentPreview key={i} att={a} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-semibold">{editing ? "编辑选题" : "新建选题"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4">
              <Field label="选题标题 *">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：零基础一周学会钢琴？亲测实用" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="平台">
                  <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
                    {platformOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="形式">
                  <select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value as ContentType })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
                    {contentTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="发布账号">
                  <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
                    <option value="">未指定</option>
                    {accounts.filter((a) => a.platform === platformOptions.find((p) => p === form.platform)?.toLowerCase() || a.platform).map((a) => (
                      <option key={a.id} value={a.id}>{a.account_name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="目标人群">
                <input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="如：18-30岁对乐器感兴趣的新手" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="参考热点（可选）">
                  <select value={form.referenced_trend_id} onChange={(e) => setForm({ ...form, referenced_trend_id: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
                    <option value="">不引用</option>
                    {trends.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </Field>
                <Field label="参考爆款（可选）">
                  <select value={form.referenced_hit_id} onChange={(e) => setForm({ ...form, referenced_hit_id: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
                    <option value="">不引用</option>
                    {hits.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="创作简报 *">
                <textarea
                  value={form.creative_brief}
                  onChange={(e) => setForm({ ...form, creative_brief: e.target.value })}
                  rows={4}
                  placeholder="说明本次内容的核心想法：想传递什么信息？核心卖点？希望用户看完有什么反应？越清晰，AI 生成的脚本越准。"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  {generating ? <><Loader2 className="h-3 w-3 animate-spin" />AI 生成中...</> : <><Sparkles className="h-3 w-3" />AI 生成脚本</>}
                </button>
              </div>

              <Field label="脚本内容">
                <textarea
                  value={form.script}
                  onChange={(e) => setForm({ ...form, script: e.target.value })}
                  rows={10}
                  placeholder="AI 生成后可在此编辑调整"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <Field label="核心卖点 / 记忆点">
                <textarea
                  value={form.key_points}
                  onChange={(e) => setForm({ ...form, key_points: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <Field label="素材附件（图片/视频/音频）">
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "上传中..." : "上传文件"}
                    <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                  {form.attachments.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {form.attachments.map((a, i) => (
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
                  )}
                </div>
              </Field>

              <Field label="状态">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TopicStatus })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
                  {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentPreview({ att }: { att: Attachment }) {
  const isImage = att.type.startsWith("image/");
  const isVideo = att.type.startsWith("video/");
  const isAudio = att.type.startsWith("audio/");
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg border border-gray-200 bg-white hover:border-gray-300"
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={att.url} alt={att.name} className="h-24 w-full object-cover" />
      ) : isVideo ? (
        <video src={att.url} className="h-24 w-full object-cover" />
      ) : (
        <div className="flex h-24 w-full items-center justify-center bg-gray-50 text-gray-400">
          {isAudio ? <Music className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
        </div>
      )}
      <div className="truncate px-2 py-1 text-xs text-gray-600" title={att.name}>{att.name}</div>
    </a>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}
