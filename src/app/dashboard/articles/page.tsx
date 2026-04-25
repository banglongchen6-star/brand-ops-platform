"use client";

// 文字内容 — 文章列表页
// 路径: /dashboard/articles
// 入口: 左侧导航「文字内容」
// 功能: 列出所有公众号文章草稿/已发布；右上角「✍️ 新建文章」进入8步工作流
//       卡片支持悬停显示 复制/删除 按钮；左侧复选框支持批量删除

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PenLine, Plus, Loader2, Search, FileText, Clock, CheckCircle2,
  AlertCircle, Calendar, Settings, Trash2, Copy, X, Lightbulb,
} from "lucide-react";

type ArticleStatus = "draft" | "ai_writing" | "ready" | "scheduled" | "published" | "failed";

interface Article {
  id: string;
  title: string;
  digest: string;
  status: ArticleStatus;
  current_step: number;
  source_topic: string;
  ai_topic_input: string;
  cover_image_url: string;
  cover_fallback_url?: string;
  word_count: number;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function displayName(a: Article): string {
  if (a.title) return a.title;
  if (a.source_topic) return a.source_topic;
  if (a.ai_topic_input) return `话题方向：${a.ai_topic_input}`;
  return `未命名草稿（${new Date(a.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}）`;
}

const statusMeta: Record<ArticleStatus, { label: string; color: string; icon: typeof FileText }> = {
  draft:       { label: "起草中",   color: "bg-gray-100 text-gray-700 border-gray-200",       icon: FileText },
  ai_writing:  { label: "AI写作中", color: "bg-violet-100 text-violet-700 border-violet-200", icon: Loader2 },
  ready:       { label: "待发布",   color: "bg-amber-100 text-amber-700 border-amber-200",    icon: Clock },
  scheduled:   { label: "已定时",   color: "bg-blue-100 text-blue-700 border-blue-200",       icon: Calendar },
  published:   { label: "已发布",   color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle2 },
  failed:      { label: "失败",     color: "bg-rose-100 text-rose-700 border-rose-200",       icon: AlertCircle },
};

export default function ArticlesListPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filterStatus, setFilterStatus] = useState<ArticleStatus | "all">("all");
  const [keyword, setKeyword] = useState("");

  // 选中 / 删除 / 复制
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; bulk: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadArticles(); }, []);

  async function loadArticles() {
    setLoading(true); setLoadError("");
    try {
      const r = await fetch("/api/articles");
      const j = await r.json();
      if (!r.ok) { setLoadError(j.error || "加载失败"); setArticles([]); }
      else { setArticles((j.articles ?? []) as Article[]); }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "网络错误");
      setArticles([]);
    }
    setLoading(false);
  }

  const filtered = articles.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (keyword) {
      const k = keyword.toLowerCase();
      return (
        a.title.toLowerCase().includes(k) ||
        a.digest.toLowerCase().includes(k) ||
        a.source_topic.toLowerCase().includes(k) ||
        (a.ai_topic_input || "").toLowerCase().includes(k)
      );
    }
    return true;
  });

  const counts = {
    all: articles.length,
    draft: articles.filter((a) => a.status === "draft").length,
    ai_writing: articles.filter((a) => a.status === "ai_writing").length,
    ready: articles.filter((a) => a.status === "ready").length,
    scheduled: articles.filter((a) => a.status === "scheduled").length,
    published: articles.filter((a) => a.status === "published").length,
    failed: articles.filter((a) => a.status === "failed").length,
  };

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelectedIds(new Set(filtered.map((a) => a.id)));
  }
  function clearSelection() { setSelectedIds(new Set()); }

  async function doClone(id: string) {
    setBusy(true);
    const r = await fetch(`/api/articles/${id}/clone`, { method: "POST" });
    const j = await r.json();
    setBusy(false);
    if (!r.ok || !j.id) { alert(j.error || "复制失败"); return; }
    router.push(`/dashboard/articles/${j.id}`);
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    if (confirmDelete.bulk) {
      const r = await fetch("/api/articles/batch-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: confirmDelete.ids }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error || "删除失败"); setBusy(false); return; }
    } else {
      const r = await fetch(`/api/articles/${confirmDelete.ids[0]}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error || "删除失败"); setBusy(false); return;
      }
    }
    setConfirmDelete(null);
    setSelectedIds(new Set());
    setBusy(false);
    await loadArticles();
  }

  // 选中卡片包含的状态分布，用于二次确认提示已发布等
  const confirmTargets = confirmDelete ? articles.filter((a) => confirmDelete.ids.includes(a.id)) : [];
  const hasPublished = confirmTargets.some((a) => a.status === "published" || a.status === "scheduled");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PenLine size={24} className="text-violet-600" />文字内容
          </h1>
          <p className="text-sm text-gray-500 mt-1">公众号文章 AI 写作 · 配图 · 一键推送</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/articles/topics"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            <Lightbulb size={14} />选题素材库
          </Link>
          <Link href="/dashboard/articles/settings"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            <Settings size={14} />公众号配置
          </Link>
          <Link href="/dashboard/articles/new"
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium">
            <Plus size={16} />新建文章
          </Link>
        </div>
      </div>

      {/* 状态筛选 + 搜索 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { v: "all" as const, label: "全部", count: counts.all },
          { v: "draft" as const, label: "起草中", count: counts.draft },
          { v: "ai_writing" as const, label: "AI写作中", count: counts.ai_writing },
          { v: "ready" as const, label: "待发布", count: counts.ready },
          { v: "scheduled" as const, label: "已定时", count: counts.scheduled },
          { v: "published" as const, label: "已发布", count: counts.published },
          { v: "failed" as const, label: "失败", count: counts.failed },
        ].map((f) => (
          <button key={f.v} onClick={() => setFilterStatus(f.v)}
            className={"px-3 py-1.5 text-xs rounded-full border transition-colors " +
              (filterStatus === f.v ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-violet-300")}>
            {f.label} <span className="ml-1 opacity-70">{f.count}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜标题/选题..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:border-violet-400" />
        </div>
      </div>

      {/* 数据库报错提示 */}
      {loadError && (
        <div className="mb-4 p-4 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800">
          <div className="font-semibold mb-1">数据库查询失败</div>
          <div className="text-xs font-mono break-all">{loadError}</div>
        </div>
      )}

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="mb-3 p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-3 sticky top-0 z-10">
          <span className="text-sm text-violet-800 font-medium">
            已选中 {selectedIds.size} 篇
          </span>
          <button onClick={selectAllVisible}
            className="text-xs text-violet-700 underline hover:text-violet-900">
            全选当前筛选（{filtered.length}）
          </button>
          <div className="flex-1" />
          <button onClick={() => setConfirmDelete({ ids: Array.from(selectedIds), bulk: true })}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700">
            <Trash2 size={14} />删除选中
          </button>
          <button onClick={clearSelection}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-white text-gray-600">
            <X size={14} />取消
          </button>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} />加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <FileText size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm mb-1">
            {articles.length === 0 ? "还没有文章，点右上角「新建文章」开始" : "没有匹配的文章"}
          </p>
          {articles.length === 0 && (
            <Link href="/dashboard/articles/new"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">
              <Plus size={14} />开始写第一篇
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((a) => {
            const meta = statusMeta[a.status];
            const StatusIcon = meta.icon;
            const isSelected = selectedIds.has(a.id);
            return (
              <div key={a.id}
                className={"group relative bg-white rounded-xl border p-4 hover:shadow-sm transition-all flex gap-4 " +
                  (isSelected ? "border-violet-400 ring-1 ring-violet-300" : "border-gray-200 hover:border-violet-300")}>
                {/* 复选框 */}
                <input
                  type="checkbox" checked={isSelected}
                  onChange={() => toggleSelect(a.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 w-4 h-4 cursor-pointer accent-violet-600 shrink-0"
                />

                {/* 主链接区（封面 + 主体） */}
                <Link href={`/dashboard/articles/${a.id}`} className="flex flex-1 gap-4 min-w-0">
                  {/* 封面：优先用 cover_image_url，没有就用任意一张已生成的配图 */}
                  <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {(a.cover_image_url || a.cover_fallback_url) ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.cover_image_url || a.cover_fallback_url} alt="" className="w-full h-full object-cover" />
                        {!a.cover_image_url && a.cover_fallback_url && (
                          <span className="absolute bottom-0.5 right-0.5 text-[9px] px-1 py-0.5 bg-black/50 text-white rounded">
                            插图
                          </span>
                        )}
                      </>
                    ) : (
                      <PenLine size={28} className="text-violet-300" />
                    )}
                  </div>
                  {/* 主体 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate flex-1">{displayName(a)}</h3>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border ${meta.color}`}>
                        <StatusIcon size={11} className={a.status === "ai_writing" ? "animate-spin" : ""} />
                        {meta.label}
                        {a.status === "draft" && a.current_step > 1 && (
                          <span className="opacity-60">· 第{a.current_step}步</span>
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                      {a.digest || a.source_topic || "暂无摘要"}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {a.word_count > 0 && <span>{a.word_count} 字</span>}
                      {a.published_at && (
                        <span>已发布 · {new Date(a.published_at).toLocaleDateString("zh-CN")}</span>
                      )}
                      {a.scheduled_at && !a.published_at && (
                        <span>定时 · {new Date(a.scheduled_at).toLocaleString("zh-CN")}</span>
                      )}
                      {!a.published_at && !a.scheduled_at && (
                        <span>更新于 {new Date(a.updated_at).toLocaleDateString("zh-CN")}</span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* 悬停动作（复制 + 删除）*/}
                <div className="absolute right-3 bottom-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); doClone(a.id); }}
                    disabled={busy}
                    className="p-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300 disabled:opacity-50"
                    title="复制为新草稿">
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete({ ids: [a.id], bulk: false }); }}
                    className="p-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300"
                    title="删除">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">
                  {confirmDelete.bulk ? `删除 ${confirmDelete.ids.length} 篇文章？` : "删除这篇文章？"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">删除后无法恢复，连同配图也会一并删除。</p>
              </div>
            </div>

            {!confirmDelete.bulk && confirmTargets[0] && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="font-medium text-gray-900 truncate">{displayName(confirmTargets[0])}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {statusMeta[confirmTargets[0].status].label}
                  {confirmTargets[0].status === "draft" && confirmTargets[0].current_step > 1 && ` · 第${confirmTargets[0].current_step}步`}
                </div>
              </div>
            )}

            {hasPublished && (
              <div className="mb-3 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div>
                  选中包含已发布/已定时的文章。这里只删除本系统的记录，
                  <strong>微信公众号草稿箱里的对应文章不会自动删除</strong>，需要手动去公众号后台清理。
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setConfirmDelete(null)} disabled={busy}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                取消
              </button>
              <button onClick={doDelete} disabled={busy}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
