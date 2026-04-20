/*
 * ============================================================
 * SQL — 请在 Supabase SQL 编辑器中运行以下语句（仅需运行一次）：
 * ============================================================
 *
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'normal';
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual';
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_criteria text;
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT 0;
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason text;
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewer_id uuid;
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id uuid;
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_at timestamptz;
 *
 * CREATE TABLE IF NOT EXISTS task_participants (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
 *   user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
 *   role text DEFAULT 'assistant',
 *   created_at timestamptz DEFAULT now(),
 *   UNIQUE(task_id, user_id)
 * );
 *
 * ============================================================
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckSquare,
  Plus,
  Loader2,
  X,
  ChevronDown,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  ListTodo,
  TrendingUp,
  Filter,
  FileText,
  Sparkles,
  Pencil,
  Trash2,
  CheckCheck,
  Search,
  PauseCircle,
  Ban,
  ChevronRight,
  User,
  Tag,
  BarChart2,
  Info,
} from "lucide-react";
import { supabase, priorityLabels } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  module: string | null;
  // legacy field – keep for backwards-compat
  assigned_to: string | null;
  // new fields – all optional so existing DB rows still work
  owner_id?: string | null;
  reviewer_id?: string | null;
  task_type?: string | null;
  source_type?: string | null;
  acceptance_criteria?: string | null;
  progress_percent?: number | null;
  blocked_reason?: string | null;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  due_at?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  creator_id?: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface ParsedTask {
  title: string;
  description: string | null;
  assigned_to_name: string | null;
  assigned_to_id: string | null;
  priority: string;
  module: string;
  module_label: string;
  due_date: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const moduleOptions = [
  { value: "ecommerce", label: "电商销售" },
  { value: "kol", label: "达人营销" },
  { value: "content", label: "内容运营" },
  { value: "channel", label: "渠道分销" },
  { value: "service", label: "客服中心" },
  { value: "review", label: "智能复盘" },
  { value: "other", label: "其他" },
];

const moduleLabels: Record<string, string> = Object.fromEntries(
  moduleOptions.map((m) => [m.value, m.label])
);

const taskTypeOptions = [
  { value: "normal", label: "普通任务" },
  { value: "assigned", label: "指派任务" },
  { value: "collaborative", label: "协作任务" },
  { value: "approval", label: "审批任务" },
  { value: "review_fix", label: "复盘整改" },
];

const taskTypeLabels: Record<string, string> = Object.fromEntries(
  taskTypeOptions.map((t) => [t.value, t.label])
);

const sourceTypeOptions = [
  { value: "manual", label: "手工创建" },
  { value: "meeting", label: "会议纪要" },
  { value: "ai", label: "AI建议" },
  { value: "review", label: "复盘转任务" },
  { value: "auto", label: "模块联动" },
];

const sourceTypeLabels: Record<string, string> = Object.fromEntries(
  sourceTypeOptions.map((s) => [s.value, s.label])
);

// New extended status set
const NEW_STATUS_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "todo", label: "待开始" },
  { value: "doing", label: "进行中" },
  { value: "pending_review", label: "待审核" },
  { value: "done", label: "已完成" },
  { value: "overdue", label: "已逾期" },
  { value: "blocked", label: "已阻塞" },
  { value: "cancelled", label: "已取消" },
  // legacy values from old DB — keep so existing data displays correctly
  { value: "pending", label: "待开始" },
  { value: "in_progress", label: "进行中" },
  { value: "review", label: "待审核" },
  { value: "completed", label: "已完成" },
];

const STATUS_DISPLAY_LABELS: Record<string, string> = {
  todo: "待开始",
  doing: "进行中",
  pending_review: "待审核",
  done: "已完成",
  overdue: "已逾期",
  blocked: "已阻塞",
  cancelled: "已取消",
  // legacy
  pending: "待开始",
  in_progress: "进行中",
  review: "待审核",
  completed: "已完成",
};

const STATUS_STYLES: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600",
  doing: "bg-blue-100 text-blue-700",
  in_progress: "bg-blue-100 text-blue-700",
  pending: "bg-gray-100 text-gray-600",
  pending_review: "bg-yellow-100 text-yellow-700",
  review: "bg-yellow-100 text-yellow-700",
  done: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  blocked: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-400",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  todo: <Circle size={12} />,
  doing: <Clock size={12} />,
  in_progress: <Clock size={12} />,
  pending: <Circle size={12} />,
  pending_review: <TrendingUp size={12} />,
  review: <TrendingUp size={12} />,
  done: <CheckCircle2 size={12} />,
  completed: <CheckCircle2 size={12} />,
  overdue: <AlertCircle size={12} />,
  blocked: <PauseCircle size={12} />,
  cancelled: <Ban size={12} />,
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent_important: "bg-red-50 text-red-700 border border-red-200",
  high: "bg-red-50 text-red-600 border border-red-200",
  medium: "bg-yellow-50 text-yellow-600 border border-yellow-200",
  low: "bg-gray-50 text-gray-500 border border-gray-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent_important: "紧急重要",
  high: "高",
  medium: "中",
  low: "低",
};

type ViewTab = "my_owned" | "team" | "my_created" | "my_assisted";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEffectiveDueDate(task: Task): string | null {
  return task.due_at ?? task.due_date ?? null;
}

function isOverdue(task: Task): boolean {
  const s = task.status;
  if (s === "done" || s === "completed" || s === "cancelled") return false;
  const due = getEffectiveDueDate(task);
  if (!due) return false;
  return new Date(due) < new Date();
}

function isToday(task: Task): boolean {
  const due = getEffectiveDueDate(task);
  if (!due) return false;
  const d = new Date(due);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function resolvedStatus(task: Task): string {
  if (isOverdue(task)) return "overdue";
  return task.status ?? "todo";
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

function getOwnerName(task: Task, profiles: Profile[]): string {
  const ownerId = task.owner_id ?? task.assigned_to;
  if (!ownerId) return "未分配";
  return profiles.find((p) => p.id === ownerId)?.full_name ?? "未知";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TasksPage() {
  // ── Data state ──
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // ── View / filter state ──
  const [activeTab, setActiveTab] = useState<ViewTab>("my_owned");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  // ── Detail drawer ──
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // ── Create modal ──
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    acceptance_criteria: "",
    module: "ecommerce",
    assigned_to: "",
    reviewer_id: "",
    task_type: "normal",
    source_type: "manual",
    priority: "medium",
    due_date: "",
    progress_percent: 0,
    blocked_reason: "",
  });

  // ── AI Import state ──
  const [showImport, setShowImport] = useState(false);
  const [minutesText, setMinutesText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedSummary, setParsedSummary] = useState("");
  const [importStep, setImportStep] = useState<"input" | "preview">("input");
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [importing, setImporting] = useState(false);

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("fetchTasks error:", error.message);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }, []);

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");
    console.log("profiles data:", data, "error:", error);
    setProfiles(data || []);
  }, []);

  useEffect(() => {
    // 获取当前登录用户
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
    fetchTasks();
    fetchProfiles();
  }, [fetchTasks, fetchProfiles]);

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const tabFiltered = tasks.filter((t) => {
    if (!currentUserId) return true; // 未登录时显示全部
    if (activeTab === "team") return true; // 团队任务：显示全部
    if (activeTab === "my_owned") {
      // 我的任务：负责人是我（兼容 owner_id 和旧的 assigned_to）
      return t.owner_id === currentUserId || t.assigned_to === currentUserId;
    }
    if (activeTab === "my_created") {
      // 我创建的：creator_id 是我，或 assigned_to 是我（新建时默认填的是负责人）
      return t.creator_id === currentUserId || t.assigned_to === currentUserId;
    }
    if (activeTab === "my_assisted") {
      // 我协助的：assigned_to 不是我但与我有关联（暂用 owner_id 不是自己但 assigned_to 是自己）
      return t.assigned_to === currentUserId && t.owner_id !== currentUserId && t.owner_id != null;
    }
    return true;
  });

  const filtered = tabFiltered.filter((t) => {
    const effectiveStatus = resolvedStatus(t);
    const matchStatus =
      statusFilter === "all" ||
      t.status === statusFilter ||
      effectiveStatus === statusFilter;
    const matchPriority =
      priorityFilter === "all" || t.priority === priorityFilter;
    const matchModule =
      moduleFilter === "all" || t.module === moduleFilter;
    const matchType =
      taskTypeFilter === "all" || (t.task_type ?? "normal") === taskTypeFilter;
    const matchSource =
      sourceFilter === "all" || (t.source_type ?? "manual") === sourceFilter;
    const matchSearch =
      searchText === "" ||
      t.title.toLowerCase().includes(searchText.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(searchText.toLowerCase());
    return matchStatus && matchPriority && matchModule && matchType && matchSource && matchSearch;
  });

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const stats = {
    total: tasks.length,
    doing: tasks.filter(
      (t) => t.status === "doing" || t.status === "in_progress"
    ).length,
    pending_review: tasks.filter(
      (t) => t.status === "pending_review" || t.status === "review"
    ).length,
    due_today: tasks.filter((t) => isToday(t) && t.status !== "done" && t.status !== "completed").length,
    overdue: tasks.filter((t) => isOverdue(t)).length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
  };

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      module: form.module,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      status: "todo",
      due_date: form.due_date || null,
    };

    // New fields — added defensively
    try {
      payload.owner_id = form.assigned_to || null;
      payload.task_type = form.task_type;
      payload.source_type = form.source_type;
      payload.acceptance_criteria = form.acceptance_criteria || null;
      payload.progress_percent = form.progress_percent;
      payload.blocked_reason = form.blocked_reason || null;
      payload.reviewer_id = form.reviewer_id || null;
    } catch {
      // ignore if columns don't exist yet
    }

    const { error } = await supabase.from("tasks").insert(payload);
    if (error) {
      // If error is about unknown columns, retry with minimal payload
      if (error.message.includes("column")) {
        const minPayload = {
          title: form.title,
          description: form.description || null,
          module: form.module,
          assigned_to: form.assigned_to || null,
          priority: form.priority,
          status: "todo",
          due_date: form.due_date || null,
        };
        const { error: err2 } = await supabase.from("tasks").insert(minPayload);
        if (err2) setFormError(err2.message);
        else {
          closeModal();
          fetchTasks();
        }
      } else {
        setFormError(error.message);
      }
    } else {
      closeModal();
      fetchTasks();
    }
    setSubmitting(false);
  }

  function closeModal() {
    setShowModal(false);
    setFormError(null);
    setForm({
      title: "",
      description: "",
      acceptance_criteria: "",
      module: "ecommerce",
      assigned_to: "",
      reviewer_id: "",
      task_type: "normal",
      source_type: "manual",
      priority: "medium",
      due_date: "",
      progress_percent: 0,
      blocked_reason: "",
    });
  }

  // ── AI Parse ──
  async function handleParse() {
    if (!minutesText.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await fetch("/api/tasks/parse-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: minutesText, members: profiles }),
      });
      const json = await res.json();
      if (!res.ok) {
        setParseError(json.error || "解析失败");
        return;
      }
      if (!json.tasks || json.tasks.length === 0) {
        setParseError("未从纪要中识别到任何任务，请检查内容是否包含明确的行动项");
        return;
      }
      setParsedTasks(json.tasks);
      setParsedSummary(json.summary || "");
      setImportStep("preview");
    } catch {
      setParseError("网络错误，请重试");
    } finally {
      setParsing(false);
    }
  }

  function removeParsedTask(idx: number) {
    setParsedTasks((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateParsedTask(
    idx: number,
    field: keyof ParsedTask,
    value: string | null
  ) {
    setParsedTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    );
  }

  async function handleImportConfirm() {
    if (parsedTasks.length === 0) return;
    setImporting(true);
    const rows = parsedTasks.map((t) => ({
      title: t.title,
      description: t.description || null,
      module: t.module || "other",
      assigned_to: t.assigned_to_id || null,
      priority: t.priority || "medium",
      status: "todo",
      due_date: t.due_date || null,
      source_type: "meeting",
    }));
    const { error } = await supabase.from("tasks").insert(rows);
    if (error) {
      setParseError("导入失败: " + error.message);
    } else {
      closeImport();
      fetchTasks();
    }
    setImporting(false);
  }

  function closeImport() {
    setShowImport(false);
    setMinutesText("");
    setImportStep("input");
    setParsedTasks([]);
    setParsedSummary("");
    setParseError(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare size={24} className="text-violet-600" />
            工作任务中心
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">跟踪和管理全团队的工作任务</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-gray-700 hover:text-violet-700 text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-sm"
          >
            <FileText size={15} />
            导入会议纪要
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-sm"
          >
            <Plus size={16} />
            新建任务
          </button>
        </div>
      </div>

      {/* ── View Tabs ── */}
      <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm w-fit">
        {(
          [
            { key: "my_owned", label: "我的任务" },
            { key: "team", label: "团队任务" },
            { key: "my_created", label: "我创建的" },
            { key: "my_assisted", label: "我协助的" },
          ] as { key: ViewTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "text-sm font-medium px-4 py-2 rounded-lg transition",
              activeTab === tab.key
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── KPI Stats ── */}
      <div className="grid grid-cols-6 gap-3">
        {[
          {
            label: "总任务数",
            value: stats.total,
            icon: ListTodo,
            color: "text-violet-600",
            bg: "bg-violet-50",
            onClick: () => setStatusFilter("all"),
          },
          {
            label: "进行中",
            value: stats.doing,
            icon: Clock,
            color: "text-blue-600",
            bg: "bg-blue-50",
            onClick: () => setStatusFilter("doing"),
          },
          {
            label: "待审核",
            value: stats.pending_review,
            icon: TrendingUp,
            color: "text-yellow-600",
            bg: "bg-yellow-50",
            onClick: () => setStatusFilter("pending_review"),
          },
          {
            label: "今日到期",
            value: stats.due_today,
            icon: Calendar,
            color: "text-orange-500",
            bg: "bg-orange-50",
            onClick: () => {},
          },
          {
            label: "已逾期",
            value: stats.overdue,
            icon: AlertCircle,
            color: "text-red-500",
            bg: "bg-red-50",
            onClick: () => setStatusFilter("overdue"),
          },
          {
            label: "已阻塞",
            value: stats.blocked,
            icon: PauseCircle,
            color: "text-orange-600",
            bg: "bg-orange-50",
            onClick: () => setStatusFilter("blocked"),
          },
        ].map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-left hover:border-violet-200 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{s.label}</span>
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  s.bg
                )}
              >
                <s.icon size={14} className={s.color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
          </button>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
            <Filter size={14} />
            <span className="font-medium">筛选</span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">状态：</span>
            <div className="flex gap-1 flex-wrap">
              {[
                { value: "all", label: "全部" },
                { value: "todo", label: "待开始" },
                { value: "doing", label: "进行中" },
                { value: "pending_review", label: "待审核" },
                { value: "done", label: "已完成" },
                { value: "overdue", label: "已逾期" },
                { value: "blocked", label: "已阻塞" },
                { value: "cancelled", label: "已取消" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg transition",
                    statusFilter === opt.value
                      ? "bg-violet-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Priority */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">优先级：</span>
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-violet-400 appearance-none bg-white"
              >
                <option value="all">全部</option>
                <option value="urgent_important">紧急重要</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Module */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">模块：</span>
            <div className="relative">
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-violet-400 appearance-none bg-white"
              >
                <option value="all">全部</option>
                {moduleOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Task Type */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">任务类型：</span>
            <div className="relative">
              <select
                value={taskTypeFilter}
                onChange={(e) => setTaskTypeFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-violet-400 appearance-none bg-white"
              >
                <option value="all">全部</option>
                {taskTypeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">来源：</span>
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-violet-400 appearance-none bg-white"
              >
                <option value="all">全部</option>
                {sourceTypeOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Search */}
          <div className="ml-auto relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索任务标题或描述…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-violet-400 w-52"
            />
          </div>
        </div>
      </div>

      {/* ── Task Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            共 {filtered.length} 项任务
          </span>
          {(statusFilter !== "all" || priorityFilter !== "all" || moduleFilter !== "all" || searchText) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setModuleFilter("all");
                setTaskTypeFilter("all");
                setSourceFilter("all");
                setSearchText("");
              }}
              className="text-xs text-gray-400 hover:text-violet-600 transition flex items-center gap-1"
            >
              <X size={11} />
              清除筛选
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-violet-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CheckSquare size={36} className="mb-3 text-gray-200" />
            <p className="text-sm">暂无匹配任务</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid gap-3 px-5 py-3 text-xs text-gray-400 font-medium bg-gray-50/80 border-b border-gray-100"
              style={{ gridTemplateColumns: "minmax(0,3fr) 90px 90px 90px 80px 100px 80px 90px 80px 60px" }}>
              <div>任务标题</div>
              <div>任务类型</div>
              <div>所属模块</div>
              <div>主负责人</div>
              <div>优先级</div>
              <div>状态</div>
              <div>进度</div>
              <div>截止日期</div>
              <div>来源</div>
              <div>操作</div>
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map((task) => {
                const effStatus = resolvedStatus(task);
                const overdueFlag = isOverdue(task);
                const todayFlag = isToday(task) && effStatus !== "done" && effStatus !== "completed";
                const progress = task.progress_percent ?? 0;
                const dueStr = getEffectiveDueDate(task);

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "grid gap-3 px-5 py-4 items-center hover:bg-gray-50/60 transition cursor-pointer",
                      overdueFlag && "bg-red-50/30"
                    )}
                    style={{ gridTemplateColumns: "minmax(0,3fr) 90px 90px 90px 80px 100px 80px 90px 80px 60px" }}
                    onClick={() => setSelectedTask(task)}
                  >
                    {/* Title */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {task.title}
                        </span>
                        {overdueFlag && (
                          <span className="shrink-0 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                            逾期
                          </span>
                        )}
                        {todayFlag && !overdueFlag && (
                          <span className="shrink-0 text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                            今日到期
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">
                          {task.description}
                        </div>
                      )}
                    </div>

                    {/* Task type */}
                    <div>
                      <span className="text-xs text-gray-500">
                        {taskTypeLabels[task.task_type ?? "normal"] ?? task.task_type ?? "普通"}
                      </span>
                    </div>

                    {/* Module */}
                    <div>
                      <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">
                        {moduleLabels[task.module ?? ""] ?? task.module ?? "—"}
                      </span>
                    </div>

                    {/* Owner */}
                    <div className="text-xs text-gray-600 truncate">
                      {getOwnerName(task, profiles)}
                    </div>

                    {/* Priority */}
                    <div>
                      <span
                        className={cn(
                          "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                          PRIORITY_STYLES[task.priority ?? "low"]
                        )}
                      >
                        {PRIORITY_LABELS[task.priority ?? ""] ?? task.priority ?? "—"}
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                          STATUS_STYLES[effStatus]
                        )}
                      >
                        {STATUS_ICONS[effStatus]}
                        {STATUS_DISPLAY_LABELS[effStatus] ?? effStatus}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            progress === 100
                              ? "bg-green-500"
                              : progress >= 60
                              ? "bg-violet-500"
                              : progress >= 30
                              ? "bg-blue-400"
                              : "bg-gray-300"
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Due date */}
                    <div
                      className={cn(
                        "text-xs flex items-center gap-1",
                        overdueFlag
                          ? "text-red-500 font-medium"
                          : todayFlag
                          ? "text-orange-500 font-medium"
                          : "text-gray-400"
                      )}
                    >
                      {dueStr ? (
                        <>
                          <Calendar size={11} />
                          {formatDate(dueStr)}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>

                    {/* Source */}
                    <div>
                      <span className="text-xs text-gray-400">
                        {sourceTypeLabels[task.source_type ?? "manual"] ?? "手工"}
                      </span>
                    </div>

                    {/* Action */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-0.5 transition"
                      >
                        详情
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ══ Task Detail Drawer ══ */}
      {selectedTask && (
        <div className="fixed inset-0 z-40 flex">
          {/* Overlay */}
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedTask(null)}
          />
          {/* Drawer */}
          <div className="w-[680px] bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  {selectedTask.title}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                      STATUS_STYLES[resolvedStatus(selectedTask)]
                    )}
                  >
                    {STATUS_ICONS[resolvedStatus(selectedTask)]}
                    {STATUS_DISPLAY_LABELS[resolvedStatus(selectedTask)] ?? selectedTask.status}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      PRIORITY_STYLES[selectedTask.priority ?? "low"]
                    )}
                  >
                    {PRIORITY_LABELS[selectedTask.priority ?? ""] ?? selectedTask.priority}
                  </span>
                  {selectedTask.task_type && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {taskTypeLabels[selectedTask.task_type] ?? selectedTask.task_type}
                    </span>
                  )}
                  {selectedTask.source_type && selectedTask.source_type !== "manual" && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      {sourceTypeLabels[selectedTask.source_type]}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body – 2-column */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-0 h-full">
                {/* Left column – main content */}
                <div className="col-span-2 px-6 py-5 space-y-5 border-r border-gray-100">
                  {/* Description */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      <Info size={12} />
                      任务描述
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedTask.description ?? "（暂无描述）"}
                    </p>
                  </div>

                  {/* Acceptance criteria */}
                  {selectedTask.acceptance_criteria && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                        <CheckCircle2 size={12} />
                        验收标准
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                        {selectedTask.acceptance_criteria}
                      </p>
                    </div>
                  )}

                  {/* Blocked reason */}
                  {selectedTask.status === "blocked" && selectedTask.blocked_reason && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 mb-2 uppercase tracking-wide">
                        <PauseCircle size={12} />
                        阻塞原因
                      </div>
                      <p className="text-sm text-orange-700 leading-relaxed whitespace-pre-wrap bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                        {selectedTask.blocked_reason}
                      </p>
                    </div>
                  )}

                  {/* Progress */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      <BarChart2 size={12} />
                      任务进度
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>完成度</span>
                        <span className="font-semibold text-gray-700">
                          {selectedTask.progress_percent ?? 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className={cn(
                            "h-2.5 rounded-full transition-all",
                            (selectedTask.progress_percent ?? 0) === 100
                              ? "bg-green-500"
                              : (selectedTask.progress_percent ?? 0) >= 60
                              ? "bg-violet-500"
                              : "bg-blue-400"
                          )}
                          style={{ width: `${selectedTask.progress_percent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column – meta */}
                <div className="px-4 py-5 space-y-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">任务信息</div>

                  {[
                    {
                      label: "所属模块",
                      value: moduleLabels[selectedTask.module ?? ""] ?? selectedTask.module ?? "—",
                      icon: <Tag size={12} />,
                    },
                    {
                      label: "主负责人",
                      value: getOwnerName(selectedTask, profiles),
                      icon: <User size={12} />,
                    },
                    {
                      label: "审核人",
                      value: selectedTask.reviewer_id
                        ? profiles.find((p) => p.id === selectedTask.reviewer_id)?.full_name ?? "—"
                        : "—",
                      icon: <CheckSquare size={12} />,
                    },
                    {
                      label: "截止日期",
                      value: formatDate(getEffectiveDueDate(selectedTask)),
                      icon: <Calendar size={12} />,
                    },
                    {
                      label: "创建时间",
                      value: formatDate(selectedTask.created_at),
                      icon: <Clock size={12} />,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                        {item.icon}
                        {item.label}
                      </div>
                      <div className="text-sm text-gray-700 font-medium">{item.value}</div>
                    </div>
                  ))}

                  {/* Overdue warning */}
                  {isOverdue(selectedTask) && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
                      <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">
                        此任务已逾期，请尽快处理或更新状态。
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                ID: {selectedTask.id.slice(0, 8)}…
              </span>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ AI 导入会议纪要弹窗 ══ */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Sparkles size={15} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI 解析会议纪要</h3>
                  <p className="text-xs text-gray-400">自动提取任务并分配负责人</p>
                </div>
              </div>
              <button
                onClick={closeImport}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-0 px-6 pt-4 shrink-0">
              {["粘贴纪要", "确认任务"].map((step, i) => (
                <div key={step} className="flex items-center">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full",
                      (i === 0 && importStep === "input") ||
                        (i === 1 && importStep === "preview")
                        ? "bg-violet-600 text-white"
                        : i === 0 && importStep === "preview"
                        ? "bg-violet-100 text-violet-600"
                        : "bg-gray-100 text-gray-400"
                    )}
                  >
                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                    {step}
                  </div>
                  {i < 1 && <div className="w-6 h-px bg-gray-200 mx-1" />}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {importStep === "input" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                    将会议纪要文字粘贴到下方，AI 会自动识别任务、负责人、截止日期和优先级
                  </div>
                  <textarea
                    value={minutesText}
                    onChange={(e) => setMinutesText(e.target.value)}
                    placeholder={`例：\n2026年4月18日 周五 产品周会纪要\n\n议题一：电商平台优化\n- 陈一负责天猫店铺首页改版，下周五前完成\n- 王二跟进京东活动报名，高优先级，4月20日截止`}
                    rows={12}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none placeholder:text-gray-300"
                  />
                  {parseError && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-4 py-3 rounded-xl flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      {parseError}
                    </div>
                  )}
                </div>
              )}

              {importStep === "preview" && (
                <div className="space-y-4">
                  {parsedSummary && (
                    <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-700">
                      <span className="font-semibold">会议摘要：</span>
                      {parsedSummary}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    共识别到{" "}
                    <span className="font-semibold text-violet-600">
                      {parsedTasks.length}
                    </span>{" "}
                    个任务，可直接编辑后导入：
                  </p>
                  {parsedTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      所有任务已删除
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {parsedTasks.map((t, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 hover:border-violet-200 transition"
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1 space-y-2 min-w-0">
                              <input
                                value={t.title}
                                onChange={(e) =>
                                  updateParsedTask(idx, "title", e.target.value)
                                }
                                className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-violet-400 outline-none pb-0.5"
                              />
                              {t.description && (
                                <p className="text-xs text-gray-500">
                                  {t.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2 items-center">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">负责人：</span>
                                  <select
                                    value={t.assigned_to_id || ""}
                                    onChange={(e) => {
                                      const p = profiles.find(
                                        (p) => p.id === e.target.value
                                      );
                                      updateParsedTask(
                                        idx,
                                        "assigned_to_id",
                                        e.target.value || null
                                      );
                                      updateParsedTask(
                                        idx,
                                        "assigned_to_name",
                                        p?.full_name || null
                                      );
                                    }}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 bg-white"
                                  >
                                    <option value="">未分配</option>
                                    {profiles.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.full_name || p.email}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">优先级：</span>
                                  <select
                                    value={t.priority}
                                    onChange={(e) =>
                                      updateParsedTask(idx, "priority", e.target.value)
                                    }
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 bg-white"
                                  >
                                    <option value="high">高</option>
                                    <option value="medium">中</option>
                                    <option value="low">低</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">模块：</span>
                                  <select
                                    value={t.module}
                                    onChange={(e) =>
                                      updateParsedTask(idx, "module", e.target.value)
                                    }
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 bg-white"
                                  >
                                    {moduleOptions.map((m) => (
                                      <option key={m.value} value={m.value}>
                                        {m.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                {t.due_date && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg">
                                    <Calendar size={11} />
                                    {t.due_date}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => removeParsedTask(idx)}
                              className="w-6 h-6 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {parseError && (
                    <div className="bg-red-50 text-red-600 text-xs px-4 py-3 rounded-xl">
                      {parseError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              {importStep === "input" ? (
                <div className="flex gap-3">
                  <button
                    onClick={closeImport}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleParse}
                    disabled={parsing || !minutesText.trim()}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {parsing ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        AI 解析中…
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        开始解析
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setImportStep("input");
                      setParseError(null);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition"
                  >
                    <Pencil size={14} />
                    重新编辑
                  </button>
                  <button
                    onClick={handleImportConfirm}
                    disabled={importing || parsedTasks.length === 0}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        导入中…
                      </>
                    ) : (
                      <>
                        <CheckCheck size={15} />
                        确认导入 {parsedTasks.length} 个任务
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ 新建任务弹窗 ══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Plus size={16} className="text-violet-600" />
                新建任务
              </h3>
              <button
                onClick={closeModal}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Form */}
            <form
              id="task-form"
              onSubmit={handleCreate}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
            >
              {formError && (
                <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
                  {formError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  任务标题 <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="简洁描述任务内容"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Type + Source */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    任务类型 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.task_type}
                      onChange={(e) =>
                        setForm({ ...form, task_type: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      {taskTypeOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    任务来源
                  </label>
                  <div className="relative">
                    <select
                      value={form.source_type}
                      onChange={(e) =>
                        setForm({ ...form, source_type: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      {sourceTypeOptions.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Module + Owner */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    所属模块 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.module}
                      onChange={(e) =>
                        setForm({ ...form, module: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      {moduleOptions.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    主负责人 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.assigned_to}
                      onChange={(e) =>
                        setForm({ ...form, assigned_to: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      <option value="">请选择</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Reviewer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    审核人
                    {form.task_type === "approval" && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      value={form.reviewer_id}
                      onChange={(e) =>
                        setForm({ ...form, reviewer_id: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      <option value="">不指定</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    截止日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm({ ...form, due_date: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  优先级 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "urgent_important", label: "紧急重要", cls: "border-red-400 bg-red-50 text-red-700" },
                    { value: "high", label: "高", cls: "border-red-300 bg-red-50 text-red-600" },
                    { value: "medium", label: "中", cls: "border-yellow-300 bg-yellow-50 text-yellow-600" },
                    { value: "low", label: "低", cls: "border-gray-300 bg-gray-50 text-gray-500" },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.value}
                      onClick={() => setForm({ ...form, priority: p.value })}
                      className={cn(
                        "flex-1 text-xs font-medium py-2 rounded-lg border transition",
                        form.priority === p.value
                          ? p.cls
                          : "border-gray-200 text-gray-400 hover:border-gray-300"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  任务描述 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="详细说明任务背景、目标和要求"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
                />
              </div>

              {/* Acceptance criteria */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  验收标准 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={form.acceptance_criteria}
                  onChange={(e) =>
                    setForm({ ...form, acceptance_criteria: e.target.value })
                  }
                  placeholder="明确完成该任务的验收条件"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
                />
              </div>

              {/* Progress */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  初始进度：{form.progress_percent}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.progress_percent}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      progress_percent: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-violet-600"
                />
              </div>

              {/* Blocked reason (conditional) */}
              {form.task_type === "blocked" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    阻塞原因 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.blocked_reason}
                    onChange={(e) =>
                      setForm({ ...form, blocked_reason: e.target.value })
                    }
                    placeholder="说明任务被阻塞的原因"
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
                  />
                </div>
              )}

              {/* Hint for collaborative */}
              {form.task_type === "collaborative" && (
                <div className="bg-blue-50 border border-blue-100 text-blue-700 text-xs px-3 py-2.5 rounded-xl flex items-start gap-2">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  协作任务建议在创建后于任务详情中添加协助人。
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                form="task-form"
                type="submit"
                disabled={submitting}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                创建任务
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
