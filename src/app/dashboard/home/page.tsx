"use client";

// 工作台首页 — 个人工作笔记 + 我相关的任务（双栏）
// 路径: /dashboard/home
// Q1=AB主：早上规划+随时记录   Q2=完全私人   Q3=分屏 + AI 转任务
// Q6=一天多条     Q7=全部相关任务   Q8=自动检测但不打扰（toast）

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus, FileText, Loader2, X, Trash2, Check, CheckCircle2, Clock, AlertCircle,
  Sparkles, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ListChecks,
  Eye, Edit2, Save, Sun, Moon, BookOpen, Filter,
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

// ============ 主页面 ============
export default function HomePage() {
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskTab, setTaskTab] = useState<"today" | "upcoming" | "review" | "collab">("today");

  // AI detect
  const [detectEnabled, setDetectEnabled] = useState(false); // 默认关
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
    const list = (j.notes || []) as Note[];
    setNotes(list);
    if (list.length > 0 && !list.find((n) => n.id === activeNoteId)) {
      setActiveNoteId(list[0].id);
    } else if (list.length === 0) {
      setActiveNoteId(null);
    }
  }

  async function loadTasks() {
    const r = await fetch("/api/tasks/my-related");
    const j = await r.json();
    setTasks((j.tasks || []) as MyTask[]);
  }

  async function newNote() {
    const r = await fetch("/api/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, title: "速记" }),
    });
    const j = await r.json();
    if (j.note) {
      setNotes((prev) => [...prev, j.note]);
      setActiveNoteId(j.note.id);
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("删除这篇笔记？")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) {
      const remaining = notes.filter((n) => n.id !== id);
      setActiveNoteId(remaining[0]?.id || null);
    }
  }

  function patchNote(id: string, patch: Partial<Note>) {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch } : n));
  }

  // AI 检测
  async function detectActions(noteId: string) {
    const r = await fetch(`/api/notes/${noteId}/detect-actions`, { method: "POST" });
    const j = await r.json();
    if (Array.isArray(j.candidates) && j.candidates.length > 0) {
      setPendingActions(j.candidates);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 8000);
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

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  // 任务分类
  const today = todayStr();
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const undone = tasks.filter((t) => t.status !== "done");

  const taskGroups = useMemo(() => {
    const todayList = undone.filter((t) => t.due_at && t.due_at.slice(0, 10) <= today);
    const upcomingList = undone.filter((t) => t.due_at && t.due_at.slice(0, 10) > today && t.due_at.slice(0, 10) <= sevenDaysLater);
    const reviewList = undone.filter((t) => t.my_role.includes("reviewer"));
    const collabList = undone.filter((t) => t.my_role.length === 1 && t.my_role[0] === "participant");
    return { today: todayList, upcoming: upcomingList, review: reviewList, collab: collabList };
  }, [undone, today, sevenDaysLater]);

  const Greeting = getGreeting().icon;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* 顶部问候 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Greeting size={22} className="text-amber-500" />
            {getGreeting().label} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDate(today)} · 今日 {taskGroups.today.length} 项待办 · 待我审 {taskGroups.review.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={detectEnabled} onChange={(e) => setDetectEnabled(e.target.checked)} />
            <Sparkles size={12} className="text-violet-600" />
            AI 自动检测待办
          </label>
        </div>
      </div>

      <div className="grid lg:grid-cols-[3fr_2fr] gap-5">
        {/* 左：笔记区 */}
        <NotesPanel
          date={date} setDate={setDate}
          notes={notes} activeNoteId={activeNoteId} setActiveNoteId={setActiveNoteId}
          onNewNote={newNote} onDeleteNote={deleteNote}
          activeNote={activeNote}
          patchNote={patchNote}
          loading={loading}
          detectEnabled={detectEnabled}
          onDetectActions={detectActions}
          onManualDetect={() => activeNote && detectActions(activeNote.id)}
        />

        {/* 右：任务区 */}
        <TasksPanel
          tasks={tasks}
          taskGroups={taskGroups}
          tab={taskTab} setTab={setTaskTab}
          onChange={loadTasks}
        />
      </div>

      {/* 右下角 toast */}
      {showToast && pendingActions.length > 0 && (
        <button
          onClick={() => { setShowActionsPanel(true); setShowToast(false); }}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-xl shadow-lg hover:bg-violet-700 animate-in slide-in-from-bottom-3">
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

// ============ 笔记区 ============
function NotesPanel({
  date, setDate, notes, activeNoteId, setActiveNoteId, onNewNote, onDeleteNote,
  activeNote, patchNote, loading, detectEnabled, onDetectActions, onManualDetect,
}: {
  date: string; setDate: (d: string) => void;
  notes: Note[]; activeNoteId: string | null; setActiveNoteId: (id: string) => void;
  onNewNote: () => void; onDeleteNote: (id: string) => void;
  activeNote: Note | null;
  patchNote: (id: string, patch: Partial<Note>) => void;
  loading: boolean;
  detectEnabled: boolean;
  onDetectActions: (id: string) => Promise<void>;
  onManualDetect: () => void;
}) {
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const detectTimer = useRef<NodeJS.Timeout | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");

  function queueSave(id: string, patch: Partial<Note>) {
    patchNote(id, patch);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavingState("saving");
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/notes/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSavingState("saved");
    }, 800);
  }

  // 自动 AI 检测：停笔 5s
  useEffect(() => {
    if (!detectEnabled || !activeNote) return;
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(() => {
      onDetectActions(activeNote.id);
    }, 5000);
    return () => { if (detectTimer.current) clearTimeout(detectTimer.current); };
  }, [activeNote?.content_md, detectEnabled, activeNote, onDetectActions]);

  function shiftDate(delta: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[600px]">
      {/* 顶部工具条 */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <BookOpen size={16} className="text-violet-600" />
        <h2 className="font-semibold text-gray-900">我的工作笔记</h2>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => shiftDate(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={14} />
          </button>
          <input type="date" value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-violet-400" />
          <button onClick={() => shiftDate(1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <ChevronRight size={14} />
          </button>
          {date !== todayStr() && (
            <button onClick={() => setDate(todayStr())}
              className="text-[11px] px-2 py-0.5 ml-1 rounded text-violet-600 hover:bg-violet-50">
              回今日
            </button>
          )}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">
          {savingState === "saving" ? "保存中..." : savingState === "saved" ? "已保存" : ""}
        </span>
        <button onClick={onNewNote}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700">
          <Plus size={12} />新建笔记
        </button>
      </div>

      {/* 笔记 tab pills */}
      <div className="px-5 pt-3 flex items-center gap-1.5 overflow-x-auto">
        {loading ? (
          <span className="text-xs text-gray-400 py-2">加载中...</span>
        ) : notes.length === 0 ? (
          <span className="text-xs text-gray-400 py-2">这一天还没有笔记，点右上「新建笔记」开始</span>
        ) : (
          notes.map((n) => (
            <button key={n.id} onClick={() => setActiveNoteId(n.id)}
              className={"shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors " +
                (n.id === activeNoteId
                  ? "bg-violet-100 text-violet-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50")}>
              <FileText size={11} />
              {n.title || "速记"}
            </button>
          ))
        )}
      </div>

      {/* 编辑器 */}
      {activeNote && (
        <div className="flex-1 px-5 py-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text" value={activeNote.title}
              onChange={(e) => queueSave(activeNote.id, { title: e.target.value.slice(0, 80) })}
              placeholder="笔记标题"
              className="flex-1 text-base font-semibold border-b border-transparent hover:border-gray-200 focus:outline-none focus:border-violet-400 py-1"
            />
            <button onClick={onManualDetect}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] border border-violet-200 text-violet-700 rounded-md hover:bg-violet-50"
              title="让 AI 检查这篇笔记里有哪些可转任务">
              <Sparkles size={11} />AI 检测待办
            </button>
            <button onClick={() => onDeleteNote(activeNote.id)}
              className="p-1.5 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50">
              <Trash2 size={13} />
            </button>
          </div>
          <textarea
            value={activeNote.content_md}
            onChange={(e) => queueSave(activeNote.id, { content_md: e.target.value })}
            placeholder="开始记录...&#10;&#10;支持 Markdown：## 标题、- 列表、[ ] 待办、**加粗**&#10;关键词 @TODO @FOLLOW @IDEA 会被 AI 重点识别"
            className="flex-1 w-full px-3 py-2 border border-gray-100 rounded-lg text-sm font-mono resize-none focus:outline-none focus:border-violet-300 leading-relaxed"
            style={{ minHeight: 400 }}
          />
          <div className="mt-2 text-[11px] text-gray-400 flex items-center justify-between">
            <span>{activeNote.content_md.length} 字符</span>
            <span>{activeNote.updated_at ? `最后保存：${new Date(activeNote.updated_at).toLocaleTimeString("zh-CN")}` : ""}</span>
          </div>
        </div>
      )}
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[600px]">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <ListChecks size={16} className="text-blue-600" />
        <h2 className="font-semibold text-gray-900">我的任务</h2>
        <span className="text-xs text-gray-400">共 {tasks.length} 项</span>
        <div className="flex-1" />
        <Link href="/dashboard/tasks" className="text-xs text-violet-600 hover:underline">
          全部任务管理 →
        </Link>
      </div>

      {/* tabs */}
      <div className="px-5 py-2 flex gap-1 border-b border-gray-100">
        {[
          { v: "today" as const,    label: "今日待办", count: taskGroups.today.length, color: "amber" },
          { v: "upcoming" as const, label: "即将到期", count: taskGroups.upcoming.length, color: "blue" },
          { v: "review" as const,   label: "待我审", count: taskGroups.review.length, color: "violet" },
          { v: "collab" as const,   label: "协作中", count: taskGroups.collab.length, color: "gray" },
        ].map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={"px-2.5 py-1 text-xs rounded-md transition-colors " +
              (tab === t.v ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50")}>
            {t.label} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12">
            {tab === "today" ? "🎉 今日没有待办" :
             tab === "upcoming" ? "未来 7 天没有待办" :
             tab === "review" ? "暂无待审任务" : "暂无协作任务"}
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} />)}
          </div>
        )}
      </div>

      {/* 快速新建 */}
      <div className="px-3 py-3 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && quickTitle.trim()) quickAdd(); }}
            placeholder="快速新建任务（回车保存）..."
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          <input type="date" value={quickDue} onChange={(e) => setQuickDue(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-violet-400" />
          <select value={quickPriority} onChange={(e) => setQuickPriority(e.target.value as "low" | "medium" | "high")}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-violet-400">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
          <button onClick={quickAdd} disabled={!quickTitle.trim() || adding}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 disabled:opacity-50">
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
  const roleLabels: Record<string, string> = {
    owner: "我负责",
    reviewer: "待我审",
    assignee: "我负责",
    participant: "协作",
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
          {task.my_role.length > 0 && (
            <span className="opacity-70">· {task.my_role.map((r) => roleLabels[r] || r).filter((v, i, a) => a.indexOf(v) === i).join("/")}</span>
          )}
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
          <div className="py-12 text-center text-sm text-gray-400">
            没有待处理的建议
          </div>
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
