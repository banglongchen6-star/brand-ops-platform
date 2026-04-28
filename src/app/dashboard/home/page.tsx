"use client";

// 工作台首页 — 个人工作笔记 + 我相关的任务（双栏）
// 笔记：所有笔记同屏卡片视图，点编辑进入编辑态，手动保存
// 任务：右侧 4 tab，行内勾选完成
// AI 桥接：编辑态里的「AI 检测待办」按钮，结果右下角 toast

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus, FileText, Loader2, X, Trash2, CheckCircle2,
  Sparkles, ChevronLeft, ChevronRight, ListChecks,
  BookOpen, Sun, Moon, Edit2, Save, Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============ 类型 ============
interface Note {
  id: string;
  date: string;
  title: string;
  content_md: string;
  tags: string[];
  last_detect_len: number;
  last_detect_at: string | null;
  created_at: string;
  updated_at: string;
}
interface MyTask {
  id: string;
  title: string;
  description: string | null;
  module: string | null;
  status: string | null;
  priority: string | null;
  progress_percent: number | null;
  due_at: string | null;
  my_role: string[];
  updated_at: string;
}
interface ActionCandidate {
  text: string;
  suggested_title: string;
  suggested_due: string | null;
  priority: "low" | "medium" | "high";
  reason: string;
}

// ============ 工具 ============
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return { label: "夜深了", icon: Moon };
  if (h < 11) return { label: "上午好", icon: Sun };
  if (h < 14) return { label: "中午好", icon: Sun };
  if (h < 18) return { label: "下午好", icon: Sun };
  return { label: "晚上好", icon: Moon };
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function formatDate(s: string) {
  const d = new Date(s + "T00:00:00");
  const w = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${w}`;
}

// 简易 Markdown 渲染
function renderMd(md: string): React.ReactNode {
  if (!md.trim()) return <span className="text-gray-300 italic">空内容</span>;
  return md.split(/\n+/).map((line, i) => {
    if (!line.trim()) return null;
    if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-bold text-gray-900 mt-3 mb-1">{line.slice(4)}</h4>;
    if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold text-gray-900 mt-3 mb-1.5">{line.slice(3)}</h3>;
    if (line.startsWith("# ")) return <h2 key={i} className="text-lg font-bold text-gray-900 mt-3 mb-2">{line.slice(2)}</h2>;
    const checkboxMatch = line.match(/^[\s-]*\[([ xX])\]\s+(.+)$/);
    if (checkboxMatch) {
      const checked = checkboxMatch[1].toLowerCase() === "x";
      return (
        <div key={i} className="flex items-start gap-2 my-0.5 text-sm">
          <span className={"w-4 h-4 mt-0.5 border-2 rounded shrink-0 flex items-center justify-center " +
            (checked ? "bg-green-500 border-green-500" : "border-gray-300")}>
            {checked && <span className="text-white text-[10px]">✓</span>}
          </span>
          <span className={checked ? "text-gray-400 line-through" : "text-gray-700"}>
            {renderInline(checkboxMatch[2])}
          </span>
        </div>
      );
    }
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bulletMatch) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5 text-sm text-gray-700">
          <span className="text-violet-400 mt-0.5">•</span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>
      );
    }
    const numMatch = line.match(/^[\s]*\d+[\.、)]\s*(.+)$/);
    if (numMatch) {
      return <p key={i} className="my-0.5 text-sm text-gray-700">{renderInline(line)}</p>;
    }
    return <p key={i} className="my-1.5 text-sm text-gray-700 leading-relaxed">{renderInline(line)}</p>;
  });
}
function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|@(?:TODO|FOLLOW|IDEA)\b|#[\u4e00-\u9fa5\w-]+)/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("@")) {
      return <span key={i} className="inline-block px-1.5 py-0 bg-amber-100 text-amber-800 text-[11px] rounded mx-0.5 font-medium">{p}</span>;
    }
    if (p.startsWith("#") && !p.startsWith("# ")) {
      return <span key={i} className="inline-block px-1.5 py-0 bg-violet-100 text-violet-700 text-[11px] rounded mx-0.5">{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

// ============ 主页面 ============
export default function HomePage() {
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskTab, setTaskTab] = useState<"today" | "upcoming" | "review" | "collab">("today");

  const [pendingActions, setPendingActions] = useState<ActionCandidate[]>([]);
  const [showActionsPanel, setShowActionsPanel] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => { loadAll(); }, [date]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadNotes(), loadTasks()]);
    setLoading(false);
  }
  async function loadNotes() {
    const r = await fetch(`/api/notes?date=${date}`);
    const j = await r.json();
    setNotes((j.notes || []) as Note[]);
  }
  async function loadTasks() {
    const r = await fetch("/api/tasks/my-related");
    const j = await r.json();
    setTasks((j.tasks || []) as MyTask[]);
  }

  async function newNote() {
    const r = await fetch("/api/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, title: "新笔记" }),
    });
    const j = await r.json();
    if (j.note) {
      setNotes((prev) => [...prev, j.note]);
      setEditingId(j.note.id); // 新建后直接进编辑态
    }
  }

  async function saveNote(id: string, title: string, content_md: string) {
    await fetch(`/api/notes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content_md }),
    });
    setNotes((prev) => prev.map((n) =>
      n.id === id ? { ...n, title, content_md, updated_at: new Date().toISOString() } : n));
    setEditingId(null);
  }

  async function deleteNote(id: string) {
    if (!confirm("删除这篇笔记？")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingId === id) setEditingId(null);
  }

  async function detectActions(noteId: string) {
    const r = await fetch(`/api/notes/${noteId}/detect-actions`, { method: "POST" });
    const j = await r.json();
    if (Array.isArray(j.candidates) && j.candidates.length > 0) {
      setPendingActions(j.candidates);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 8000);
    } else if (j.skipped) {
      alert("AI 没检测到可转任务的内容（" + j.skipped + "）");
    } else {
      alert("AI 没检测到可转任务的内容");
    }
  }

  async function createTaskFromAction(c: ActionCandidate) {
    const r = await fetch("/api/tasks/quick-add", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: c.suggested_title,
        description: `来自笔记：${c.text}`,
        priority: c.priority,
        due_at: c.suggested_due ? c.suggested_due + "T18:00:00" : null,
        source_type: "note_detect",
      }),
    });
    if (r.ok) {
      setPendingActions((prev) => prev.filter((x) => x !== c));
      await loadTasks();
    } else {
      alert("创建任务失败");
    }
  }

  // 任务分类
  const today = todayStr();
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const undone = tasks.filter((t) => t.status !== "done");
  const taskGroups = useMemo(() => ({
    today: undone.filter((t) => t.due_at && t.due_at.slice(0, 10) <= today),
    upcoming: undone.filter((t) => t.due_at && t.due_at.slice(0, 10) > today && t.due_at.slice(0, 10) <= sevenDaysLater),
    review: undone.filter((t) => t.my_role.includes("reviewer")),
    collab: undone.filter((t) => t.my_role.length === 1 && t.my_role[0] === "participant"),
  }), [undone, today, sevenDaysLater]);

  function shiftDate(delta: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  const Greeting = getGreeting().icon;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* 顶部问候 */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Greeting size={22} className="text-amber-500" />
          {getGreeting().label} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {formatDate(today)} · 今日 {taskGroups.today.length} 项待办 · 待我审 {taskGroups.review.length}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-5">
        {/* 左：笔记区 */}
        <div className="space-y-4">
          {/* 工具条 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3 flex items-center gap-3">
            <BookOpen size={16} className="text-violet-600" />
            <h2 className="font-semibold text-gray-900">我的工作笔记</h2>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => shiftDate(-1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500" title="前一天">
                <ChevronLeft size={14} />
              </button>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-violet-400" />
              <button onClick={() => shiftDate(1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500" title="后一天">
                <ChevronRight size={14} />
              </button>
              {date !== todayStr() && (
                <button onClick={() => setDate(todayStr())}
                  className="text-[11px] px-2 py-0.5 ml-1 rounded text-violet-600 hover:bg-violet-50">
                  回今日
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400 ml-2">{notes.length} 篇</span>
            <div className="flex-1" />
            <button onClick={newNote}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700">
              <Plus size={12} />新建笔记
            </button>
          </div>

          {/* 笔记卡片列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="animate-spin mr-2" size={16} />加载中...
            </div>
          ) : notes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500">
              <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="mb-3">这一天还没有笔记</p>
              <button onClick={newNote}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                <Plus size={12} />开始第一篇
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <NoteCard
                  key={n.id} note={n}
                  isEditing={editingId === n.id}
                  onStartEdit={() => setEditingId(n.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(title, content) => saveNote(n.id, title, content)}
                  onDelete={() => deleteNote(n.id)}
                  onDetect={() => detectActions(n.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 右：任务区 */}
        <TasksPanel
          tasks={tasks}
          taskGroups={taskGroups}
          tab={taskTab} setTab={setTaskTab}
          onChange={loadTasks}
        />
      </div>

      {/* AI Toast */}
      {showToast && pendingActions.length > 0 && (
        <button
          onClick={() => { setShowActionsPanel(true); setShowToast(false); }}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-xl shadow-lg hover:bg-violet-700">
          <Sparkles size={16} />
          <span className="text-sm">Qwen 检测到 {pendingActions.length} 个可能的待办</span>
          <span className="text-xs opacity-80">点击查看 →</span>
        </button>
      )}

      {/* AI 转任务面板 */}
      {showActionsPanel && (
        <ActionsPanel
          actions={pendingActions}
          onClose={() => setShowActionsPanel(false)}
          onCreate={createTaskFromAction}
          onDismiss={(c) => setPendingActions((prev) => prev.filter((x) => x !== c))}
        />
      )}
    </div>
  );
}

// ============ 单个笔记卡片（视图/编辑双态） ============
function NoteCard({ note, isEditing, onStartEdit, onCancelEdit, onSave, onDelete, onDetect }: {
  note: Note;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (title: string, content: string) => Promise<void>;
  onDelete: () => void;
  onDetect: () => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content_md);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  // 进入编辑态时同步最新内容
  useEffect(() => {
    if (isEditing) {
      setTitle(note.title);
      setContent(note.content_md);
    }
  }, [isEditing, note.title, note.content_md]);

  async function handleSave() {
    setSaving(true);
    await onSave(title.slice(0, 80), content);
    setSaving(false);
  }
  async function handleDetect() {
    setDetecting(true);
    await onDetect();
    setDetecting(false);
  }

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl border-2 border-violet-300 shadow-md p-4">
        <input
          type="text" value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="笔记标题"
          className="w-full text-base font-bold border-b border-gray-200 focus:border-violet-400 focus:outline-none py-1.5 mb-3"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"开始记录...\n\n支持 Markdown：## 标题、- 列表、[ ] 待办、**加粗**\n关键词 @TODO @FOLLOW @IDEA 会被 AI 重点识别"}
          className="w-full min-h-[280px] px-3 py-2 border border-gray-100 rounded-lg text-sm font-mono resize-y focus:outline-none focus:border-violet-300 leading-relaxed"
        />
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] text-gray-400">{content.length} 字符</span>
          <div className="flex-1" />
          <button onClick={handleDetect} disabled={detecting || !content.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 disabled:opacity-50">
            {detecting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI 检测待办
          </button>
          <button onClick={onCancelEdit} disabled={saving}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-violet-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText size={14} className="text-violet-500 shrink-0" />
          <h3 className="font-bold text-gray-900 truncate">{note.title || "未命名"}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-400 whitespace-nowrap">
            {note.content_md.length} 字符 · 更新于 {new Date(note.updated_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onStartEdit}
              className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300"
              title="编辑">
              <Edit2 size={12} />
            </button>
            <button onClick={onDelete}
              className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300"
              title="删除">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
      <div className="prose prose-sm max-w-none text-gray-700">
        {renderMd(note.content_md)}
      </div>
    </div>
  );
}

// ============ 任务区 ============
function TasksPanel({ tasks, taskGroups, tab, setTab, onChange }: {
  tasks: MyTask[];
  taskGroups: { today: MyTask[]; upcoming: MyTask[]; review: MyTask[]; collab: MyTask[] };
  tab: "today" | "upcoming" | "review" | "collab";
  setTab: (t: "today" | "upcoming" | "review" | "collab") => void;
  onChange: () => Promise<void>;
}) {
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDue, setQuickDue] = useState("");
  const [quickPriority, setQuickPriority] = useState<"low" | "medium" | "high">("medium");
  const [adding, setAdding] = useState(false);

  async function quickAdd() {
    if (!quickTitle.trim()) return;
    setAdding(true);
    await fetch("/api/tasks/quick-add", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: quickTitle.trim(),
        due_at: quickDue ? quickDue + "T18:00:00" : null,
        priority: quickPriority,
      }),
    });
    setQuickTitle(""); setQuickDue("");
    await onChange();
    setAdding(false);
  }

  async function toggleDone(t: MyTask) {
    const newStatus = t.status === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", t.id);
    await onChange();
  }

  const list = taskGroups[tab];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col self-start sticky top-4">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <ListChecks size={16} className="text-blue-600" />
        <h2 className="font-semibold text-gray-900">我的任务</h2>
        <span className="text-xs text-gray-400">共 {tasks.length} 项</span>
        <div className="flex-1" />
        <Link href="/dashboard/tasks" className="text-xs text-violet-600 hover:underline">
          全部 →
        </Link>
      </div>

      <div className="px-3 py-2 flex gap-1 border-b border-gray-100 overflow-x-auto">
        {[
          { v: "today" as const,    label: "今日待办", count: taskGroups.today.length },
          { v: "upcoming" as const, label: "即将到期", count: taskGroups.upcoming.length },
          { v: "review" as const,   label: "待我审", count: taskGroups.review.length },
          { v: "collab" as const,   label: "协作中", count: taskGroups.collab.length },
        ].map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={"shrink-0 px-2.5 py-1 text-xs rounded-md transition-colors " +
              (tab === t.v ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50")}>
            {t.label} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 max-h-[60vh]">
        {list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8">
            {tab === "today" ? "🎉 今日无待办" :
             tab === "upcoming" ? "未来 7 天无待办" :
             tab === "review" ? "暂无待审" : "暂无协作"}
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} />)}
          </div>
        )}
      </div>

      <div className="px-3 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
        <div className="flex items-center gap-1.5">
          <input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && quickTitle.trim()) quickAdd(); }}
            placeholder="快速新建任务..."
            className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-violet-400" />
          <input type="date" value={quickDue} onChange={(e) => setQuickDue(e.target.value)}
            className="w-28 px-1 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:border-violet-400" />
          <select value={quickPriority} onChange={(e) => setQuickPriority(e.target.value as "low" | "medium" | "high")}
            className="px-1 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:border-violet-400">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
          <button onClick={quickAdd} disabled={!quickTitle.trim() || adding}
            className="shrink-0 inline-flex items-center px-2 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: MyTask; onToggle: () => Promise<void> }) {
  const isDone = task.status === "done";
  const isOverdue = task.due_at && !isDone && task.due_at.slice(0, 10) < todayStr();
  const priorityColors: Record<string, string> = {
    high: "bg-rose-100 text-rose-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-gray-100 text-gray-600",
  };
  return (
    <div className="px-2 py-2 rounded-lg hover:bg-gray-50 flex items-start gap-2 group">
      <button onClick={onToggle} className="mt-0.5 shrink-0">
        {isDone ? <CheckCircle2 size={16} className="text-green-600" /> :
          <div className="w-4 h-4 border-2 border-gray-300 rounded hover:border-violet-500" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={"text-sm " + (isDone ? "line-through text-gray-400" : "text-gray-900")}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400 flex-wrap">
          {task.priority && (
            <span className={"px-1.5 py-0.5 rounded " + (priorityColors[task.priority] || "bg-gray-100 text-gray-600")}>
              {task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}
            </span>
          )}
          {task.due_at && (
            <span className={isOverdue ? "text-rose-600 font-medium" : ""}>
              {isOverdue && "⏰ "}
              {new Date(task.due_at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}
            </span>
          )}
          {task.module && <span>· {task.module}</span>}
        </div>
      </div>
    </div>
  );
}

// ============ AI 转任务面板 ============
function ActionsPanel({ actions, onClose, onCreate, onDismiss }: {
  actions: ActionCandidate[];
  onClose: () => void;
  onCreate: (c: ActionCandidate) => Promise<void>;
  onDismiss: (c: ActionCandidate) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-600" />
            <h3 className="font-semibold text-gray-900">AI 检测到的待办（{actions.length}）</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>
        {actions.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">没有待处理的建议</div>
        ) : (
          <div className="p-4 space-y-3">
            {actions.map((c, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{c.suggested_title}</h4>
                    <p className="text-xs text-gray-500 mb-1">原文：「{c.text}」</p>
                    <p className="text-xs text-gray-400">{c.reason}</p>
                  </div>
                  <span className={"text-[10px] px-2 py-0.5 rounded-full shrink-0 " +
                    (c.priority === "high" ? "bg-rose-100 text-rose-700" :
                     c.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600")}>
                    {c.priority === "high" ? "高" : c.priority === "medium" ? "中" : "低"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {c.suggested_due && (
                    <span className="text-[11px] text-blue-600">📅 {c.suggested_due}</span>
                  )}
                  <div className="flex-1" />
                  <button onClick={() => onDismiss(c)}
                    className="px-3 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600">
                    忽略
                  </button>
                  <button onClick={() => onCreate(c)}
                    className="px-3 py-1 text-xs bg-violet-600 text-white rounded-md hover:bg-violet-700">
                    + 创建任务
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
