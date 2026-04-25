"use client";

// 文字内容 — 文章列表页
// 路径: /dashboard/articles
// 入口: 左侧导航「文字内容」
// 功能: 列出所有公众号文章草稿/已发布；右上角「✍️ 新建文章」进入8步工作流

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PenLine, Plus, Loader2, Search, FileText, Clock, CheckCircle2,
  AlertCircle, Calendar, Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ArticleStatus = "draft" | "ai_writing" | "ready" | "scheduled" | "published" | "failed";

interface Article {
  id: string;
  title: string;
  digest: string;
  status: ArticleStatus;
  current_step: number;
  source_topic: string;
  cover_image_url: string;
  word_count: number;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ArticleStatus | "all">("all");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true);
    const { data } = await supabase
      .from("wx_articles")
      .select("id,title,digest,status,current_step,source_topic,cover_image_url,word_count,scheduled_at,published_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    setArticles((data ?? []) as Article[]);
    setLoading(false);
  }

  const filtered = articles.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (keyword) {
      const k = keyword.toLowerCase();
      return (
        a.title.toLowerCase().includes(k) ||
        a.digest.toLowerCase().includes(k) ||
        a.source_topic.toLowerCase().includes(k)
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PenLine size={24} className="text-violet-600" />
            文字内容
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            公众号文章 AI 写作 · 配图 · 一键推送
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/articles/settings"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Settings size={14} />
            公众号配置
          </Link>
          <Link
            href="/dashboard/articles/new"
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium"
          >
            <Plus size={16} />
            新建文章
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
          <button
            key={f.v}
            onClick={() => setFilterStatus(f.v)}
            className={
              "px-3 py-1.5 text-xs rounded-full border transition-colors " +
              (filterStatus === f.v
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-violet-300")
            }
          >
            {f.label} <span className="ml-1 opacity-70">{f.count}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜标题/选题..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:border-violet-400"
          />
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} />
          加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <FileText size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm mb-1">
            {articles.length === 0 ? "还没有文章，点右上角「新建文章」开始" : "没有匹配的文章"}
          </p>
          {articles.length === 0 && (
            <Link
              href="/dashboard/articles/new"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              <Plus size={14} />
              开始写第一篇
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((a) => {
            const meta = statusMeta[a.status];
            const StatusIcon = meta.icon;
            return (
              <Link
                key={a.id}
                href={`/dashboard/articles/${a.id}`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all flex gap-4"
              >
                {/* 封面 */}
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {a.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PenLine size={28} className="text-violet-300" />
                  )}
                </div>
                {/* 主体 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate flex-1">
                      {a.title || a.source_topic || "（未命名草稿）"}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border ${meta.color}`}
                    >
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
            );
          })}
        </div>
      )}
    </div>
  );
}
