"use client";

// 工作台首页 — 个人工作笔记（按板块分组）+ 我相关任务

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, FileText, Loader2, X, Trash2, CheckCircle2, Sparkles, ListChecks,
  Edit2, Save, Sun, Moon, ChevronDown, ChevronRight, Settings2, GripVertical,
  Wand2, ExternalLink, Bell,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
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
  linked_task_ids?: string[];
  push_enabled?: boolean;
  push_frequency?: "daily" | "weekly";
  push_hour?: number;
  push_minute?: number;
  push_weekday?: number | null;
  push_summary?: string;
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
  red: "#dc2626", orange: "#f97316", green: "#16a34a", blue: "#2563eb", purple: "#9333ea", black: "#374151",
};
// 浏览器 style.color 标准化后的 rgb() 格式 → 颜色名（保留旧 rgb 以兼容历史笔记）
const COLOR_RGB_MAP: Record<string, string> = {
  "rgb(220, 38, 38)": "red", "rgb(249, 115, 22)": "orange", "rgb(22, 163, 74)": "green",
  "rgb(37, 99, 235)": "blue", "rgb(147, 51, 234)": "purple",
  "rgb(55, 65, 81)": "black", "rgb(31, 41, 55)": "black", "rgb(17, 24, 39)": "black",
  "red": "red", "orange": "orange", "green": "green", "blue": "blue", "purple": "purple", "black": "black",
};
// 保存前：DOM 解析 HTML → 干净的 {color} 语法。同时清理破损数据
function htmlToSyntax(html: string): string {
  if (typeof document === "undefined") return html;
  const root = document.createElement("div");
  root.innerHTML = html;

  // 扁平化嵌套的颜色/高亮 span：保留最内层颜色，剥掉外层冗余包裹
  const flattenColorSpans = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    Array.from(el.childNodes).forEach(flattenColorSpans);
    if (el.tagName === "SPAN" && (el.style.color || el.style.backgroundColor)) {
      // 如果子孙里有同类颜色 span，外层这个就是冗余的，剥掉
      const innerColored = el.querySelector('span[style*="color"], span[style*="background-color"]');
      if (innerColored) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    }
  };
  Array.from(root.childNodes).forEach(flattenColorSpans);

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(walk).join("");

    if (tag === "br") return "\n";
    if (tag === "div" || tag === "p") return inner + "\n";

    if (tag === "span") {
      // span 内换行不要保留（避免破损 span 把彩色文字拆散）
      const cleanInner = inner.replace(/\n/g, "");
      const bg = el.style.backgroundColor;
      const fg = el.style.color;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return `==${cleanInner}==`;
      if (fg) {
        const name = COLOR_RGB_MAP[fg.trim()];
        if (name) return `{${name}}${cleanInner}{/${name}}`;
      }
      return inner;
    }
    return inner;
  }

  const raw = Array.from(root.childNodes).map(walk).join("");

  // 清理破损数据 step 1：检测"≥5 行连续短行（每行 ≤3 字符）"的破损段落，合并成一行
  const lines = raw.split("\n");
  const merged: string[] = [];
  let i = 0;
  while (i < lines.length) {
    // 向前扫描连续短行
    let runEnd = i;
    while (runEnd < lines.length) {
      const t = lines[runEnd].trim();
      if (t.length > 0 && t.length <= 3) runEnd++;
      else break;
    }
    if (runEnd - i >= 5) {
      // 5 行以上连续短行 → 视为破损数据合并
      merged.push(lines.slice(i, runEnd).join(""));
      i = runEnd;
    } else {
      merged.push(lines[i]);
      i++;
    }
  }

  // 清理破损数据 step 2：按"去掉颜色语法后的纯文本"去重，跨过空行
  const stripSyntax = (s: string) => s
    .replace(/\{(red|orange|green|blue|purple|black)\}([\s\S]+?)\{\/(?:red|orange|green|blue|purple|black)\}/g, "$2")
    .replace(/==([\s\S]+?)==/g, "$1")
    .trim();

  // 收集所有非空行的纯文本，全局去重（不限相邻）
  const seenTexts = new Set<string>();
  const deduped: string[] = [];
  for (let k = 0; k < merged.length; k++) {
    const cur = stripSyntax(merged[k]);
    if (cur && seenTexts.has(cur)) continue;
    // 也检查是否是已存在文本的子串（处理部分截断的破损数据）
    let isSubstring = false;
    if (cur && cur.length >= 2) {
      for (const seen of seenTexts) {
        if (seen.includes(cur) || cur.includes(seen)) {
          // 短的被包含在长的里，丢弃短的；否则丢弃当前
          if (seen.length >= cur.length) { isSubstring = true; break; }
        }
      }
    }
    if (isSubstring) continue;
    deduped.push(merged[k]);
    if (cur) seenTexts.add(cur);
  }

  // 最后保险：如果还残留 ≥3 个短行（≤3 字符）说明清理不彻底，全部移除
  let finalLines = deduped;
  const shortCount = finalLines.filter((l) => {
    const t = stripSyntax(l);
    return t.length > 0 && t.length <= 3;
  }).length;
  if (shortCount >= 3) {
    finalLines = finalLines.filter((l) => {
      const t = stripSyntax(l);
      return t.length === 0 || t.length > 3;
    });
  }

  return finalLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function syntaxToHtml(text: string): string {
  // 如果已经是 HTML，直接返回（避免重复处理）
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  // 用栈解析颜色/高亮，正确处理嵌套和孤立标记。最内层颜色生效，无效闭合标记被丢弃。
  const segments = parseColorSegments(text);
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return segments.map((seg) => {
    let html = escape(seg.text).replace(/\n/g, "<br>");
    if (seg.color) {
      const weight = seg.color === "black" ? "400" : "600";
      html = `<span style="color:${SYNTAX_COLOR_HEX[seg.color]};font-weight:${weight}">${html}</span>`;
    }
    if (seg.highlight) html = `<span style="background-color:#fef08a;border-radius:2px;padding:0 1px">${html}</span>`;
    return html;
  }).join("");
}

// 简易 Markdown 渲染
function renderMd(md: string): React.ReactNode {
  if (!md.trim()) return <span className="text-gray-300 italic text-xs">空内容</span>;
  // 富文本内容（包含 HTML 标签）直接渲染
  if (/<[a-z][\s\S]*>/i.test(md)) {
    return <div dangerouslySetInnerHTML={{ __html: md }} className="text-sm leading-relaxed break-words [overflow-wrap:anywhere]" />;
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
  green: "text-green-600", blue: "text-blue-600", purple: "text-purple-600", black: "text-gray-700",
};

// 笔记卡片左侧圆点颜色（按索引循环）
const DOT_COLORS = ["#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308"];

// 用栈解析颜色/高亮标记，正确处理嵌套（{red}{blue}文字{/blue}{/red}）和孤立的标记
function parseColorSegments(s: string): Array<{ text: string; color: string | null; highlight: boolean }> {
  const out: Array<{ text: string; color: string | null; highlight: boolean }> = [];
  const colorStack: string[] = [];
  let highlight = false;
  const re = /\{(red|orange|green|blue|purple|black)\}|\{\/(red|orange|green|blue|purple|black)\}|==/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) {
      out.push({
        text: s.slice(last, m.index),
        color: colorStack.length > 0 ? colorStack[colorStack.length - 1] : null,
        highlight,
      });
    }
    if (m[1]) colorStack.push(m[1]);
    else if (m[2]) {
      const idx = colorStack.lastIndexOf(m[2]);
      if (idx >= 0) colorStack.splice(idx, 1);
    } else highlight = !highlight;
    last = m.index + m[0].length;
  }
  if (last < s.length) {
    out.push({
      text: s.slice(last),
      color: colorStack.length > 0 ? colorStack[colorStack.length - 1] : null,
      highlight,
    });
  }
  return out;
}

function renderInline(s: string): React.ReactNode {
  const segments = parseColorSegments(s);
  return segments.map((seg, i) => {
    if (!seg.text) return null;
    // 在彩色段内继续处理 **bold** / @TODO / #tag
    const parts = seg.text.split(/(\*\*[^*]+\*\*|@(?:TODO|FOLLOW|IDEA)\b|#[一-龥\w-]+)/g);
    const inner: React.ReactNode = parts.map((p, j) => {
      const k = `${i}-${j}`;
      if (!p) return null;
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={k} className={seg.color ? "font-semibold" : "font-semibold text-gray-900"}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("@")) return <span key={k} className="inline-block px-1.5 py-0 bg-amber-100 text-amber-800 text-[11px] rounded mx-0.5 font-medium">{p}</span>;
      if (p.startsWith("#") && !p.startsWith("# ")) return <span key={k} className="inline-block px-1.5 py-0 bg-violet-100 text-violet-700 text-[11px] rounded mx-0.5">{p}</span>;
      return <span key={k}>{p}</span>;
    });
    let node: React.ReactNode = inner;
    if (seg.color) {
      const weightCls = seg.color === "black" ? "font-normal" : "font-semibold";
      node = <span key={`c${i}`} className={`${weightCls} ${COLOR_MAP[seg.color]}`}>{node}</span>;
    }
    if (seg.highlight) node = <mark key={`h${i}`} className="bg-yellow-200 rounded px-0.5 not-italic">{node}</mark>;
    return node;
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

  // 关联任务的标题映射：taskId → title（删除的任务从这里消失，徽章数量自动更新）
  const [linkedTaskMap, setLinkedTaskMap] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    // 先从缓存显示（秒开）
    try {
      const cached = localStorage.getItem("home_cache");
      if (cached) {
        const { categories, notes, tasks, linkedTaskMap: ltm } = JSON.parse(cached);
        if (categories) setCategories(categories);
        if (notes) setNotes(notes);
        if (tasks) setTasks(tasks);
        if (ltm) setLinkedTaskMap(ltm);
        setLoading(false); // 有缓存就立刻不转圈
      }
    } catch {}
    // 后台刷新真实数据
    setLoading((prev) => prev); // 保持 loading 只在无缓存时显示
    const [cats, notesResult, taskList] = await Promise.all([loadCategories(), loadNotes(), loadTasks()]);
    // 保存缓存
    try {
      localStorage.setItem("home_cache", JSON.stringify({
        categories: cats,
        notes: notesResult?.list || [],
        tasks: taskList || [],
        linkedTaskMap: notesResult?.ltm || {},
      }));
    } catch {}
    setLoading(false);
  }
  async function loadCategories() {
    const r = await fetch("/api/note-categories");
    const j = await r.json();
    const cats = (j.categories || []) as Category[];
    setCategories(cats);
    return cats;
  }
  async function loadNotes() {
    const r = await fetch("/api/notes?limit=500");
    const j = await r.json();
    const list = (j.notes || []) as Note[];
    setNotes(list);
    // 顺带把所有关联任务的标题加载进来，用于"已转任务"徽章和点击跳转
    const allLinkedIds = Array.from(
      new Set(list.flatMap((n) => n.linked_task_ids || [])),
    );
    let ltm: Record<string, string> = {};
    if (allLinkedIds.length > 0) {
      const { data } = await supabase
        .from("tasks")
        .select("id, title")
        .in("id", allLinkedIds);
      (data || []).forEach((t: { id: string; title: string }) => {
        ltm[t.id] = t.title;
      });
      setLinkedTaskMap(ltm);
    } else {
      setLinkedTaskMap({});
    }
    return { list, ltm };
  }
  async function loadTasks() {
    const r = await fetch("/api/tasks/my-related");
    const j = await r.json();
    const taskList = (j.tasks || []) as MyTask[];
    setTasks(taskList);
    return taskList;
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

  // 点击 → 用笔记内容预填新建任务表单：标题=前 25 字，描述=正文全文（清掉颜色语法），验收为空
  function handleGenerateTask(noteId: string) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const plain = (note.content_md || "")
      .replace(/\{(red|orange|green|blue|purple|black)\}([\s\S]+?)\{\/(?:red|orange|green|blue|purple|black)\}/g, "$2")
      .replace(/==([\s\S]+?)==/g, "$1")
      .replace(/<[^>]+>/g, "")
      .trim();
    const prefill = {
      title: plain.slice(0, 25),
      description: plain,
      acceptance_criteria: "",
    };
    sessionStorage.setItem("home_task_prefill", JSON.stringify(prefill));
    sessionStorage.setItem("home_task_prefill_note_id", noteId);
    router.push("/dashboard/tasks?from_note=1");
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
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* 顶部 */}
      <div className="mb-6">
        <p className="text-sm text-gray-400">{formatDate(today)}</p>
      </div>

      {/* 笔记板块 — 两列网格 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={16} />加载中...
        </div>
      ) : (
        <>
          <div className="columns-1 xl:columns-2 gap-4">
            {categories.map((cat) => {
              const list = notesByCategory.get(cat.id) || [];
              const collapsed = collapsedCats.has(cat.id);
              return (
                <div key={cat.id} className="break-inside-avoid mb-4">
                  <CategorySection
                    category={cat} notes={list}
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
                    onGenerateTask={handleGenerateTask}
                    linkedTaskMap={linkedTaskMap}
                  />
                </div>
              );
            })}
            {/* 未分类区 */}
            {uncategorized.length > 0 && (
              <div className="break-inside-avoid mb-4">
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
                  onGenerateTask={handleGenerateTask}
                  linkedTaskMap={linkedTaskMap}
                />
              </div>
            )}
          </div>

          {/* 添加新板块 */}
          <button onClick={() => setShowAddCategory(true)}
            className="mt-4 w-full py-2.5 text-sm border border-dashed border-gray-300 text-gray-400 rounded-xl hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/40 transition-colors flex items-center justify-center gap-1.5">
            <Plus size={14} />添加新板块
          </button>
        </>
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
  onReorder, editingNoteId, onStartEdit, onCancelEdit, onSaveNote, onDeleteNote, onGenerateTask, linkedTaskMap,
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
  onGenerateTask: (id: string) => void;
  linkedTaskMap: Record<string, string>;
}) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(category.label);
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
      body: JSON.stringify({ label: editLabel.trim() }),
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
            <h2 className="font-bold text-gray-900 text-sm">{category.label}</h2>
            <span className="text-[11px] text-gray-400">{notes.length} 条</span>
            {!hideEditCategory && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditLabel(category.label); setIsEditingLabel(true); }}
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
                    onGenerateTask={() => onGenerateTask(n.id)}
                    linkedTaskMap={linkedTaskMap}
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
function NoteCard({ note, index, isEditing, onStartEdit, onCancelEdit, onSave, onDelete, onGenerateTask, linkedTaskMap, dragHandleProps }: {
  note: Note;
  index?: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (title: string, content: string) => Promise<void>;
  onDelete: () => void;
  onGenerateTask: () => void;
  linkedTaskMap: Record<string, string>;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content_md);
  const [saving, setSaving] = useState(false);
  const [showLinkedTasks, setShowLinkedTasks] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(!!note.push_enabled);
  const [pushPopoverOpen, setPushPopoverOpen] = useState(false);
  // 上层 props 的 push_enabled 变了（如刷新后），同步到本地 state
  useEffect(() => { setPushEnabled(!!note.push_enabled); }, [note.push_enabled]);
  const editorRef = useRef<HTMLDivElement>(null);
  const dotColor = DOT_COLORS[(index ?? 0) % DOT_COLORS.length];

  // 点击铃铛 → 打开推送设置弹层（不再单纯 toggle）
  function onBellClick() {
    setPushPopoverOpen((v) => !v);
  }
  // 弹层里更新设置回调
  function onPushUpdated(next: {
    push_enabled: boolean;
    push_frequency: "daily" | "weekly";
    push_hour: number;
    push_minute: number;
    push_weekday: number | null;
    push_summary: string;
  }) {
    setPushEnabled(next.push_enabled);
    note.push_enabled = next.push_enabled;
    note.push_frequency = next.push_frequency;
    note.push_hour = next.push_hour;
    note.push_minute = next.push_minute;
    note.push_weekday = next.push_weekday;
    note.push_summary = next.push_summary;
  }
  // 标记编辑器是否已初始化，防止 note 数据变化导致编辑中的内容被覆盖
  const editorInitialized = useRef(false);

  useEffect(() => {
    if (isEditing && !editorInitialized.current) {
      editorInitialized.current = true;
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
    if (!isEditing) {
      editorInitialized.current = false;
    }
  }, [isEditing, note.title, note.content_md]);

  function handleEditorInput() {
    if (editorRef.current) setContent(editorRef.current.innerHTML);
  }

  async function handleSave() {
    // 取 innerHTML → 转回 {color} 语法再保存，防止 HTML 碎片累积
    const rawHtml = editorRef.current?.innerHTML ?? content;
    const clean = htmlToSyntax(rawHtml);
    setSaving(true); await onSave(title.slice(0, 80), clean); setSaving(false);
  }

  function applyColor(color: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const makeSpan = () => {
      const span = document.createElement("span");
      if (color === "highlight") {
        span.style.backgroundColor = "#fef08a";
        span.style.borderRadius = "2px";
        span.style.padding = "0 1px";
      } else {
        span.style.color = SYNTAX_COLOR_HEX[color] ?? "#000";
      }
      return span;
    };
    if (!range.collapsed) {
      // 抽出选区内容，先剥掉已有的颜色/高亮 span，再用新颜色包一次，避免嵌套累积
      const fragment = range.extractContents();
      const unwrap = (node: Node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        Array.from(el.childNodes).forEach(unwrap);
        if (el.tagName === "SPAN" && (el.style.color || el.style.backgroundColor)) {
          const parent = el.parentNode;
          if (!parent) return;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
      };
      Array.from(fragment.childNodes).forEach(unwrap);
      const span = makeSpan();
      span.appendChild(fragment);
      range.insertNode(span);
      range.selectNodeContents(span);
      sel.removeAllRanges(); sel.addRange(range);
    } else {
      const span = makeSpan();
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
    { name: "black",  bg: "bg-gray-800",   title: "深灰" },
  ];

  if (isEditing) {
    return (
      // key="edit" / key="view" 防止 React 把 contentEditable div 复用为静态视图，遗留用户输入的文本节点
      <div key="edit" className="bg-violet-50/30 border-2 border-violet-300 rounded-lg p-3">
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
          <div className="relative">
            <button
              onClick={onBellClick}
              type="button"
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition",
                pushEnabled
                  ? "border-violet-400 bg-violet-100 text-violet-700"
                  : "border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600",
              )}
              title="推送设置"
            >
              <Bell size={10} fill={pushEnabled ? "currentColor" : "none"} />
              {pushEnabled ? "已加入推送" : "推送设置"}
            </button>
            {pushPopoverOpen && (
              <NotePushPopover
                note={note}
                onClose={() => setPushPopoverOpen(false)}
                onUpdated={onPushUpdated}
              />
            )}
          </div>
          <div className="flex-1" />
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

  // 关联任务：过滤掉已被删除的（linkedTaskMap 里没有 = 已删）
  const linkedTasks = (note.linked_task_ids || [])
    .filter((tid) => linkedTaskMap[tid])
    .map((tid) => ({ id: tid, title: linkedTaskMap[tid] }));

  return (
    // 单行布局：[拖拽柄][圆点][标题?+正文][时间+AI转任务+编辑+删除]，去掉空白标题栏
    <div key="view" className="group bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-violet-300 hover:shadow-sm transition-all overflow-hidden">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-start gap-1.5">
        {/* 序号（拖拽排序后自动更新） */}
        <span
          className="text-sm font-bold tabular-nums leading-snug whitespace-nowrap"
          style={{ color: dotColor }}
        >
          {(index ?? 0) + 1}.
        </span>
        {/* 标题（可选）+ 正文 */}
        <div className="text-gray-700 break-words [overflow-wrap:anywhere] min-w-0">
          {note.title && note.title !== "新笔记" && note.title !== "速记" && (
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1 mb-0.5">
              <FileText size={11} className="text-violet-500 shrink-0" />
              <span className="truncate">{note.title}</span>
            </h3>
          )}
          {renderMd(note.content_md)}
          {/* 已转任务徽章 */}
          {linkedTasks.length > 0 && (
            <div className="mt-1 inline-block">
              <button
                onClick={() => setShowLinkedTasks(true)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full hover:bg-emerald-100 transition"
                title="点击查看关联任务"
              >
                <CheckCircle2 size={10} />
                已转任务 {linkedTasks.length}
              </button>
              {showLinkedTasks && (
                <div
                  className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
                  onClick={() => setShowLinkedTasks(false)}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white border border-gray-200 rounded-xl shadow-2xl w-[340px] max-h-[70vh] overflow-y-auto"
                  >
                    <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        关联任务 ({linkedTasks.length})
                      </h3>
                      <button onClick={() => setShowLinkedTasks(false)} className="text-gray-400 hover:text-gray-700">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="py-1">
                      {linkedTasks.map((t) => (
                        <Link
                          key={t.id}
                          href={`/dashboard/tasks?taskId=${t.id}`}
                          className="flex items-start gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 border-b border-gray-50 last:border-b-0"
                          onClick={() => setShowLinkedTasks(false)}
                        >
                          <ExternalLink size={12} className="mt-1 shrink-0 text-gray-400" />
                          <span className="flex-1 break-words">{t.title}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* 推送铃铛（已开启时常驻，未开启时 hover 显示） */}
        <div className="relative shrink-0 mt-[3px]">
          <button
            onClick={onBellClick}
            className={cn(
              "p-0.5 rounded transition-all",
              pushEnabled
                ? "text-violet-600 opacity-100 hover:bg-violet-50"
                : "text-gray-300 opacity-0 group-hover:opacity-100 hover:text-violet-600 hover:bg-violet-50",
            )}
            title="推送设置"
          >
            <Bell size={11} fill={pushEnabled ? "currentColor" : "none"} />
          </button>
          {pushPopoverOpen && (
            <NotePushPopover
              note={note}
              onClose={() => setPushPopoverOpen(false)}
              onUpdated={onPushUpdated}
            />
          )}
        </div>

        {/* AI 转任务 / 编辑 / 删除（hover 才显示） */}
        <div className="flex items-center gap-0.5 shrink-0 mt-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onGenerateTask}
            className="p-0.5 rounded text-gray-400 hover:text-violet-700 hover:bg-violet-50" title="转任务">
            <Wand2 size={10} />
          </button>
          <button onClick={onStartEdit}
            className="p-0.5 rounded text-gray-400 hover:text-violet-700 hover:bg-violet-50" title="编辑">
            <Edit2 size={10} />
          </button>
          <button onClick={onDelete}
            className="p-0.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50" title="删除">
            <Trash2 size={10} />
          </button>
        </div>
        {/* 拖拽手柄 — 移到最末，hover 才显示 */}
        <span {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity touch-none mt-[3px]">
          <GripVertical size={12} />
        </span>
      </div>
    </div>
  );
}

// ============ 笔记推送设置弹层 ============
function NotePushPopover({ note, onClose, onUpdated }: {
  note: Note;
  onClose: () => void;
  onUpdated: (next: {
    push_enabled: boolean;
    push_frequency: "daily" | "weekly";
    push_hour: number;
    push_minute: number;
    push_weekday: number | null;
    push_summary: string;
  }) => void;
}) {
  const wasEnabled = !!note.push_enabled;
  const [frequency, setFrequency] = useState<"daily" | "weekly">(note.push_frequency ?? "daily");
  const [hour, setHour] = useState<number>(note.push_hour ?? 9);
  const [minute, setMinute] = useState<number>(
    [0, 10, 20, 30, 40, 50].includes(note.push_minute ?? 0) ? (note.push_minute ?? 0) : 0
  );
  const [weekday, setWeekday] = useState<number>(note.push_weekday ?? 1);
  const [summary, setSummary] = useState<string>(note.push_summary ?? "");
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 点外部关闭
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  async function patch(payload: {
    push_enabled: boolean;
    push_frequency: "daily" | "weekly";
    push_hour: number;
    push_minute: number;
    push_weekday: number | null;
    push_summary: string;
  }) {
    setSaving(true);
    try {
      const r = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("save failed");
      onUpdated(payload);
      onClose();
    } catch {
      // 静默
    } finally {
      setSaving(false);
    }
  }

  // 保存 = 启用 + 写入设置
  async function save() {
    await patch({
      push_enabled: true,
      push_frequency: frequency,
      push_hour: hour,
      push_minute: minute,
      push_weekday: frequency === "weekly" ? weekday : null,
      push_summary: summary.trim(),
    });
  }

  // 停用 = enabled 设为 false（保留 frequency/time/summary 配置，方便以后再启用）
  async function disable() {
    await patch({
      push_enabled: false,
      push_frequency: frequency,
      push_hour: hour,
      push_minute: minute,
      push_weekday: frequency === "weekly" ? weekday : null,
      push_summary: summary.trim(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={wrapperRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-gray-200 rounded-xl shadow-2xl w-[340px] p-4 text-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 inline-flex items-center gap-1.5">
            <Bell size={14} className="text-violet-600" /> 推送设置
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={14} />
          </button>
        </div>

        <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
          本条笔记的推送时间和内容。token 在 系统设置 → 消息推送 一次性配置。
        </p>

        {/* 推送摘要 */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-gray-500">推送内容</span>
            <span className="text-[10px] text-gray-400">{summary.length} 字 · 留空则推送笔记完整内容</span>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="自定义推送到微信的文字。留空就推完整笔记。"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none focus:outline-none focus:border-violet-400"
          />
        </div>

        {/* 频率 */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">频率</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setFrequency("daily")}
              className={cn(
                "px-3 py-1 rounded-md border text-xs",
                frequency === "daily" ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}>每天</button>
            <button type="button" onClick={() => setFrequency("weekly")}
              className={cn(
                "px-3 py-1 rounded-md border text-xs",
                frequency === "weekly" ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}>每周</button>
          </div>
        </div>

        {/* 周几 */}
        {frequency === "weekly" && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">星期几</div>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm">
              <option value={1}>周一</option>
              <option value={2}>周二</option>
              <option value={3}>周三</option>
              <option value={4}>周四</option>
              <option value={5}>周五</option>
              <option value={6}>周六</option>
              <option value={7}>周日</option>
            </select>
          </div>
        )}

        {/* 时间 */}
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-1">推送时间 <span className="text-gray-400">（北京时间）</span></div>
          <div className="flex items-center gap-2 tabular-nums">
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm">
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")} 时</option>
              ))}
            </select>
            <span className="text-gray-400">:</span>
            <select value={minute} onChange={(e) => setMinute(Number(e.target.value))}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm">
              <option value={0}>00 分</option>
              <option value={10}>10 分</option>
              <option value={20}>20 分</option>
              <option value={30}>30 分</option>
              <option value={40}>40 分</option>
              <option value={50}>50 分</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          {wasEnabled ? (
            <button onClick={disable} disabled={saving}
              className="text-xs text-rose-600 hover:underline disabled:opacity-50">
              停用本笔记推送
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">取消</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-violet-600 text-white text-sm hover:bg-violet-500 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {wasEnabled ? "更新设置" : "启用推送"}
            </button>
          </div>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!label.trim()) { setError("板块名不能为空"); return; }
    setBusy(true); setError("");
    const url = category ? `/api/note-categories/${category.id}` : "/api/note-categories";
    const r = await fetch(url, {
      method: category ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
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

