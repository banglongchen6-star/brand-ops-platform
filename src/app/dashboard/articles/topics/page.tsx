"use client";

// 选题素材库 + 选题日历
// 路径: /dashboard/articles/topics
// 双视图：列表 / 月历
// 操作：增删改、AI 批量生成、采用为文章、标签筛选、排期

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Sparkles, Loader2, X, Check, Edit2, Trash2,
  Calendar as CalendarIcon, List, AlertCircle, Star, Search,
  ChevronLeft, ChevronRight,
} from "lucide-react";

type TopicStatus = "candidate" | "scheduled" | "used" | "discarded";

interface Topic {
  id: string;
  title: string;
  pain_point: string;
  target_audience: string;
  angle: string;
  reference_notes: string;
  tags: string[];
  status: TopicStatus;
  priority: number;
  scheduled_at: string | null;
  article_id: string | null;
  source_type: string;
  source_ref: string;
  created_at: string;
  updated_at: string;
}

const statusMeta: Record<TopicStatus, { label: string; color: string }> = {
  candidate:  { label: "候选",   color: "bg-gray-100 text-gray-700 border-gray-200" },
  scheduled:  { label: "已排期", color: "bg-blue-100 text-blue-700 border-blue-200" },
  used:       { label: "已采用", color: "bg-green-100 text-green-700 border-green-200" },
  discarded:  { label: "已弃用", color: "bg-rose-50 text-rose-600 border-rose-200" },
};

const sourceMeta: Record<string, { label: string; color: string }> = {
  manual:           { label: "手动", color: "bg-gray-50 text-gray-600" },
  ai:               { label: "AI",   color: "bg-violet-50 text-violet-700" },
  competitor:       { label: "竞品", color: "bg-orange-50 text-orange-700" },
  student_question: { label: "学员", color: "bg-cyan-50 text-cyan-700" },
  trend:            { label: "热榜", color: "bg-amber-50 text-amber-700" },
};

export default function TopicsPage() {
  const router = useRouter();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TopicStatus | "all">("candidate");
  const [keyword, setKeyword] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/topic-pool");
    const j = await r.json();
    setTopics(j.topics || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return topics.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        return (t.title || "").toLowerCase().includes(k)
          || (t.pain_point || "").toLowerCase().includes(k)
          || (t.angle || "").toLowerCase().includes(k)
          || (t.tags || []).some((tg) => tg.toLowerCase().includes(k));
      }
      return true;
    });
  }, [topics, filterStatus, keyword]);

  const counts = useMemo(() => ({
    all: topics.length,
    candidate: topics.filter((t) => t.status === "candidate").length,
    scheduled: topics.filter((t) => t.status === "scheduled").length,
    used: topics.filter((t) => t.status === "used").length,
    discarded: topics.filter((t) => t.status === "discarded").length,
  }), [topics]);

  async function useTopic(t: Topic) {
    if (t.status === "used" && t.article_id) {
      router.push(`/dashboard/articles/${t.article_id}`);
      return;
    }
    const r = await fetch(`/api/topic-pool/${t.id}/use`, { method: "POST" });
    const j = await r.json();
    if (!r.ok) { alert(j.error || "采用失败"); return; }
    router.push(`/dashboard/articles/${j.article_id}`);
  }

  async function updateStatus(t: Topic, status: TopicStatus) {
    await fetch(`/api/topic-pool/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function remove(t: Topic) {
    if (!confirm(`删除「${t.title}」？`)) return;
    await fetch(`/api/topic-pool/${t.id}`, { method: "DELETE" });
    await load();
  }

  async function reschedule(t: Topic, date: string | null) {
    await fetch(`/api/topic-pool/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_at: date,
        status: date ? "scheduled" : "candidate",
      }),
    });
    await load();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/articles" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">选题素材库</h1>
            <p className="text-xs text-gray-500 mt-0.5">攒选题、排期、避免重复 · 写文章时直接采用</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="inline-flex border border-gray-200 rounded-lg p-0.5 bg-white">
            <button onClick={() => setView("list")}
              className={"px-3 py-1.5 text-xs rounded-md flex items-center gap-1 " +
                (view === "list" ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-50")}>
              <List size={12} />列表
            </button>
            <button onClick={() => setView("calendar")}
              className={"px-3 py-1.5 text-xs rounded-md flex items-center gap-1 " +
                (view === "calendar" ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-50")}>
              <CalendarIcon size={12} />日历
            </button>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            <Plus size={14} />添加选题
          </button>
          <button onClick={() => setShowAI(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">
            <Sparkles size={14} />AI 批量生成
          </button>
        </div>
      </div>

      {/* 统计条 + 状态筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { v: "all" as const,        label: "全部",   c: counts.all },
          { v: "candidate" as const,  label: "候选",   c: counts.candidate },
          { v: "scheduled" as const,  label: "已排期", c: counts.scheduled },
          { v: "used" as const,       label: "已采用", c: counts.used },
          { v: "discarded" as const,  label: "已弃用", c: counts.discarded },
        ].map((f) => (
          <button key={f.v} onClick={() => setFilterStatus(f.v)}
            className={"px-3 py-1.5 text-xs rounded-full border transition-colors " +
              (filterStatus === f.v ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-violet-300")}>
            {f.label} <span className="ml-1 opacity-70">{f.c}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜标题/痛点/标签..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:border-violet-400" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} />加载中...
        </div>
      ) : view === "list" ? (
        <ListView
          topics={filtered}
          onEdit={(t) => { setEditing(t); setShowForm(true); }}
          onDelete={remove}
          onUse={useTopic}
          onUpdateStatus={updateStatus}
        />
      ) : (
        <CalendarView
          topics={topics}
          onClickTopic={(t) => { setEditing(t); setShowForm(true); }}
          onReschedule={reschedule}
        />
      )}

      {/* 表单弹窗 */}
      {showForm && (
        <TopicFormModal
          topic={editing}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await load(); }}
        />
      )}

      {/* AI 生成弹窗 */}
      {showAI && (
        <AIGenerateModal
          onClose={() => setShowAI(false)}
          onGenerated={async () => { setShowAI(false); await load(); }}
        />
      )}
    </div>
  );
}

// ============ 列表视图 ============
function ListView({ topics, onEdit, onDelete, onUse, onUpdateStatus }: {
  topics: Topic[];
  onEdit: (t: Topic) => void;
  onDelete: (t: Topic) => void;
  onUse: (t: Topic) => Promise<void>;
  onUpdateStatus: (t: Topic, status: TopicStatus) => Promise<void>;
}) {
  if (topics.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-500">
        没有选题，点右上角「+ 添加」或「AI 批量生成」开始
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {topics.map((t) => {
        const sm = sourceMeta[t.source_type] || sourceMeta.manual;
        const stm = statusMeta[t.status];
        return (
          <div key={t.id} className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-violet-300 hover:shadow-sm transition-all">
            <div className="flex items-start gap-3">
              {/* 优先级星 */}
              <div className="shrink-0 pt-0.5">
                <PriorityStars value={t.priority} />
              </div>

              {/* 主体 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{t.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${stm.color}`}>
                    {stm.label}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${sm.color}`}>{sm.label}</span>
                  {t.scheduled_at && (
                    <span className="text-[10px] text-blue-600">📅 {t.scheduled_at}</span>
                  )}
                </div>

                {t.pain_point && <p className="text-sm text-gray-600 mb-1">💡 {t.pain_point}</p>}
                {t.angle && <p className="text-xs text-gray-500 mb-2">📐 {t.angle}</p>}

                {/* 标签 */}
                {t.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {t.tags.map((tg, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded">
                        {tg}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 操作 */}
              <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {t.status !== "used" && (
                  <button onClick={() => onUse(t)}
                    className="px-2.5 py-1 text-xs bg-violet-600 text-white rounded-md hover:bg-violet-700">
                    采用
                  </button>
                )}
                {t.status === "used" && (
                  <button onClick={() => onUse(t)}
                    className="px-2.5 py-1 text-xs border border-green-300 text-green-700 rounded-md hover:bg-green-50">
                    打开文章
                  </button>
                )}
                <button onClick={() => onEdit(t)}
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50">
                  <Edit2 size={12} />
                </button>
                {t.status !== "discarded" && t.status !== "used" && (
                  <button onClick={() => onUpdateStatus(t, "discarded")}
                    className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-rose-50 hover:text-rose-600"
                    title="弃用">
                    <X size={12} />
                  </button>
                )}
                <button onClick={() => onDelete(t)}
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PriorityStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={10} className={i <= value ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
      ))}
    </div>
  );
}

// ============ 日历视图（月） ============
function CalendarView({ topics, onClickTopic, onReschedule }: {
  topics: Topic[];
  onClickTopic: (t: Topic) => void;
  onReschedule: (t: Topic, date: string | null) => Promise<void>;
}) {
  const [month, setMonth] = useState(() => new Date());

  // 把月内排期 + 候选分组
  const scheduledByDate = useMemo(() => {
    const map = new Map<string, Topic[]>();
    topics.filter((t) => t.scheduled_at).forEach((t) => {
      const arr = map.get(t.scheduled_at!) || [];
      arr.push(t);
      map.set(t.scheduled_at!, arr);
    });
    return map;
  }, [topics]);

  const candidates = useMemo(
    () => topics.filter((t) => t.status === "candidate" && !t.scheduled_at),
    [topics],
  );

  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);
  const startWeekday = firstDay.getDay(); // 0=Sun
  const days: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);

  function fmt(d: number): string {
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4">
      {/* 主日历 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth(new Date(year, monthIdx - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={16} />
          </button>
          <h3 className="font-semibold text-gray-900">{year} 年 {monthIdx + 1} 月</h3>
          <button onClick={() => setMonth(new Date(year, monthIdx + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
            <div key={w} className="text-center text-xs text-gray-400 py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const dateStr = fmt(d);
            const todayStr = new Date().toISOString().slice(0, 10);
            const isToday = dateStr === todayStr;
            const list = scheduledByDate.get(dateStr) || [];
            return (
              <div key={i}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  const id = e.dataTransfer.getData("text/topic-id");
                  const t = topics.find((x) => x.id === id);
                  if (t) await onReschedule(t, dateStr);
                }}
                className={"aspect-square min-h-[80px] p-1 rounded border text-xs flex flex-col gap-0.5 " +
                  (isToday ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:bg-gray-50")}>
                <div className={"text-[11px] " + (isToday ? "font-bold text-violet-700" : "text-gray-500")}>
                  {d}
                </div>
                <div className="flex-1 overflow-hidden flex flex-col gap-0.5">
                  {list.slice(0, 3).map((t) => (
                    <button key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/topic-id", t.id)}
                      onClick={() => onClickTopic(t)}
                      className="w-full text-left text-[10px] px-1 py-0.5 bg-blue-100 text-blue-800 rounded truncate hover:bg-blue-200">
                      {t.title}
                    </button>
                  ))}
                  {list.length > 3 && (
                    <div className="text-[9px] text-gray-400">+{list.length - 3} 篇</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右侧候选池 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">📋 候选选题</h3>
        <p className="text-[11px] text-gray-500 mb-3">拖到日历日期上排期</p>
        {candidates.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">暂无候选</p>
        ) : (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {candidates.map((t) => (
              <div key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/topic-id", t.id)}
                onClick={() => onClickTopic(t)}
                className="p-2 border border-gray-200 rounded-lg cursor-move hover:border-violet-300 hover:bg-violet-50 transition-colors">
                <div className="text-xs font-medium text-gray-900 mb-0.5 line-clamp-2">{t.title}</div>
                {t.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {t.tags.slice(0, 2).map((tg, i) => (
                      <span key={i} className="text-[9px] px-1 bg-violet-50 text-violet-700 rounded">{tg}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 编辑/新建表单 ============
function TopicFormModal({ topic, onClose, onSaved }: {
  topic: Topic | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: topic?.title || "",
    pain_point: topic?.pain_point || "",
    target_audience: topic?.target_audience || "",
    angle: topic?.angle || "",
    reference_notes: topic?.reference_notes || "",
    tags: (topic?.tags || []).join(", "),
    status: topic?.status || "candidate" as TopicStatus,
    priority: topic?.priority || 3,
    scheduled_at: topic?.scheduled_at || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!form.title.trim()) { setError("标题不能为空"); return; }
    setSaving(true); setError("");
    const tags = form.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const body = {
      ...form,
      tags,
      scheduled_at: form.scheduled_at || null,
    };
    const url = topic ? `/api/topic-pool/${topic.id}` : "/api/topic-pool";
    const r = await fetch(url, {
      method: topic ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!r.ok) { const j = await r.json(); setError(j.error || "保存失败"); return; }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{topic ? "编辑选题" : "新建选题"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {error && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-sm rounded flex items-center gap-1">
          <AlertCircle size={14} />{error}
        </div>}

        <div className="space-y-3">
          <Field label="选题方向" required>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例：成年人为什么越来越多开始学钢琴？"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </Field>

          <Field label="切入痛点">
            <textarea value={form.pain_point} onChange={(e) => setForm({ ...form, pain_point: e.target.value })}
              placeholder="文章想戳的核心痛点..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={2} />
          </Field>

          <Field label="目标人群">
            <input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
              placeholder="例：30+ 城市白领，时间碎片"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </Field>

          <Field label="切入角度建议">
            <textarea value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })}
              placeholder="给写手的角度提示..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={2} />
          </Field>

          <Field label="标签（逗号分隔）">
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="季节-暑期, 痛点-学不会, 卖点-30天体验课"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="优先级">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 星</option>)}
              </select>
            </Field>
            <Field label="状态">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TopicStatus })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                <option value="candidate">候选</option>
                <option value="scheduled">已排期</option>
                <option value="used">已采用</option>
                <option value="discarded">已弃用</option>
              </select>
            </Field>
          </div>

          <Field label="排期日期">
            <input type="date" value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </Field>

          <Field label="参考资料/备注">
            <textarea value={form.reference_notes}
              onChange={(e) => setForm({ ...form, reference_notes: e.target.value })}
              placeholder="灵感来源、竞品链接等..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={2} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ AI 批量生成 ============
function AIGenerateModal({ onClose, onGenerated }: {
  onClose: () => void;
  onGenerated: () => Promise<void>;
}) {
  const [count, setCount] = useState(10);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true); setError("");
    const r = await fetch("/api/topic-pool/ai-generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, focus }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setError(j.error || "生成失败"); return; }
    await onGenerated();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-violet-600" />Qwen · AI 批量生成选题
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {error && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-sm rounded flex items-center gap-1">
          <AlertCircle size={14} />{error}
        </div>}

        <div className="space-y-3">
          <Field label="生成数量">
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} 个</option>)}
            </select>
          </Field>

          <Field label="特别关注方向（可选）">
            <textarea value={focus} onChange={(e) => setFocus(e.target.value)}
              placeholder="例：最近想多写一些暑期亲子学琴的话题；或：避开零基础话题，多写进阶..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" rows={3} />
          </Field>

          <div className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded">
            AI 会自动避开库里近 60 天已有的选题，避免重复。
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button onClick={generate} disabled={busy}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {busy ? "生成中..." : "开始生成"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
