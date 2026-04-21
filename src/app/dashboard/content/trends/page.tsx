"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  Flame,
  ExternalLink,
  Tag,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type TrendStatus = "new" | "tracking" | "used" | "archived";

interface Trend {
  id: string;
  title: string;
  source: string | null;
  category: string | null;
  heat_score: number | null;
  description: string | null;
  related_url: string | null;
  tags: string[] | null;
  status: TrendStatus;
  captured_at: string | null;
  created_by: string | null;
  created_at: string;
}

const statusMap: Record<TrendStatus, { label: string; color: string }> = {
  new: { label: "新发现", color: "bg-blue-50 text-blue-700 border-blue-200" },
  tracking: { label: "追踪中", color: "bg-amber-50 text-amber-700 border-amber-200" },
  used: { label: "已用于选题", color: "bg-green-50 text-green-700 border-green-200" },
  archived: { label: "归档", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

const sourceOptions = ["抖音热榜", "小红书热搜", "微博热搜", "B站热门", "视频号", "知乎热榜", "百度热搜", "其他"];
const categoryOptions = ["行业趋势", "社会事件", "节日营销", "产品相关", "用户痛点", "竞品动态", "娱乐热点", "其他"];

export default function ContentTrendsPage() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TrendStatus | "all">("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    source: "抖音热榜",
    category: "行业趋势",
    heat_score: "",
    description: "",
    related_url: "",
    tags: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("content_trends")
      .select("*")
      .order("created_at", { ascending: false });
    setTrends((data as Trend[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setForm({
      title: "",
      source: "抖音热榜",
      category: "行业趋势",
      heat_score: "",
      description: "",
      related_url: "",
      tags: "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      alert("请填写热点标题");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title.trim(),
      source: form.source,
      category: form.category,
      heat_score: form.heat_score ? Number(form.heat_score) : null,
      description: form.description.trim() || null,
      related_url: form.related_url.trim() || null,
      tags: form.tags.trim() ? form.tags.split(/[,，\s]+/).filter(Boolean) : null,
      status: "new" as TrendStatus,
      captured_at: new Date().toISOString(),
      created_by: user?.id || null,
    };
    const { error } = await supabase.from("content_trends").insert(payload);
    setSaving(false);
    if (error) {
      alert("保存失败：" + error.message);
      return;
    }
    setShowForm(false);
    loadData();
  }

  async function handleStatusChange(id: string, status: TrendStatus) {
    const { error } = await supabase.from("content_trends").update({ status }).eq("id", id);
    if (error) {
      alert("更新失败：" + error.message);
      return;
    }
    setTrends((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除？")) return;
    const { error } = await supabase.from("content_trends").delete().eq("id", id);
    if (error) {
      alert("删除失败：" + error.message);
      return;
    }
    loadData();
  }

  const filtered = trends.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterSource !== "all" && t.source !== filterSource) return false;
    return true;
  });

  const counts = {
    all: trends.length,
    new: trends.filter((t) => t.status === "new").length,
    tracking: trends.filter((t) => t.status === "tracking").length,
    used: trends.filter((t) => t.status === "used").length,
    archived: trends.filter((t) => t.status === "archived").length,
  };

  return (
    <div className="p-6">
      {/* Header */}
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
            <TrendingUp className="h-6 w-6 text-orange-500" />
            热点发现
          </h1>
          <p className="mt-1 text-sm text-gray-500">收集全网热点话题，为内容选题提供灵感</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          录入热点
        </button>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["all", "全部", counts.all],
          ["new", "新发现", counts.new],
          ["tracking", "追踪中", counts.tracking],
          ["used", "已用于选题", counts.used],
          ["archived", "归档", counts.archived],
        ] as const).map(([k, label, c]) => (
          <button
            key={k}
            onClick={() => setFilterStatus(k as TrendStatus | "all")}
            className={`rounded-full border px-3 py-1 text-sm ${
              filterStatus === k
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {label} <span className="ml-1 text-xs opacity-70">{c}</span>
          </button>
        ))}
      </div>

      {/* Source filter */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-gray-500">来源：</span>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
        >
          <option value="all">全部来源</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-400">
          <TrendingUp className="mb-3 h-8 w-8" />
          <p className="text-sm">暂无热点，点击右上角录入</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const st = statusMap[t.status];
            return (
              <div key={t.id} className="group rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-2 py-0.5 text-xs ${st.color}`}>{st.label}</span>
                      {t.source && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{t.source}</span>}
                      {t.category && <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{t.category}</span>}
                      {t.heat_score !== null && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                          <Flame className="h-3 w-3" /> {t.heat_score}
                        </span>
                      )}
                    </div>
                    <h3 className="mb-1 font-semibold text-gray-900">{t.title}</h3>
                    {t.description && (
                      <p className="mb-2 text-sm text-gray-600 whitespace-pre-wrap">{t.description}</p>
                    )}
                    {t.tags && t.tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                        <Tag className="h-3 w-3" />
                        {t.tags.map((tag) => (
                          <span key={tag} className="rounded bg-gray-50 px-1.5 py-0.5">#{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{new Date(t.created_at).toLocaleString("zh-CN")}</span>
                      {t.related_url && (
                        <a
                          href={t.related_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                        >
                          原文 <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t.id, e.target.value as TrendStatus)}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                    >
                      <option value="new">新发现</option>
                      <option value="tracking">追踪中</option>
                      <option value="used">已用于选题</option>
                      <option value="archived">归档</option>
                    </select>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded p-1 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-semibold">录入热点</h2>
              <button onClick={() => setShowForm(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              <Field label="热点标题 *">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="如：XX话题登上抖音热榜"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="来源">
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  >
                    {sourceOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </Field>
                <Field label="分类">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  >
                    {categoryOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </Field>
              </div>

              <Field label="热度分值（0-100）">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.heat_score}
                  onChange={(e) => setForm({ ...form, heat_score: e.target.value })}
                  placeholder="如：85"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <Field label="热点描述">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="简要描述这个热点的背景、讨论点、为什么值得关注"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <Field label="原文链接">
                <input
                  value={form.related_url}
                  onChange={(e) => setForm({ ...form, related_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <Field label="标签（逗号或空格分隔）">
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="如：音乐 国潮 年轻人"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
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
