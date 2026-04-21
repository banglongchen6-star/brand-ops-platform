"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  Sparkles,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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

const platforms = ["抖音", "小红书", "视频号", "公众号", "B站", "快手", "微博", "其他"];

export default function ContentHitsPage() {
  const [records, setRecords] = useState<HitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("content_hit_factors")
      .select("*")
      .order("created_at", { ascending: false });
    setRecords((data as HitRecord[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setForm({
      title: "",
      platform: "抖音",
      source_url: "",
      views: "",
      likes: "",
      comments: "",
      shares: "",
      raw_content: "",
    });
    setShowForm(true);
  }

  async function handleAnalyze() {
    if (!form.title.trim() || !form.raw_content.trim()) {
      alert("请填写标题和内容/文案");
      return;
    }
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
      if (!resp.ok) {
        alert("AI 分析失败：" + (json.error || "未知错误"));
        setAnalyzing(false);
        return;
      }
      const analysis: HitAnalysis = json.analysis;

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
      if (error) {
        alert("保存失败：" + error.message);
        setAnalyzing(false);
        return;
      }
      setShowForm(false);
      load();
    } catch (err) {
      alert("请求失败：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除该分析记录？")) return;
    const { error } = await supabase.from("content_hit_factors").delete().eq("id", id);
    if (error) {
      alert("删除失败：" + error.message);
      return;
    }
    load();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/content"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            返回内容运营
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Flame className="h-6 w-6 text-rose-500" />
            爆款分析
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            粘贴爆款内容文案，AI 自动拆解钩子、结构、情绪、可复用元素
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Sparkles className="h-4 w-4" />
          新增分析
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-400">
          <Flame className="mb-3 h-8 w-8" />
          <p className="text-sm">暂无爆款分析，点击右上角新增</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white transition hover:shadow-sm">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {r.platform && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{r.platform}</span>}
                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString("zh-CN")}</span>
                      </div>
                      <h3 className="mb-2 font-semibold text-gray-900">{r.title}</h3>
                      {r.summary && (
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                          <Sparkles className="h-3 w-3" />
                          {r.summary}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {r.views != null && <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{r.views.toLocaleString()}</span>}
                        {r.likes != null && <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{r.likes.toLocaleString()}</span>}
                        {r.comments_count != null && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{r.comments_count.toLocaleString()}</span>}
                        {r.shares != null && <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" />{r.shares.toLocaleString()}</span>}
                        {r.source_url && (
                          <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
                            原文 <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        {expanded ? <><ChevronUp className="h-3 w-3" />收起</> : <><ChevronDown className="h-3 w-3" />查看拆解</>}
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {expanded && r.ai_analysis && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <AnalysisCard label="开头钩子" value={r.ai_analysis.hook} color="text-orange-600" />
                      <AnalysisCard label="结构节奏" value={r.ai_analysis.structure} color="text-blue-600" />
                      <AnalysisCard label="情绪价值" value={r.ai_analysis.emotion} color="text-rose-600" />
                      <AnalysisCard label="选题切入" value={r.ai_analysis.topic_angle} color="text-purple-600" />
                      <AnalysisCard label="目标人群" value={r.ai_analysis.audience} color="text-teal-600" />
                      <AnalysisCard label="表现形式" value={r.ai_analysis.format} color="text-indigo-600" />
                    </div>
                    {r.ai_analysis.replicable_elements?.length > 0 && (
                      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                        <p className="mb-1.5 text-xs font-semibold text-green-800">✨ 可复用元素（直接抄作业）</p>
                        <ul className="space-y-1 text-xs text-green-900">
                          {r.ai_analysis.replicable_elements.map((el, i) => (
                            <li key={i} className="flex gap-1.5">
                              <span className="font-medium">{i + 1}.</span>
                              <span>{el}</span>
                            </li>
                          ))}
                        </ul>
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
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-semibold">新增爆款分析</h2>
              <button onClick={() => setShowForm(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              <Field label="爆款标题 *">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="如：这个乐器教程让我一个月学会钢琴"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="平台">
                  <select
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  >
                    {platforms.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </select>
                </Field>
                <Field label="原文链接">
                  <input
                    value={form.source_url}
                    onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <Field label="播放量">
                  <input type="number" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
                </Field>
                <Field label="点赞">
                  <input type="number" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
                </Field>
                <Field label="评论">
                  <input type="number" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
                </Field>
                <Field label="分享">
                  <input type="number" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
                </Field>
              </div>

              <Field label="内容/文案/口播转录 *">
                <textarea
                  value={form.raw_content}
                  onChange={(e) => setForm({ ...form, raw_content: e.target.value })}
                  rows={8}
                  placeholder="粘贴视频口播文字稿、文章正文、或内容详细描述。越完整 AI 拆解越准确。"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                onClick={() => setShowForm(false)}
                disabled={analyzing}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" />AI 拆解中...</> : <><Sparkles className="h-4 w-4" />开始 AI 分析</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className={`mb-1 text-xs font-semibold ${color}`}>{label}</p>
      <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
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
