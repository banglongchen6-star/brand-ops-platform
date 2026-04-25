"use client";

// 文章详情/编辑页 —— 8步AI工作流主体
// 路径: /dashboard/articles/[id]
// P1 实装步骤: ① 话题筛选 ② 选题确认 ③ AI大纲 ④ 正文生成 ⑥ 标题摘要 + 智能改写
// P2/P3/P4 占位步骤: ⑤ 配图  ⑦ 预览  ⑧ 发布

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronRight, Sparkles, Lightbulb, FileText,
  Image as ImageIcon, Type, Smartphone, Send, Check, Loader2,
  RefreshCw, Wand2, AlertCircle, Save, Upload, Copy, Code, X,
} from "lucide-react";
import { renderWxHtml } from "@/lib/wxArticleRender";

// ========= 类型 =========
type Status = "draft" | "ai_writing" | "ready" | "scheduled" | "published" | "failed";

interface Article {
  id: string;
  status: Status;
  current_step: number;
  ai_topic_input: string;
  source_trend_id: string | null;
  source_topic: string;
  source_angle: string;
  ai_outline: OutlineJson | null;
  content_md: string;
  content_html: string;
  title: string;
  ai_title_options: TitleOption[] | null;
  digest: string;
  author: string;
  cover_image_url: string;
  word_count: number;
  reading_time_min: number;
  scheduled_at: string | null;
  published_at: string | null;
  updated_at: string;
}

interface OutlineSection { heading: string; keypoint: string; examples: string[] }
interface OutlineJson { intro: string; sections: OutlineSection[]; conclusion: string }
interface TopicCandidate { trend_id: string; topic: string; reason: string; angle: string }
interface TitleOption { title: string; style: string; emoji_used: boolean }

// 模型显示名映射
const PROVIDER_LABEL: Record<string, string> = {
  qwen: "Qwen",
  claude: "Claude",
  openai_compat: "GPT",
};
function providerLabel(provider: string | null | undefined): string {
  if (!provider) return "AI";
  return PROVIDER_LABEL[provider] || provider.toUpperCase();
}

interface AIModelInfo { provider: string | null; model: string | null; label: string | null; source: string }

const STEPS = [
  { id: 1, label: "话题筛选", icon: Lightbulb,  color: "from-amber-400 to-orange-400" },
  { id: 2, label: "选题确认", icon: Check,      color: "from-orange-400 to-rose-400" },
  { id: 3, label: "AI大纲",   icon: FileText,   color: "from-rose-400 to-pink-400" },
  { id: 4, label: "正文生成", icon: Sparkles,   color: "from-pink-400 to-fuchsia-400" },
  { id: 5, label: "配图生成", icon: ImageIcon,  color: "from-fuchsia-400 to-violet-400" },
  { id: 6, label: "标题摘要", icon: Type,       color: "from-violet-400 to-indigo-400" },
  { id: 7, label: "微信预览", icon: Smartphone, color: "from-indigo-400 to-blue-400" },
  { id: 8, label: "发布",     icon: Send,       color: "from-blue-400 to-cyan-400" },
];

export default function ArticleEditorPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiInfo, setAiInfo] = useState<AIModelInfo | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingPatch = useRef<Partial<Article>>({}); // 累积未发送的字段

  // 加载 + 查询当前激活 AI 模型
  useEffect(() => {
    (async () => {
      const [r, rAI] = await Promise.all([
        fetch(`/api/articles/${id}`),
        fetch("/api/ai-config/current?scope=content"),
      ]);
      const j = await r.json();
      const jAI = await rAI.json();
      if (j.article) setArticle(j.article as Article);
      setAiInfo(jAI as AIModelInfo);
      setLoading(false);
    })();
  }, [id]);

  // 防抖保存（字段类编辑用）—— 累积 patch，定时器到点一次性发
  const queueSave = useCallback((patch: Partial<Article>) => {
    setArticle((a) => (a ? { ...a, ...patch } : a));
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const toSend = pendingPatch.current;
      pendingPatch.current = {};
      saveTimer.current = null;
      if (Object.keys(toSend).length === 0) return;
      setSaving(true);
      await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSend),
      });
      setSaving(false);
    }, 600);
  }, [id]);

  // 立即保存（步骤切换、状态变化用）
  const saveNow = useCallback(async (patch: Partial<Article>) => {
    // 合并所有 pending 数据，强制立刻发送
    const merged = { ...pendingPatch.current, ...patch };
    pendingPatch.current = {};
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    setArticle((a) => (a ? { ...a, ...patch } : a));
    if (Object.keys(merged).length === 0) return;
    setSaving(true);
    await fetch(`/api/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(merged),
    });
    setSaving(false);
  }, [id]);

  // 退出前 flush（点左上角箭头）
  const flushAndExit = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const toSend = pendingPatch.current;
    pendingPatch.current = {};
    if (Object.keys(toSend).length > 0) {
      setSaving(true);
      try {
        await fetch(`/api/articles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSend),
          keepalive: true, // 关键：即使页面卸载也尽量送达
        });
      } catch {/* 静默 */}
      setSaving(false);
    }
    router.push("/dashboard/articles");
  }, [id, router]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
      <Loader2 className="animate-spin mr-2" size={18} />加载中...
    </div>;
  }
  if (!article) {
    return <div className="p-8 text-center text-gray-500">文章不存在或已删除</div>;
  }

  const step = article.current_step || 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部条 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
          <button onClick={flushAndExit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="返回（自动保存）">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-semibold text-gray-900 truncate max-w-md">
            {article.title || article.source_topic || (article.ai_topic_input ? `话题方向：${article.ai_topic_input}` : "未命名草稿")}
          </h1>
          <span className="text-xs text-gray-400 shrink-0">第 {step}/8 步</span>
          {aiInfo?.provider && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-violet-50 text-violet-700 rounded-full border border-violet-200">
              <Sparkles size={10} />
              {providerLabel(aiInfo.provider)} · {aiInfo.model}
            </span>
          )}
          <div className="flex-1" />
          {saving ? (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" />保存中...
            </span>
          ) : (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Save size={11} />已自动保存
            </span>
          )}
        </div>
      </div>

      {/* 步进条 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-1">
            {STEPS.map((s, idx) => {
              const isCurrent = s.id === step;
              const isDone = s.id < step;
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button onClick={() => saveNow({ current_step: s.id })} className="flex flex-col items-center gap-1 group">
                    <div className={
                      "w-9 h-9 rounded-full flex items-center justify-center transition-all " +
                      (isCurrent ? `bg-gradient-to-br ${s.color} text-white shadow-md scale-110`
                        : isDone ? "bg-violet-100 text-violet-600"
                        : "bg-gray-100 text-gray-400 group-hover:bg-gray-200")
                    }>
                      {isDone ? <Check size={16} /> : <Icon size={16} />}
                    </div>
                    <span className={"text-[11px] font-medium whitespace-nowrap " +
                      (isCurrent ? "text-violet-600" : isDone ? "text-violet-500" : "text-gray-400")}>
                      {s.label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={"flex-1 h-0.5 mx-1 " + (isDone ? "bg-violet-300" : "bg-gray-200")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-7xl mx-auto px-6 py-6 pb-20">
        {step === 1 && <Step1Topics article={article} aiInfo={aiInfo} saveNow={saveNow} queueSave={queueSave} />}
        {step === 2 && <Step2Confirm article={article} queueSave={queueSave} />}
        {step === 3 && <Step3Outline article={article} aiInfo={aiInfo} saveNow={saveNow} queueSave={queueSave} />}
        {step === 4 && <Step4Content article={article} aiInfo={aiInfo} saveNow={saveNow} queueSave={queueSave} />}
        {step === 5 && <Step5Images article={article} aiInfo={aiInfo} saveNow={saveNow} />}
        {step === 6 && <Step6Titles article={article} aiInfo={aiInfo} saveNow={saveNow} queueSave={queueSave} />}
        {step === 7 && <Step7Preview article={article} saveNow={saveNow} />}
        {step === 8 && <Step8Publish article={article} saveNow={saveNow} />}
      </div>

      {/* 底部条 */}
      <div className="fixed bottom-0 left-56 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between z-10">
        <button
          onClick={() => saveNow({ current_step: Math.max(1, step - 1) })}
          disabled={step === 1}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
          上一步
        </button>
        <div className="text-xs text-gray-400">
          {article.word_count > 0 && `${article.word_count} 字 · 阅读约 ${article.reading_time_min} 分钟`}
        </div>
        <button
          onClick={() => saveNow({ current_step: Math.min(8, step + 1) })}
          disabled={step === 8}
          className="flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40">
          {step === 8 ? "完成" : "下一步"}<ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ============ Step 1: 话题筛选（双源：素材库 / 热榜） ============
interface PoolTopic {
  id: string;
  title: string;
  pain_point: string;
  angle: string;
  tags: string[];
  priority: number;
  status: string;
  scheduled_at: string | null;
}

function Step1Topics({ article, aiInfo, saveNow, queueSave }: {
  article: Article; aiInfo: AIModelInfo | null;
  saveNow: (p: Partial<Article>) => Promise<void>; queueSave: (p: Partial<Article>) => void;
}) {
  const [tab, setTab] = useState<"trend" | "pool">("pool");
  const [candidates, setCandidates] = useState<TopicCandidate[]>([]);
  const [poolTopics, setPoolTopics] = useState<PoolTopic[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(article.ai_topic_input || "");

  useEffect(() => {
    if (tab !== "pool") return;
    setPoolLoading(true);
    fetch("/api/topic-pool?status=candidate")
      .then((r) => r.json())
      .then((j) => setPoolTopics(j.topics || []))
      .finally(() => setPoolLoading(false));
  }, [tab]);

  async function pickPoolTopic(t: PoolTopic) {
    await fetch(`/api/topic-pool/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "used", article_id: article.id }),
    });
    await saveNow({
      source_topic: t.title,
      source_angle: t.angle,
      ai_topic_input: t.pain_point,
      current_step: 2,
    });
  }

  async function runAI() {
    setLoading(true); setError("");
    const r = await fetch(`/api/articles/${article.id}/ai/topics`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hint }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) { setError(j.error || "AI 调用失败"); return; }
    setCandidates(j.candidates || []);
  }

  async function pickTopic(c: TopicCandidate) {
    await saveNow({
      source_trend_id: c.trend_id,
      source_topic: c.topic,
      source_angle: c.angle,
      ai_topic_input: hint,
      current_step: 2,
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Lightbulb size={18} className="text-amber-500" />
          第 1 步 · 话题筛选
        </h2>

        <div className="inline-flex border border-gray-200 rounded-lg p-0.5 bg-gray-50 mb-4">
          <button onClick={() => setTab("pool")}
            className={"px-3 py-1.5 text-xs rounded-md " +
              (tab === "pool" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            📚 从素材库选
          </button>
          <button onClick={() => setTab("trend")}
            className={"px-3 py-1.5 text-xs rounded-md " +
              (tab === "trend" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            🔥 从今日热榜筛
          </button>
        </div>

        {tab === "trend" ? (
          <>
            <p className="text-sm text-gray-500 mb-3">让 AI 从今日各平台热榜里挑选适合品牌的选题。</p>
            <textarea
              value={hint} onChange={(e) => setHint(e.target.value)}
              placeholder="可选：输入特别关注的方向"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={2}
            />
            <AIButton onClick={runAI} loading={loading} aiInfo={aiInfo} idleText="筛选选题" loadingText="思考中..." />
            {error && <div className="mt-3 text-sm text-rose-600 flex items-center gap-1"><AlertCircle size={14} />{error}</div>}
          </>
        ) : (
          <p className="text-sm text-gray-500">
            从「选题素材库」里挑一个候选，直接进入第 2 步。
            <Link href="/dashboard/articles/topics" target="_blank" className="ml-1 text-violet-600 hover:underline">
              管理素材库 ↗
            </Link>
          </p>
        )}
      </div>

      {tab === "trend" && candidates.length > 0 && (
        <div className="space-y-2">
          {candidates.map((c, i) => (
            <button key={i} onClick={() => pickTopic(c)}
              className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-400 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-semibold text-gray-900">{c.topic}</h3>
                <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full shrink-0">推荐 #{i + 1}</span>
              </div>
              <p className="text-sm text-gray-600 mb-1"><span className="text-gray-400">理由：</span>{c.reason}</p>
              <p className="text-sm text-gray-600"><span className="text-gray-400">角度：</span>{c.angle}</p>
            </button>
          ))}
        </div>
      )}

      {tab === "pool" && (
        <div className="space-y-2">
          {poolLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="animate-spin mr-2" size={16} />加载中...
            </div>
          ) : poolTopics.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              <p className="mb-2">素材库还没有候选选题</p>
              <Link href="/dashboard/articles/topics"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                <Sparkles size={11} />去 AI 生成或手动添加
              </Link>
            </div>
          ) : (
            poolTopics.map((t) => (
              <button key={t.id} onClick={() => pickPoolTopic(t)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-400 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    {t.title}
                    {t.priority >= 4 && <span className="text-[10px] text-amber-600">★</span>}
                  </h3>
                  {t.scheduled_at && (
                    <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full shrink-0">
                      📅 {t.scheduled_at}
                    </span>
                  )}
                </div>
                {t.pain_point && (
                  <p className="text-sm text-gray-600 mb-1"><span className="text-gray-400">痛点：</span>{t.pain_point}</p>
                )}
                {t.angle && (
                  <p className="text-sm text-gray-600 mb-1"><span className="text-gray-400">角度：</span>{t.angle}</p>
                )}
                {t.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {t.tags.map((tg, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded">
                        {tg}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}

      <div className="text-center pt-2">
        <button onClick={() => queueSave({ ai_topic_input: hint, current_step: 2 })}
          className="text-sm text-gray-500 hover:text-violet-600 underline">
          跳过，手动输入选题
        </button>
      </div>
    </div>
  );
}

// ============ Step 2: 选题确认 ============
function Step2Confirm({ article, queueSave }: {
  article: Article; queueSave: (p: Partial<Article>) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Check size={18} className="text-orange-500" />第 2 步 · 选题确认
      </h2>
      <p className="text-sm text-gray-500">确认/修改选题方向，再补充些背景信息让 AI 写得更准。</p>

      <div>
        <label className="block text-xs text-gray-600 mb-1">选题</label>
        <input type="text" value={article.source_topic}
          onChange={(e) => queueSave({ source_topic: e.target.value })}
          placeholder="例：成年人为什么越来越多开始学钢琴？"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">切入角度</label>
        <textarea value={article.source_angle}
          onChange={(e) => queueSave({ source_angle: e.target.value })}
          placeholder="例：从某个社会现象切入，落到成年人学钢琴的具体痛点"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={2} />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">补充信息（可选）</label>
        <textarea value={article.ai_topic_input}
          onChange={(e) => queueSave({ ai_topic_input: e.target.value })}
          placeholder="补充上下文：比如最近的活动、想强调的卖点、要规避的话题..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={3} />
      </div>
    </div>
  );
}

// ============ Step 3: AI大纲 ============
function Step3Outline({ article, aiInfo, saveNow, queueSave }: {
  article: Article; aiInfo: AIModelInfo | null;
  saveNow: (p: Partial<Article>) => Promise<void>; queueSave: (p: Partial<Article>) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const outline = article.ai_outline;

  async function runAI() {
    if (!article.source_topic) { setError("请先在上一步填写选题"); return; }
    setLoading(true); setError("");
    const r = await fetch(`/api/articles/${article.id}/ai/outline`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: article.source_topic, angle: article.source_angle, hint: article.ai_topic_input }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) { setError(j.error || "AI 调用失败"); return; }
    await saveNow({ ai_outline: j.outline });
  }

  function updateOutline(next: OutlineJson) { queueSave({ ai_outline: next }); }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
          <FileText size={18} className="text-rose-500" />第 3 步 · AI 大纲
        </h2>
        <p className="text-sm text-gray-500 mb-4">基于选题，AI 生成结构化大纲。可以直接编辑。</p>
        <AIButton onClick={runAI} loading={loading} aiInfo={aiInfo}
          idleText={outline ? "重新生成大纲" : "生成大纲"} loadingText="生成中..."
          icon={outline ? "refresh" : "sparkles"} />
        {error && <div className="mt-3 text-sm text-rose-600 flex items-center gap-1"><AlertCircle size={14} />{error}</div>}
      </div>

      {outline && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">引言思路</label>
            <textarea value={outline.intro}
              onChange={(e) => updateOutline({ ...outline, intro: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={2} />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-2">正文段落（{outline.sections.length}）</label>
            <div className="space-y-3">
              {outline.sections.map((s, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <input value={s.heading}
                    onChange={(e) => {
                      const next = [...outline.sections]; next[i] = { ...s, heading: e.target.value };
                      updateOutline({ ...outline, sections: next });
                    }}
                    placeholder="小标题" className="w-full px-2 py-1 text-sm font-semibold border-b border-transparent hover:border-gray-200 focus:outline-none focus:border-violet-400" />
                  <textarea value={s.keypoint}
                    onChange={(e) => {
                      const next = [...outline.sections]; next[i] = { ...s, keypoint: e.target.value };
                      updateOutline({ ...outline, sections: next });
                    }}
                    placeholder="核心观点"
                    className="w-full px-2 py-1 text-sm border border-gray-100 rounded resize-none focus:outline-none focus:border-violet-400" rows={2} />
                  <textarea value={(s.examples || []).join("\n")}
                    onChange={(e) => {
                      const next = [...outline.sections]; next[i] = { ...s, examples: e.target.value.split("\n").filter(Boolean) };
                      updateOutline({ ...outline, sections: next });
                    }}
                    placeholder="举例方向（每行一个）"
                    className="w-full px-2 py-1 text-xs text-gray-600 border border-gray-100 rounded resize-none focus:outline-none focus:border-violet-400" rows={2} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">结尾行动召唤</label>
            <textarea value={outline.conclusion}
              onChange={(e) => updateOutline({ ...outline, conclusion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={2} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Step 4: 正文生成 ============
function Step4Content({ article, aiInfo, saveNow, queueSave }: {
  article: Article; aiInfo: AIModelInfo | null;
  saveNow: (p: Partial<Article>) => Promise<void>; queueSave: (p: Partial<Article>) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteText, setRewriteText] = useState("");
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [rewriteResult, setRewriteResult] = useState("");

  async function runAI() {
    if (!article.ai_outline) { setError("请先回到第 3 步生成大纲"); return; }
    setLoading(true); setError("");
    const r = await fetch(`/api/articles/${article.id}/ai/content`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outline: article.ai_outline, topic: article.source_topic }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) { setError(j.error || "AI 调用失败"); return; }
    await saveNow({ content_md: j.content_md, word_count: j.word_count });
  }

  async function runRewrite() {
    if (!rewriteText || !rewriteInstruction) return;
    setRewriting(true); setRewriteResult("");
    const r = await fetch(`/api/articles/${article.id}/ai/rewrite`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rewriteText, instruction: rewriteInstruction }),
    });
    const j = await r.json();
    setRewriting(false);
    if (j.rewritten) setRewriteResult(j.rewritten);
    else alert(j.error || "改写失败");
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-fuchsia-500" />第 4 步 · 正文 (Markdown)
          </h2>
          <AIButton onClick={runAI} loading={loading} aiInfo={aiInfo} size="sm"
            idleText={article.content_md ? "重写" : "写作"} loadingText="写作中..."
            icon={article.content_md ? "refresh" : "sparkles"} />
        </div>
        {error && <div className="mb-2 text-sm text-rose-600 flex items-center gap-1"><AlertCircle size={14} />{error}</div>}
        <textarea value={article.content_md}
          onChange={(e) => queueSave({ content_md: e.target.value })}
          placeholder="AI 写好的 Markdown 正文会出现在这里，可以自由编辑..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:border-violet-400" rows={24} />
        <div className="mt-2 text-xs text-gray-400">{article.word_count} 字 · 约 {article.reading_time_min} 分钟阅读</div>
      </div>

      {/* 右侧：预览 + 改写工具 */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">实时预览</h3>
          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
            {renderSimpleMarkdown(article.content_md)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
            <Wand2 size={14} className="text-violet-500" />智能改写
          </h3>
          <textarea value={rewriteText} onChange={(e) => setRewriteText(e.target.value)}
            placeholder="粘贴一段需要改写的文字..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400 mb-2" rows={3} />
          <input value={rewriteInstruction} onChange={(e) => setRewriteInstruction(e.target.value)}
            placeholder="改写指令：如「更口语化」「压缩到一半」「加入数据感」"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 mb-2" />
          <AIButton onClick={runRewrite} loading={rewriting} aiInfo={aiInfo} size="sm"
            disabled={!rewriteText || !rewriteInstruction}
            idleText="改写" loadingText="改写中..." icon="wand" />
          {rewriteResult && (
            <div className="mt-3 p-3 bg-violet-50 rounded-lg text-sm text-gray-800 whitespace-pre-wrap">
              {rewriteResult}
              <button onClick={() => navigator.clipboard.writeText(rewriteResult)}
                className="block mt-2 text-xs text-violet-600 hover:underline">复制</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Step 6: 标题摘要 ============
function Step6Titles({ article, aiInfo, saveNow, queueSave }: {
  article: Article; aiInfo: AIModelInfo | null;
  saveNow: (p: Partial<Article>) => Promise<void>; queueSave: (p: Partial<Article>) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAI() {
    if (!article.content_md) { setError("请先在第 4 步生成正文"); return; }
    setLoading(true); setError("");
    const r = await fetch(`/api/articles/${article.id}/ai/titles`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: article.content_md, topic: article.source_topic }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) { setError(j.error || "AI 调用失败"); return; }
    await saveNow({ ai_title_options: j.options, digest: j.digest });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Type size={18} className="text-violet-500" />第 6 步 · 标题 & 摘要
          </h2>
          <AIButton onClick={runAI} loading={loading} aiInfo={aiInfo} size="sm"
            idleText="生成标题+摘要" loadingText="生成中..." icon="sparkles" />
        </div>
        {error && <div className="mb-2 text-sm text-rose-600 flex items-center gap-1"><AlertCircle size={14} />{error}</div>}

        {(article.ai_title_options || []).length > 0 && (
          <div className="space-y-2 mb-4">
            <div className="text-xs text-gray-500">AI 候选标题（点击采用）：</div>
            {(article.ai_title_options || []).map((t, i) => (
              <button key={i} onClick={() => queueSave({ title: t.title })}
                className={"w-full text-left p-3 rounded-lg border transition-all " +
                  (article.title === t.title ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-violet-300")}>
                <div className="font-medium text-gray-900">{t.title}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{t.style} · {t.title.length} 字</div>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-xs text-gray-600 mb-1">最终标题</label>
            <input value={article.title} onChange={(e) => queueSave({ title: e.target.value })}
              placeholder="点击上方候选采用，或手动输入"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-violet-400" />
            <div className="text-[11px] text-gray-400 mt-1">{article.title.length} 字</div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">摘要（公众号推送预览）</label>
            <textarea value={article.digest} onChange={(e) => queueSave({ digest: e.target.value })}
              placeholder="约 100-120 字"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={3} />
            <div className="text-[11px] text-gray-400 mt-1">{article.digest.length} / 120 字</div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">作者署名</label>
            <input value={article.author} onChange={(e) => queueSave({ author: e.target.value })}
              placeholder="例：音乐密码编辑部"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Step 5: 配图生成（通义万相） ============
interface ArticleImage {
  id: string;
  position: string;
  prompt_zh: string;
  aspect: string;
  image_url: string;
  status: "pending" | "generating" | "done" | "failed";
  error: string;
}

const SLOT_ORDER = ["cover", "body_1", "body_2", "body_3"] as const;
const SLOT_ASPECT: Record<string, string> = { cover: "16:9", body_1: "1:1", body_2: "1:1", body_3: "1:1" };

function Step5Images({ article, aiInfo, saveNow }: {
  article: Article; aiInfo: AIModelInfo | null;
  saveNow: (p: Partial<Article>) => Promise<void>;
}) {
  const [images, setImages] = useState<ArticleImage[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // position being uploaded
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
  const [singleUploadTarget, setSingleUploadTarget] = useState<string | null>(null);

  // 初次加载已有图
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/articles/${article.id}/ai/images/check`, { method: "POST" });
      const j = await r.json();
      if (Array.isArray(j.images)) setImages(j.images);
    })();
  }, [article.id]);

  // 自动轮询：只要有 generating，3s 一次
  useEffect(() => {
    const hasGenerating = images.some((x) => x.status === "generating");
    if (!hasGenerating) { setPolling(false); return; }
    setPolling(true);
    const t = setTimeout(async () => {
      const r = await fetch(`/api/articles/${article.id}/ai/images/check`, { method: "POST" });
      const j = await r.json();
      if (Array.isArray(j.images)) setImages(j.images);
    }, 3000);
    return () => clearTimeout(t);
  }, [images, article.id]);

  async function startAll() {
    setStarting(true); setError("");
    const r = await fetch(`/api/articles/${article.id}/ai/images/start`, { method: "POST" });
    const j = await r.json();
    setStarting(false);
    if (!r.ok) { setError(j.error || "启动失败"); return; }
    setImages(j.images || []);
  }

  async function regenerate(img: ArticleImage, newPrompt?: string) {
    const r = await fetch(`/api/articles/${article.id}/ai/images/${img.id}/regenerate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_zh: newPrompt ?? img.prompt_zh }),
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || "重新生成失败"); return; }
    setImages((prev) => prev.map((x) => x.id === img.id ? { ...x, status: "generating", image_url: "", error: "" } : x));
  }

  async function setAsCover(img: ArticleImage) {
    const r = await fetch(`/api/articles/${article.id}/ai/images/${img.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ set_as_cover: true }),
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || "设置失败"); return; }
    await saveNow({ cover_image_url: img.image_url });
  }

  async function updatePrompt(img: ArticleImage, prompt: string) {
    setImages((prev) => prev.map((x) => x.id === img.id ? { ...x, prompt_zh: prompt } : x));
    await fetch(`/api/articles/${article.id}/ai/images/${img.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_zh: prompt }),
    });
  }

  async function refreshImages() {
    const r = await fetch(`/api/articles/${article.id}/ai/images/check`, { method: "POST" });
    const j = await r.json();
    if (Array.isArray(j.images)) setImages(j.images);
  }

  // 多文件上传：按 SLOT_ORDER 依次分配到 cover/body_1/2/3
  async function handleBatchUpload(files: FileList) {
    const count = Math.min(files.length, 4);
    setUploading("batch"); setError("");
    for (let i = 0; i < count; i++) {
      const position = SLOT_ORDER[i];
      await uploadOne(files[i], position);
    }
    await refreshImages();
    setUploading(null);
  }

  // 替换单张：指定 position
  async function handleSingleUpload(file: File, position: string) {
    setUploading(position); setError("");
    await uploadOne(file, position);
    await refreshImages();
    setUploading(null);
  }

  async function uploadOne(file: File, position: string) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("position", position);
    fd.append("aspect", SLOT_ASPECT[position] || "1:1");
    const r = await fetch(`/api/articles/${article.id}/images/upload`, { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) { setError(j.error || "上传失败"); return null; }
    return j.url as string;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ImageIcon size={18} className="text-fuchsia-500" />第 5 步 · 配图生成
            </h2>
            <p className="text-sm text-gray-500 mt-1">可 AI 生成或手动上传 1 封面 + 3 插图。支持 JPG/PNG/GIF/WEBP，单图 ≤ 10MB。</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AIButton onClick={startAll} loading={starting} aiInfo={aiInfo}
              idleText={images.length > 0 ? "全部重新生成" : "AI 生成 4 张"}
              loadingText="提交任务中..." icon={images.length > 0 ? "refresh" : "sparkles"} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 disabled:opacity-50 h-fit self-start"
            >
              {uploading === "batch" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading === "batch" ? "上传中..." : "手动上传"}
            </button>
          </div>
        </div>
        {/* 隐藏文件选择器 */}
        <input
          ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files) handleBatchUpload(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={singleFileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0] && singleUploadTarget) {
              handleSingleUpload(e.target.files[0], singleUploadTarget);
              setSingleUploadTarget(null);
            }
            e.target.value = "";
          }}
        />
        {error && <div className="text-sm text-rose-600 flex items-center gap-1"><AlertCircle size={14} />{error}</div>}
        {polling && (
          <div className="text-xs text-violet-600 flex items-center gap-1 mt-2">
            <Loader2 size={12} className="animate-spin" />
            正在等待生成结果...（约 10-30 秒/张）
          </div>
        )}
        {images.length === 0 && uploading === null && (
          <div className="mt-4 text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
            还没有图片。点击「AI 生成 4 张」让通义万相自动生成，或点击「手动上传」一次选多张图片（按顺序分配到 封面/插图1/插图2/插图3）。
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {images.map((img) => (
            <ImageCard
              key={img.id}
              img={img}
              isCover={article.cover_image_url === img.image_url && !!img.image_url}
              uploading={uploading === img.position}
              onPromptChange={(p) => updatePrompt(img, p)}
              onRegenerate={() => regenerate(img)}
              onSetAsCover={() => setAsCover(img)}
              onReplaceUpload={() => {
                setSingleUploadTarget(img.position);
                singleFileInputRef.current?.click();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ImageCard({ img, isCover, uploading, onPromptChange, onRegenerate, onSetAsCover, onReplaceUpload }: {
  img: ArticleImage; isCover: boolean; uploading: boolean;
  onPromptChange: (p: string) => void;
  onRegenerate: () => void;
  onSetAsCover: () => void;
  onReplaceUpload: () => void;
}) {
  const positionLabel: Record<string, string> = {
    cover: "封面图（16:9）",
    body_1: "插图 1（1:1）",
    body_2: "插图 2（1:1）",
    body_3: "插图 3（1:1）",
  };
  return (
    <div className={"bg-white rounded-xl border-2 p-4 " + (isCover ? "border-violet-500" : "border-gray-200")}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">
          {positionLabel[img.position] || img.position}
          {isCover && <span className="ml-2 text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">已选为封面</span>}
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{img.aspect}</span>
      </div>

      {/* 图片预览区 */}
      <div className={"relative w-full bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-lg overflow-hidden mb-3 " +
        (img.aspect === "16:9" ? "aspect-video" : "aspect-square")}>
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-violet-600 gap-2 bg-white/70 z-10">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-xs">上传中...</span>
          </div>
        )}
        {img.status === "generating" && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-violet-600 gap-2">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-xs">通义万相生成中...</span>
          </div>
        )}
        {img.status === "failed" && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500 gap-2 px-4 text-center">
            <AlertCircle size={28} />
            <span className="text-xs">{img.error || "生成失败"}</span>
            <button onClick={onReplaceUpload}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1 text-xs border border-violet-300 text-violet-700 rounded-md hover:bg-violet-50">
              <Upload size={11} />改为手动上传
            </button>
          </div>
        )}
        {img.status === "done" && img.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.image_url} alt={img.position} className="w-full h-full object-cover" />
        )}
        {(img.status === "pending" || (!img.status && !img.image_url)) && !uploading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <ImageIcon size={36} />
          </div>
        )}
      </div>

      {/* 提示词编辑 */}
      <textarea
        value={img.prompt_zh}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="提示词"
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:border-violet-400 mb-2"
        rows={3}
      />

      {/* 操作 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onReplaceUpload} disabled={uploading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-violet-300 text-violet-700 rounded-md hover:bg-violet-50 disabled:opacity-50">
          <Upload size={11} />上传替换
        </button>
        <button onClick={onRegenerate} disabled={img.status === "generating" || uploading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={11} />AI 重生
        </button>
        {img.status === "done" && img.image_url && !isCover && (
          <button onClick={onSetAsCover}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-600 text-white rounded-md hover:bg-violet-700">
            <Check size={11} />设为封面
          </button>
        )}
        {img.status === "done" && img.image_url && (
          <a href={img.image_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 ml-auto">
            原图
          </a>
        )}
      </div>
    </div>
  );
}

// ============ Step 7: 微信预览（iPhone 手机壳 + 实时渲染） ============
const ACCENT_PRESETS = [
  { name: "品牌紫", value: "#7c3aed" },
  { name: "经典蓝", value: "#2563eb" },
  { name: "活力橘", value: "#ea580c" },
  { name: "暖玫红", value: "#e11d48" },
  { name: "森林绿", value: "#059669" },
  { name: "沉稳灰", value: "#4b5563" },
];

function Step7Preview({ article, saveNow }: {
  article: Article; saveNow: (p: Partial<Article>) => Promise<void>;
}) {
  const [images, setImages] = useState<ArticleImage[]>([]);
  const [accent, setAccent] = useState("#7c3aed");
  const [showTitle, setShowTitle] = useState(false);
  const [showCTA, setShowCTA] = useState(true);
  const [fontSize, setFontSize] = useState(15);
  const [viewMode, setViewMode] = useState<"phone" | "html">("phone");
  const [copied, setCopied] = useState(false);

  // 加载图片
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/articles/${article.id}/ai/images/check`, { method: "POST" });
      const j = await r.json();
      if (Array.isArray(j.images)) setImages(j.images);
    })();
  }, [article.id]);

  // 渲染 HTML（useMemo 实时计算）
  const html = useMemo(() => {
    return renderWxHtml(
      {
        title: article.title,
        digest: article.digest,
        author: article.author,
        content_md: article.content_md,
        cover_image_url: article.cover_image_url,
      },
      images.map((i) => ({ position: i.position, image_url: i.image_url, status: i.status })),
      { accentColor: accent, showTitle, showCTA, fontSize },
    );
  }, [article.title, article.digest, article.author, article.content_md, article.cover_image_url, images, accent, showTitle, showCTA, fontSize]);

  // 防抖保存到 content_html
  useEffect(() => {
    const t = setTimeout(() => { saveNow({ content_html: html }); }, 1200);
    return () => clearTimeout(t);
  }, [html, saveNow]);

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { alert("复制失败，请手动选中复制"); }
  }

  if (!article.content_md) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <AlertCircle size={28} className="mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-gray-600">请先回到第 4 步生成正文，这里才有内容可预览。</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4">
      {/* 左：样式设置 */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
            <Smartphone size={14} className="text-indigo-500" />排版设置
          </h3>

          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-2">主题色（小标题+加粗+CTA）</label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((p) => (
                <button key={p.value} onClick={() => setAccent(p.value)}
                  className={"flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-all " +
                    (accent === p.value ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-400")}>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.value }} />
                  {p.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
                className="w-8 h-8 border border-gray-200 rounded cursor-pointer" />
              <span className="text-xs text-gray-500">自定义：{accent}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-1">正文字号：{fontSize}px</label>
            <input type="range" min={13} max={18} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
            <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} />
            HTML 内显示标题（微信自带标题，一般不用）
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={showCTA} onChange={(e) => setShowCTA(e.target.checked)} />
            文末显示品牌 CTA 卡片
          </label>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
            <Code size={14} className="text-indigo-500" />HTML 源码
          </h3>
          <p className="text-xs text-gray-500 mb-3">复制此 HTML 粘贴到微信公众号编辑器里（切换到"源码"模式）。</p>
          <div className="flex gap-2 mb-2">
            <button onClick={copyHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "已复制" : "复制 HTML"}
            </button>
            <button onClick={() => setViewMode(viewMode === "phone" ? "html" : "phone")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
              {viewMode === "phone" ? "查看源码" : "返回预览"}
            </button>
          </div>
          <div className="text-[10px] text-gray-400">字符数：{html.length.toLocaleString()}</div>
        </div>
      </div>

      {/* 右：预览 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {viewMode === "phone" ? (
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-3">iPhone 14 · 公众号文章预览</div>
            <PhoneFrame>
              <div className="bg-white min-h-full">
                {/* 微信公众号文章头部 */}
                <div className="px-4 pt-5 pb-3 border-b border-gray-100">
                  <h1 className="text-[19px] font-bold text-gray-900 leading-tight mb-2">
                    {article.title || "（未填标题）"}
                  </h1>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="inline-block w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400" />
                    <span className="text-violet-600">{article.author || "音乐密码"}</span>
                    <span>·</span>
                    <span>刚刚</span>
                  </div>
                </div>
                {/* 渲染后的 HTML */}
                <div className="px-4 py-4" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            </PhoneFrame>
          </div>
        ) : (
          <div>
            <div className="text-xs text-gray-500 mb-2">HTML 源码（可直接复制）</div>
            <pre className="bg-gray-900 text-green-300 text-[11px] p-4 rounded-lg overflow-auto max-h-[70vh] whitespace-pre-wrap break-all leading-relaxed">
              {html}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[360px] bg-black rounded-[40px] p-3 shadow-2xl">
      {/* 顶部刘海 */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-10" />
      <div className="w-full h-[640px] bg-white rounded-[30px] overflow-hidden relative">
        {/* 状态栏占位 */}
        <div className="h-7 flex items-center justify-between px-6 text-[10px] font-semibold text-gray-700 bg-white shrink-0">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span>●●●●</span>
            <span>100%</span>
          </span>
        </div>
        <div className="h-[calc(100%-28px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ============ Step 8: 发布到微信草稿箱 ============
interface PublishConfig {
  id: string; name: string; app_id: string; account_type: string;
  default_author: string; enabled: boolean;
}

function Step8Publish({ article, saveNow }: {
  article: Article; saveNow: (p: Partial<Article>) => Promise<void>;
}) {
  const [configs, setConfigs] = useState<PublishConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: Record<string, unknown> } | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/wx-publish-configs");
      const j = await r.json();
      const enabled = (j.configs || []).filter((c: PublishConfig) => c.enabled);
      setConfigs(enabled);
      const initial = (article as Article & { publish_config_id?: string }).publish_config_id || enabled[0]?.id || "";
      if (initial) setSelectedConfig(initial);
    })();
  }, [article]);

  // 校验：标题/封面/HTML 缺哪个
  const checks = [
    { ok: !!article.title, label: "标题" },
    { ok: !!article.digest, label: "摘要" },
    { ok: !!article.cover_image_url, label: "封面图" },
    { ok: !!article.content_html, label: "微信预览 HTML（第 7 步生成）" },
    { ok: configs.length > 0, label: "至少一个公众号配置" },
  ];
  const ready = checks.every((c) => c.ok) && !!selectedConfig;

  async function publish() {
    setPublishing(true); setResult(null);
    const r = await fetch(`/api/articles/${article.id}/publish/draft`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish_config_id: selectedConfig }),
    });
    const j = await r.json();
    setPublishing(false);
    if (!r.ok) {
      setResult({ ok: false, message: j.error || "发布失败" });
    } else {
      setResult({ ok: true, message: "已成功推送到公众号草稿箱", details: j });
      await saveNow({ status: "ready", current_step: 8 });
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* 左：检查 + 发布操作 */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Send size={18} className="text-blue-500" />第 8 步 · 推送到公众号草稿箱
          </h2>

          {/* 发布前检查 */}
          <div className="mb-4">
            <div className="text-xs text-gray-600 mb-2">发布前检查</div>
            <div className="space-y-1">
              {checks.map((c, i) => (
                <div key={i} className={"flex items-center gap-2 text-sm " + (c.ok ? "text-gray-700" : "text-rose-600")}>
                  {c.ok ? <Check size={14} className="text-green-600" /> : <X size={14} />}
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          {/* 选择公众号 */}
          {configs.length === 0 ? (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
              还没有公众号配置。
              <Link href="/dashboard/articles/settings" className="underline ml-1">去添加</Link>
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-xs text-gray-600 mb-1">选择推送目标</label>
              <select value={selectedConfig} onChange={(e) => setSelectedConfig(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}（{c.account_type === "subscription" ? "订阅号" : "服务号"} · {c.app_id}）
                  </option>
                ))}
              </select>
            </div>
          )}

          <button onClick={publish} disabled={!ready || publishing}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {publishing ? "正在推送（上传图片可能 30-60s）..." : "推送到草稿箱"}
          </button>

          {result && (
            <div className={"mt-4 p-3 rounded-lg text-sm " +
              (result.ok ? "bg-green-50 text-green-800" : "bg-rose-50 text-rose-800")}>
              <div className="flex items-start gap-2">
                {result.ok ? <Check size={14} className="mt-0.5 text-green-600" />
                  : <AlertCircle size={14} className="mt-0.5 text-rose-600" />}
                <div className="flex-1">
                  <p className="font-semibold">{result.ok ? "推送成功" : "推送失败"}</p>
                  <p className="text-xs mt-1 break-words">{result.message}</p>
                  {result.ok && (
                    <p className="text-xs mt-2 text-gray-600">
                      去公众号后台 → 内容与互动 → 草稿箱 找到这篇文章，可以预览/编辑/群发。
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 后续可加：定时发布、群发设置 */}
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
          <Sparkles size={16} className="inline mr-1" />
          定时发布、敏感词检测会在 P5 阶段加入
        </div>
      </div>

      {/* 右：文章概览 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">文章概览</h3>
        {article.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover_image_url} alt="封面"
            className="w-full aspect-video object-cover rounded-lg mb-3" />
        )}
        <h4 className="font-bold text-gray-900 text-base mb-1">{article.title || "（未填标题）"}</h4>
        <p className="text-xs text-gray-400 mb-2">{article.author || "音乐密码"} · {article.word_count} 字</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{article.digest || "（未填摘要）"}</p>
        <div className="text-[11px] text-gray-400 border-t pt-3">
          推送后可在公众号后台编辑、配二维码、群发。<br />
          注意：草稿箱模式不会自动发推送给粉丝，需在后台手动发布。
        </div>
      </div>
    </div>
  );
}

// ============ 占位步骤 ============
function StepPlaceholder({ phase, step }: { phase: number; step: number }) {
  const meta = STEPS[step - 1];
  const Icon = meta.icon;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <div className={`inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br ${meta.color} text-white items-center justify-center mb-4 shadow-lg`}>
        <Icon size={28} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">第 {step} 步 · {meta.label}</h2>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 rounded-lg text-sm">
        <Sparkles size={14} />此步骤将在 P{phase} 阶段实装
      </div>
    </div>
  );
}

// ============ 统一 AI 按钮：明确显示当前模型（Qwen / Claude / ...） ============
function AIButton({
  onClick, loading, aiInfo, idleText, loadingText,
  icon = "sparkles", size = "md", disabled = false,
}: {
  onClick: () => void;
  loading: boolean;
  aiInfo: AIModelInfo | null;
  idleText: string;
  loadingText: string;
  icon?: "sparkles" | "refresh" | "wand";
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const IconCmp = icon === "refresh" ? RefreshCw : icon === "wand" ? Wand2 : Sparkles;
  const provider = providerLabel(aiInfo?.provider);
  const modelName = aiInfo?.model;
  const isSm = size === "sm";
  return (
    <div className={isSm ? "inline-flex flex-col items-start" : "mt-3 inline-flex flex-col items-start"}>
      <button onClick={onClick} disabled={loading || disabled}
        className={
          (isSm
            ? "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            : "inline-flex items-center gap-2 px-4 py-2 text-sm") +
          " bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
        }>
        {loading ? <Loader2 size={isSm ? 12 : 14} className="animate-spin" /> : <IconCmp size={isSm ? 12 : 14} />}
        <span>{provider}</span>
        <span className="opacity-80">·</span>
        <span>{loading ? loadingText : idleText}</span>
      </button>
      {modelName && (
        <span className={(isSm ? "text-[10px]" : "text-[11px]") + " text-gray-400 mt-1"}>
          当前模型：{modelName}
        </span>
      )}
      {!aiInfo?.provider && (
        <span className={(isSm ? "text-[10px]" : "text-[11px]") + " text-amber-600 mt-1"}>
          ⚠ 未配置 AI 模型，请去系统设置添加
        </span>
      )}
    </div>
  );
}

// ============ 极简 Markdown 渲染（不引入额外依赖）============
function renderSimpleMarkdown(md: string): React.ReactNode {
  if (!md) return <span className="text-gray-400">正文为空</span>;
  return md.split(/\n\n+/).map((block, i) => {
    if (block.startsWith("## ")) {
      return <h3 key={i} className="text-lg font-bold mt-4 mb-2 text-gray-900">{block.slice(3)}</h3>;
    }
    if (block.startsWith("# ")) {
      return <h2 key={i} className="text-xl font-bold mt-4 mb-2 text-gray-900">{block.slice(2)}</h2>;
    }
    const inline = block.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        return <strong key={j} className="text-violet-700">{seg.slice(2, -2)}</strong>;
      }
      return <span key={j}>{seg}</span>;
    });
    return <p key={i} className="mb-3">{inline}</p>;
  });
}
