"use client";

// 工作台首页 — 个人工作笔记（按板块分组）+ 我相关任务

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Plus, FileText, Loader2, X, Trash2, CheckCircle2, Sparkles, ListChecks,
  Edit2, Save, Sun, Moon, ChevronDown, ChevronRight, Settings2, GripVertical,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ============ 类型 ============
interface Category {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
}
interface Note {
  id: string;
  title: string;
  content_md: string;
  category_id: string | null;
  sort_order: number | null;
  updated_at: string;
  created_at: string;
}
interface MyTask {
  id: string;
  title: string;
  module: string | null;
  status: string | null;
  priority: string | null;
  due_at: string | null;
  my_role: string[];
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

// 将旧的 {color} 语法转成 HTML（编辑器初始化用）
const SYNTAX_COLOR_HEX: Record<string, string> = {
  red: "#dc2626", orange: "#f97316", green: "#16a34a", blue: "#2563eb", purple: "#9333ea",
};
function syntaxToHtml(text: string): string {
  return text
    .replace(/\{(red|orange|green|blue|purple)\}([\s\S]+?)\{\/(?:red|orange|green|blue|purple)\}/g,
      (_, c, t) => `<span style="color:${SYNTAX_COLOR_HEX[c]}">${t}</span>`)
    .replace(/==([\s\S]+?)==/g,
      (_, t) => `<span style="background-color:#fef08a;border-radius:2px;padding:0 1px">${t}</span>`)
    .replace(/\n/g, "<br>");
}

// 简易 Markdown 渲染
function renderMd(md: string): React.ReactNode {
  if (!md.trim()) return <span className="text-gray-300 italic text-xs">空内容</span>;
  // 富文本内容（包含 HTML 标签）直接渲染
  if (/<[a-z][\s\S]*>/i.test(md)) {
    return <div dangerouslySetInnerHTML={{ __html: md }} className="text-sm leading-relaxed" />;
  }
  return md.split(/\n+/).map((line, i) => {
    if (!line.trim()) return null;
    if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-bold text-gray-900 mt-2 mb-0.5">{line.slice(4)}</h4>;
    if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold text-gray-900 mt-2 mb-0.5">{line.slice(3)}</h3>;
    if (line.startsWith("# ")) return <h2 key={i} className="text-lg font-bold text-gray-900 mt-2 mb-1">{line.slice(2)}</h2>;
    const cb = line.match(/^[\s-]*\[([ xX])\]\s+(.+)$/);
    if (cb) {
      const checked = cb[1].toLowerCase() === "x";
      return (
        <div key={i} className="flex items-start gap-2 my-0.5 text-sm">
          <span className={"w-4 h-4 mt-0.5 border-2 rounded shrink-0 flex items-center justify-center " +
            (checked ? "bg-green-500 border-green-500" : "border-gray-300")}>
            {checked && <span className="text-white text-[10px]">✓</span>}
          </span>
          <span className={checked ? "text-gray-400 line-through" : "text-gray-700"}>{renderInline(cb[2])}</span>
        </div>
      );
    }
    const bm = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bm) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5 text-sm text-gray-700">
          <span className="text-violet-400 mt-0.5">•</span>
          <span>{renderInline(bm[1])}</span>
        </div>
      );
    }
    return <p key={i} className="my-0.5 text-sm text-gray-700 leading-snug">{renderInline(line)}</p>;
  });
}
const COLOR_MAP: Record<string, string> = {
  red: "text-red-600", orange: "text-orange-500",
  green: "text-green-600", blue: "text-blue-600", purple: "text-purple-600",
};

// 笔记卡片左侧圆点颜色（按索引循环）
const DOT_COLORS = ["#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308"];

function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|@(?:TODO|FOLLOW|IDEA)\b|#[一-龥\w-]+|==.+?==|\{(?:red|orange|green|blue|purple)\}[\s\S]+?\{\/(?:red|orange|green|blue|purple)\})/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>;
    if (p.startsWith("@")) return <span key={i} className="inline-block px-1.5 py-0 bg-amber-100 text-amber-800 text-[11px] rounded mx-0.5 font-medium">{p}</span>;
    if (p.startsWith("#") && !p.startsWith("# ")) return <span key={i} className="inline-block px-1.5 py-0 bg-violet-100 text-violet-700 text-[11px] rounded mx-0.5">{p}</span>;
    if (p.startsWith("==") && p.endsWith("==")) return <mark key={i} className="bg-yellow-200 rounded px-0.5 not-italic">{p.slice(2, -2)}</mark>;
    const cm = p.match(/^\{(red|orange|green|blue|purple)\}([\s\S]+)\{\/(?:red|orange|green|blue|purple)\}$/);
    if (cm) return <span key={i} className={`font-medium ${COLOR_MAP[cm[1]]}`}>{cm[2]}</span>;
    return <span key={i}>{p}</span>;
  });
}

// ============ 主页面 ============
export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [taskTab, setTaskTab] = useState<"today" | "upcoming" | "review" | "collab">("today");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // AI
  const [pendingActions, setPendingActions] = useState<ActionCandidate[]>([]);
  const [showActionsPanel, setShowActionsPanel] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadCategories(), loadNotes(), loadTasks()]);
    setLoading(false);
  }
  async function loadCategories() {
    const r = await fetch("/api/note-categories");
    const j = await r.json();
    setCategories((j.categories || []) as Category[]);
  }
  async function loadNotes() {
    const r = await fetch("/api/notes?limit=500");
    const j = await r.json();
    setNotes((j.notes || []) as Note[]);
  }
  async function loadTasks() {
    const r = await fetch("/api/tasks/my-related");
    const j = await r.json();
    setTasks((j.tasks || []) as MyTask[]);
  }

  async function newNote(categoryId: string) {
    const r = await fetch("/api/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", category_id: categoryId }),
    });
    const j = await r.json();
    if (j.note) {
      setNotes((prev) => [...prev, j.note]);
      setEditingId(j.note.id);
      setNewlyCreatedId(j.note.id);
      setCollapsedCats((prev) => { const n = new Set(prev); n.delete(categoryId); return n; });
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
    if (newlyCreatedId === id) setNewlyCreatedId(null);
  }

  async function cancelEdit() {
    if (editingId && newlyCreatedId === editingId) {
      const id = editingId;
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setNewlyCreatedId(null);
    }
    setEditingId(null);
  }

  async function deleteNote(id: string) {
    if (!confirm("删除这篇笔记？")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingId === id) setEditingId(null);
    if (newlyCreatedId === id) setNewlyCreatedId(null);
  }

  // 拖拽排序：更新本地状态 + 异步保存 sort_order
  async function handleReorder(categoryId: string, newList: Note[]) {
    // 立即给每条笔记赋新的 sort_order，让 useMemo 排序用新值而不是旧的 null
    const updatedList = newList.map((note, index) => ({ ...note, sort_order: index }));
    setNotes((prev) => {
      const others = prev.filter((n) => (n.category_id || "__uncategorized__") !== categoryId);
      return [...others, ...updatedList];
    });
    // 异步批量保存，不阻塞 UI
    updatedList.forEach((note, index) => {
      fetch(`/api/notes/${note.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: index }),
      });
    });
  }

  async function detectActions(noteId: string) {
    const r = await fetch(`/api/notes/${noteId}/detect-actions`, { method: "POST" });
    const j = await r.json();
    if (Array.isArray(j.candidates) && j.candidates.length > 0) {
      setPendingActions(j.candidates);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 8000);
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
    } else alert("创建任务失败");
  }

  function toggleCollapse(catId: string) {
    setCollapsedCats((prev) => {
      const n = new Set(prev);
      if (n.has(catId)) n.delete(catId); else n.add(catId);
      return n;
    });
  }

  // 笔记按板块分组，组内按 sort_order → created_at 升序排列
  const notesByCategory = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) {
      const key = n.category_id || "__uncategorized__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    for (const [key, list] of map) {
      list.sort((a, b) => {
        const ao = a.sort_order, bo = b.sort_order;
        if (ao !== null && bo !== null) return ao - bo;
        if (ao !== null) return -1;
        if (bo !== null) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      map.set(key, list);
    }
    return map;
  }, [notes]);

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

  const Greeting = getGreeting().icon;
  const uncategorized = notesByCategory.get("__uncategorized__") || [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* 顶部 */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Greeting size={22} className="text-amber-500" />{getGreeting().label} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {formatDate(today)} · 今日 {taskGroups.today.length} 项待办 · 待我审 {taskGroups.review.length}
        </p>
      </div>

      <div className="max-w-4xl">
        {/* 笔记板块 */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="animate-spin mr-2" size={16} />加载中...
            </div>
          ) : (
            <>
              {categories.map((cat) => {
                const list = notesByCategory.get(cat.id) || [];
                const collapsed = collapsedCats.has(cat.id);
                return (
                  <CategorySection
                    key={cat.id} category={cat} notes={list}
                    collapsed={collapsed}
                    onToggleCollapse={() => toggleCollapse(cat.id)}
                    onAddNote={() => newNote(cat.id)}
                    onCategorySaved={loadCategories}
                    onReorder={(newList) => handleReorder(cat.id, newList)}
                    editingNoteId={editingId}
                    onStartEdit={(id) => setEditingId(id)}
                    onCancelEdit={cancelEdit}
                    onSaveNote={saveNote}
                    onDeleteNote={deleteNote}
                    onDetectActions={detectActions}
                  />
                );
              })}
              {/* 未分类区 */}
              {uncategorized.length > 0 && (
                <CategorySection
                  category={{ id: "__uncategorized__", label: "未分类", icon: "📂", sort_order: 9999 }}
                  notes={uncategorized}
                  collapsed={collapsedCats.has("__uncategorized__")}
                  onToggleCollapse={() => toggleCollapse("__uncategorized__")}
                  onAddNote={() => {}}
                  onReorder={(newList) => handleReorder("__uncategorized__", newList)}
                  hideAddNote
                  hideEditCategory
                  editingNoteId={editingId}
                  onStartEdit={(id) => setEditingId(id)}
                  onCancelEdit={cancelEdit}
                  onSaveNote={saveNote}
                  onDeleteNote={deleteNote}
                  onDetectActions={detectActions}
                />
              )}
              {/* 添加新板块 */}
              <button onClick={() => setShowAddCategory(true)}
                className="w-full py-2.5 text-sm border border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 transition-colors flex items-center justify-center gap-1.5">
                <Plus size={14} />添加新板块
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI Toast */}
      {showToast && pendingActions.length > 0 && (
        <button onClick={() => { setShowActionsPanel(true); setShowToast(false); }}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-xl shadow-lg hover:bg-violet-700">
          <Sparkles size={16} />
          <span className="text-sm">Qwen 检测到 {pendingActions.length} 个可能的待办</span>
          <span className="text-xs opacity-80">点击查看 →</span>
        </button>
      )}
      {showActionsPanel && (
        <ActionsPanel actions={pendingActions} onClose={() => setShowActionsPanel(false)}
          onCreate={createTaskFromAction}
          onDismiss={(c) => setPendingActions((prev) => prev.filter((x) => x !== c))} />
      )}

      {/* 板块编辑弹窗 */}
      {(showAddCategory || editingCategory) && (
        <CategoryFormModal
          category={editingCategory}
          onClose={() => { setShowAddCategory(false); setEditingCategory(null); }}
          onSaved={async () => { setShowAddCategory(false); setEditingCategory(null); await loadCategories(); }}
        />
      )}
    </div>
  );
}

// ============ 板块区 ============
function CategorySection({
  category, notes, collapsed, onToggleCollapse, onAddNote, onCategorySaved, hideAddNote, hideEditCategory,
  onReorder, editingNoteId, onStartEdit, onCancelEdit, onSaveNote, onDeleteNote, onDetectActions,
}: {
  category: Category; notes: Note[];
  collapsed: boolean; onToggleCollapse: () => void;
  onAddNote: () => void; onCategorySaved?: () => void;
  hideAddNote?: boolean; hideEditCategory?: boolean;
  onReorder: (newList: Note[]) => void;
  editingNoteId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveNote: (id: string, title: string, content: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onDetectActions: (id: string) => Promise<void>;
}) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(category.label);
  const [editIcon, setEditIcon] = useState(category.icon);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = notes.findIndex((n) => n.id === active.id);
    const newIndex = notes.findIndex((n) => n.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(arrayMove(notes, oldIndex, newIndex));
    }
  }

  async function saveLabel() {
    if (!editLabel.trim()) return;
    setSaving(true);
    await fetch(`/api/note-categories/${category.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel.trim(), icon: editIcon }),
    });
    setSaving(false);
    setIsEditingLabel(false);
    onCategorySaved?.();
  }

  async function deleteCategory() {
    if (!confirm(`删除「${category.label}」板块？板块下的笔记会移到「未分类」。`)) return;
    await fetch(`/api/note-categories/${category.id}`, { method: "DELETE" });
    onCategorySaved?.();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* 板块头 */}
      <div className="group px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/40">
        <button onClick={onToggleCollapse} className="p-0.5 text-gray-400 hover:text-gray-700">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        {isEditingLabel ? (
          /* 编辑模式 */
          <>
            <input value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 4))}
              className="w-8 text-base text-center border border-gray-200 rounded px-1 focus:outline-none focus:border-violet-400" />
            <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveLabel(); if (e.key === "Escape") setIsEditingLabel(false); }}
              autoFocus
              className="flex-1 text-sm font-bold border-b border-violet-400 focus:outline-none bg-transparent min-w-0" />
            <button onClick={saveLabel} disabled={saving}
              className="px-2 py-0.5 text-[11px] bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 shrink-0">
              {saving ? <Loader2 size={10} className="animate-spin inline" /> : "保存"}
            </button>
            <button onClick={() => setIsEditingLabel(false)}
              className="px-2 py-0.5 text-[11px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50 shrink-0">
              取消
            </button>
          </>
        ) : (
          /* 展示模式 */
          <>
            <span className="text-base">{category.icon}</span>
            <h2 className="font-bold text-gray-900 text-sm">{category.label}</h2>
            <span className="text-[11px] text-gray-400">{notes.length} 条</span>
            {!hideEditCategory && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditLabel(category.label); setEditIcon(category.icon); setIsEditingLabel(true); }}
                  className="p-1 rounded text-gray-400 hover:text-violet-700 hover:bg-violet-50" title="编辑板块名">
                  <Edit2 size={11} />
                </button>
                <button onClick={deleteCategory}
                  className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50" title="删除板块">
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </>
        )}

        <div className="flex-1" />
        {!hideAddNote && !isEditingLabel && (
          <button onClick={onAddNote}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-violet-600 text-white rounded-md hover:bg-violet-700 shrink-0">
            <Plus size={11} />添加笔记
          </button>
        )}
      </div>

      {/* 板块内容 */}
      {!collapsed && (
        <div className="p-3 space-y-2">
          {notes.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400">
              暂无笔记
              {!hideAddNote && (
                <button onClick={onAddNote} className="ml-2 text-violet-600 hover:underline">+ 添加</button>
              )}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                {notes.map((n, idx) => (
                  <SortableNoteCard key={n.id} note={n}
                    index={idx}
                    isEditing={editingNoteId === n.id}
                    onStartEdit={() => onStartEdit(n.id)}
                    onCancelEdit={onCancelEdit}
                    onSave={(title, content) => onSaveNote(n.id, title, content)}
                    onDelete={() => onDeleteNote(n.id)}
                    onDetect={() => onDetectActions(n.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}

// ============ 可拖拽笔记卡片包装 ============
function SortableNoteCard(props: React.ComponentProps<typeof NoteCard>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.note.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <NoteCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}



// ============ 笔记卡片 ============
function NoteCard({ note, index, isEditing, onStartEdit, onCancelEdit, onSave, onDelete, onDetect, dragHandleProps }: {
  note: Note;
  index?: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (title: string, content: string) => Promise<void>;
  onDelete: () => void;
  onDetect: () => Promise<void>;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content_md);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const dotColor = DOT_COLORS[(index ?? 0) % DOT_COLORS.length];

  useEffect(() => {
    if (isEditing) {
      setTitle(note.title);
      setContent(note.content_md);
      // 初始化富文本编辑器内容
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = syntaxToHtml(note.content_md);
          // 光标移到末尾
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
          editorRef.current.focus();
        }
      }, 0);
    }
  }, [isEditing, note.title, note.content_md]);

  function handleEditorInput() {
    if (editorRef.current) setContent(editorRef.current.innerHTML);
  }

  async function handleSave() {
    // 取最新 innerHTML 保存
    const html = editorRef.current?.innerHTML ?? content;
    setSaving(true); await onSave(title.slice(0, 80), html); setSaving(false);
  }
  async function handleDetect() {
    setDetecting(true); await onDetect(); setDetecting(false);
  }

  function applyColor(color: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    if (color === "highlight") {
      span.style.backgroundColor = "#fef08a";
      span.style.borderRadius = "2px";
      span.style.padding = "0 1px";
    } else {
      span.style.color = SYNTAX_COLOR_HEX[color] ?? "#000";
    }
    if (!range.collapsed) {
      try { range.surroundContents(span); }
      catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
    } else {
      span.textContent = color === "highlight" ? "高亮文字" : "彩色文字";
      range.insertNode(span);
      range.selectNodeContents(span);
      sel.removeAllRanges(); sel.addRange(range);
    }
    setContent(editor.innerHTML);
  }

  const COLORS = [
    { name: "red",    bg: "bg-red-500",    title: "红色" },
    { name: "orange", bg: "bg-orange-400", title: "橙色" },
    { name: "green",  bg: "bg-green-500",  title: "绿色" },
    { name: "blue",   bg: "bg-blue-500",   title: "蓝色" },
    { name: "purple", bg: "bg-purple-500", title: "紫色" },
    { name: "highlight", bg: "bg-yellow-300", title: "黄色高亮" },
  ];

  if (isEditing) {
    return (
      <div className="bg-violet-50/30 border-2 border-violet-300 rounded-lg p-3">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="笔记标题（可留空）"
          className="w-full text-sm font-bold border-b border-gray-200 focus:border-violet-400 focus:outline-none py-1 mb-2 bg-transparent" />

        {/* 颜色工具栏 */}
        <div className="flex items-center gap-1 mb-1.5 px-1">
          <span className="text-[10px] text-gray-400 mr-0.5">颜色标记：</span>
          {COLORS.map((c) => (
            <button key={c.name} onMouseDown={(e) => { e.preventDefault(); applyColor(c.name); }} title={c.title}
              className={`w-4 h-4 rounded-full ${c.bg} hover:scale-125 transition-transform border border-white shadow-sm`} />
          ))}
          <span className="text-[10px] text-gray-400 ml-1">选中文字后点颜色</span>
        </div>

        {/* 富文本编辑区 */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          data-placeholder="开始记录..."
          className="w-full min-h-[180px] px-2 py-1.5 border border-gray-200 rounded text-sm leading-relaxed bg-white focus:outline-none focus:border-violet-300 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300"
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        />
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">{content.replace(/<[^>]+>/g, "").length} 字</span>
          <div className="flex-1" />
          <button onClick={handleDetect} disabled={detecting || !content.trim()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-violet-200 text-violet-700 rounded hover:bg-violet-50 disabled:opacity-50">
            {detecting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            AI 检测待办
          </button>
          <button onClick={onCancelEdit} disabled={saving}
            className="px-2 py-1 text-[10px] border border-gray-200 rounded text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
            {saving ? "保存中" : "保存"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-violet-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* 拖拽手柄 */}
          <span {...dragHandleProps}
            className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity touch-none">
            <GripVertical size={13} />
          </span>
          {note.title && note.title !== "新笔记" && note.title !== "速记" && (
            <>
              <FileText size={11} className="text-violet-500 shrink-0" />
              <h3 className="font-bold text-gray-900 text-sm truncate">{note.title}</h3>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-400 whitespace-nowrap">
            {new Date(note.updated_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onStartEdit}
              className="p-0.5 rounded text-gray-400 hover:text-violet-700 hover:bg-violet-50" title="编辑">
              <Edit2 size={10} />
            </button>
            <button onClick={onDelete}
              className="p-0.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50" title="删除">
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      </div>
      {/* 圆点紧贴文字正前方 */}
      <div className="flex items-start gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0 mt-[5px]" style={{ backgroundColor: dotColor }} />
        <div className="prose prose-sm max-w-none text-gray-700 flex-1 min-w-0">
          {renderMd(note.content_md)}
        </div>
      </div>
    </div>
  );
}

// ============ 板块编辑/新增弹窗 ============
function CategoryFormModal({ category, onClose, onSaved }: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [label, setLabel] = useState(category?.label || "");
  const [icon, setIcon] = useState(category?.icon || "📝");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const presetIcons = ["📦", "👥", "📝", "🏪", "🎧", "💼", "📊", "✨", "🚀", "💡", "🎯", "📌", "🔥", "⚡", "📞"];

  async function save() {
    if (!label.trim()) { setError("板块名不能为空"); return; }
    setBusy(true); setError("");
    const url = category ? `/api/note-categories/${category.id}` : "/api/note-categories";
    const r = await fetch(url, {
      method: category ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), icon }),
    });
    setBusy(false);
    if (!r.ok) { const j = await r.json(); setError(j.error || "保存失败"); return; }
    await onSaved();
  }

  async function remove() {
    if (!category) return;
    if (!confirm(`删除「${category.label}」板块？板块下的笔记会移到「未分类」。`)) return;
    setBusy(true);
    const r = await fetch(`/api/note-categories/${category.id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) { alert("删除失败"); return; }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{category ? "编辑板块" : "添加板块"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        {error && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">板块名</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="例：电商运营 / 周会纪要 / 学习笔记..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">图标</label>
            <div className="flex items-center gap-2 mb-2">
              <input value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-base text-center focus:outline-none focus:border-violet-400" />
              <span className="text-xs text-gray-500">可输入任意 emoji 或字符</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {presetIcons.map((ic) => (
                <button key={ic} onClick={() => setIcon(ic)}
                  className={"w-8 h-8 text-base rounded border " +
                    (icon === ic ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-gray-300")}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-5">
          {category ? (
            <button onClick={remove} disabled={busy}
              className="text-xs text-rose-600 hover:underline">
              删除板块
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
              取消
            </button>
            <button onClick={save} disabled={busy}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存
            </button>
          </div>
        </div>
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
  async function toggleDone(t: MyTask) {
    const newStatus = t.status === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", t.id);
    await onChange();
  }

  const list = taskGroups[tab];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col self-start sticky top-4">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <ListChecks size={16} className="text-blue-600" />
        <h2 className="font-semibold text-gray-900">我的任务</h2>
        <span className="text-xs text-gray-400">共 {tasks.length}</span>
        <div className="flex-1" />
        <Link href="/dashboard/tasks" className="text-xs text-violet-600 hover:underline">全部 →</Link>
      </div>

      <div className="px-3 py-2 flex gap-1 border-b border-gray-100 overflow-x-auto">
        {[
          { v: "today" as const,    label: "今日",   count: taskGroups.today.length },
          { v: "upcoming" as const, label: "即将",   count: taskGroups.upcoming.length },
          { v: "review" as const,   label: "待审",   count: taskGroups.review.length },
          { v: "collab" as const,   label: "协作",   count: taskGroups.collab.length },
        ].map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={"shrink-0 px-2.5 py-1 text-xs rounded-md " +
              (tab === t.v ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50")}>
            {t.label} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 max-h-[60vh] rounded-b-2xl">
        {list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8">
            {tab === "today" ? "🎉 今日无待办" : tab === "upcoming" ? "未来 7 天无待办" : tab === "review" ? "暂无待审" : "暂无协作"}
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: MyTask; onToggle: () => Promise<void> }) {
  const isDone = task.status === "done";
  const isOverdue = task.due_at && !isDone && task.due_at.slice(0, 10) < todayStr();
  const priorityColors: Record<string, string> = {
    high: "bg-rose-100 text-rose-700", medium: "bg-amber-100 text-amber-700", low: "bg-gray-100 text-gray-600",
  };
  return (
    <div className="px-2 py-2 rounded-lg hover:bg-gray-50 flex items-start gap-2">
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
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
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
                {c.suggested_due && <span className="text-[11px] text-blue-600">📅 {c.suggested_due}</span>}
                <div className="flex-1" />
                <button onClick={() => onDismiss(c)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600">忽略</button>
                <button onClick={() => onCreate(c)}
                  className="px-3 py-1 text-xs bg-violet-600 text-white rounded-md hover:bg-violet-700">+ 创建任务</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
