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

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Users,
  UserPlus,
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
  submitted_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  reject_reason?: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface Participant {
  id?: string;
  task_id?: string;
  user_id: string;
  role: "collaborator" | "assistant";
  assist_content?: string | null;
  assist_deadline?: string | null;
  assist_done?: boolean | null;
  assist_done_at?: string | null;
  own_progress?: number | null;
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
];

const moduleLabels: Record<string, string> = Object.fromEntries(
  moduleOptions.map((m) => [m.value, m.label])
);

const taskTypeOptions = [
  { value: "normal", label: "普通任务" },
  { value: "team", label: "团队任务" },
  { value: "assist", label: "协助任务" },
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
  { value: "note", label: "笔记转任务" },
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
  high: "bg-red-50 text-red-700 border border-red-200",
  medium: "bg-yellow-50 text-yellow-600 border border-yellow-200",
  low: "bg-gray-50 text-gray-500 border border-gray-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

type ViewTab = "my_owned" | "team" | "my_created";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  // 按任务 id 分组存放协作人/协助人
  const [participantsByTask, setParticipantsByTask] = useState<Record<string, Participant[]>>({});

  // ── View / filter state ──
  const [activeTab, setActiveTab] = useState<ViewTab>("my_owned");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear())); // 默认本年
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1).padStart(2, "0")); // 默认本月（无"全部"选项）
  const [searchText, setSearchText] = useState("");

  // ── Detail drawer ──
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reasonInput, setReasonInput] = useState("");

  // ── Create modal ──
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // 来自笔记的预填来源：保存任务后要把任务 id 关联回这条笔记
  const [linkedNoteId, setLinkedNoteId] = useState<string | null>(null);
  const router = useRouter();
  const prefillHandled = useRef(false);
  const taskIdHandled = useRef(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    acceptance_criteria: "",
    module: "ecommerce",
    assigned_to: "",
    task_type: "normal",
    source_type: "manual",
    priority: "medium",
    due_date: "",
    progress_percent: 0,
    blocked_reason: "",
  });
  // 协作人（团队任务） / 协助人（协助任务）
  const [formCollaborators, setFormCollaborators] = useState<string[]>([]);
  const [formAssistants, setFormAssistants] = useState<
    { user_id: string; assist_content: string; assist_deadline: string }[]
  >([]);

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

  const fetchParticipants = useCallback(async () => {
    const { data, error } = await supabase.from("task_participants").select("*");
    if (error) {
      console.error("fetchParticipants error:", error.message);
      return;
    }
    const grouped: Record<string, Participant[]> = {};
    (data || []).forEach((p: Participant) => {
      if (!p.task_id) return;
      if (!grouped[p.task_id]) grouped[p.task_id] = [];
      grouped[p.task_id].push(p);
    });
    setParticipantsByTask(grouped);
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
    // 获取当前登录用户 + 是否为管理员
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        setIsAdmin(prof?.role === "admin");
      }
    });
    fetchTasks();
    fetchProfiles();
    fetchParticipants();
  }, [fetchTasks, fetchProfiles, fetchParticipants]);

  // 切换任务类型时清空上一个类型残留的协作/协助配置
  useEffect(() => {
    setFormCollaborators([]);
    setFormAssistants([]);
  }, [form.task_type]);

  // ─── 处理 URL 参数 ───────────────────────────────────────────────────────────
  // 用 window.location.search 而不是 useSearchParams（避免 Suspense 边界要求）
  // ?from_note=1 → 从工作台跳过来，读 sessionStorage 里的 AI 预填，打开新建任务表单
  // ?taskId=xxx → 自动打开该任务的详情抽屉
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    if (!prefillHandled.current && params.get("from_note") === "1") {
      prefillHandled.current = true;
      const raw = sessionStorage.getItem("home_task_prefill");
      const noteId = sessionStorage.getItem("home_task_prefill_note_id");
      sessionStorage.removeItem("home_task_prefill");
      sessionStorage.removeItem("home_task_prefill_note_id");

      if (raw) {
        try {
          const data = JSON.parse(raw) as { title?: string; description?: string; acceptance_criteria?: string };
          setForm((prev) => ({
            ...prev,
            title: data.title || "",
            description: data.description || "",
            acceptance_criteria: data.acceptance_criteria || "",
            source_type: "note",
          }));
        } catch { /* 解析失败用空表单 */ }
      }
      if (noteId) setLinkedNoteId(noteId);
      setShowModal(true);
      router.replace("/dashboard/tasks");
      return;
    }

    if (!taskIdHandled.current) {
      const tid = params.get("taskId");
      if (tid) setPendingTaskId(tid);
    }
  }, [router]);

  // 等 tasks 加载完，再用 pendingTaskId 打开抽屉
  useEffect(() => {
    if (taskIdHandled.current || !pendingTaskId || tasks.length === 0) return;
    const t = tasks.find((x) => x.id === pendingTaskId);
    if (t) {
      taskIdHandled.current = true;
      setSelectedTask(t);
      setPendingTaskId(null);
      router.replace("/dashboard/tasks");
    }
  }, [pendingTaskId, tasks, router]);

  // ─── Admin delete ──────────────────────────────────────────────────────────

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`确定删除任务「${title}」？此操作不可撤销。`)) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error || "删除失败");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    if (selectedTask?.id === taskId) setSelectedTask(null);
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`确定删除选中的 ${ids.length} 条任务？此操作不可撤销。`)) return;
    setBatchDeleting(true);
    try {
      const res = await fetch("/api/tasks/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "批量删除失败");
        return;
      }
      const removed = new Set(ids);
      setTasks((prev) => prev.filter((t) => !removed.has(t.id)));
      setSelectedIds(new Set());
      if (selectedTask && removed.has(selectedTask.id)) setSelectedTask(null);
    } finally {
      setBatchDeleting(false);
    }
  };

  const toggleSelect = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const tabFiltered = tasks.filter((t) => {
    if (activeTab === "team") return true; // 团队任务：显示全部（无需登录过滤）
    if (!currentUserId) return false; // 当前用户未加载完成时，个人Tab不显示任何任务
    if (activeTab === "my_owned") {
      // 我的任务/协助：我是主负责人、协作人 或 协助人
      if (t.owner_id === currentUserId || t.assigned_to === currentUserId) return true;
      const ps = participantsByTask[t.id] || [];
      return ps.some((p) => p.user_id === currentUserId);
    }
    if (activeTab === "my_created") {
      // 我创建的：creator_id 是我
      return t.creator_id === currentUserId;
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
    // 年/月：无 due_at 的任务始终通过（不被日期筛选过滤掉）
    const matchYear = !t.due_at || t.due_at.slice(0, 4) === yearFilter;
    const matchMonth = !t.due_at || t.due_at.slice(5, 7) === monthFilter;
    const matchSearch =
      searchText === "" ||
      t.title.toLowerCase().includes(searchText.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(searchText.toLowerCase());
    return matchStatus && matchPriority && matchModule && matchType && matchSource && matchYear && matchMonth && matchSearch;
  });

  // 年份选项：从所有任务的 due_at 提取（去重，倒序）+ 当前年保底
  const yearOptions = (() => {
    const set = new Set<string>();
    set.add(String(new Date().getFullYear()));
    for (const t of tasks) {
      if (t.due_at) set.add(t.due_at.slice(0, 4));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  })();

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

  // ─── Task lifecycle actions ───────────────────────────────────────────────

  async function updateTaskFields(taskId: string, patch: Record<string, unknown>) {
    setActionLoading(true);
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error) {
      alert("操作失败: " + error.message);
      setActionLoading(false);
      return false;
    }
    // 本地更新 selectedTask & tasks
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    setSelectedTask((prev) => (prev && prev.id === taskId ? { ...prev, ...patch } : prev));
    setActionLoading(false);
    return true;
  }

  async function handleStartTask(task: Task) {
    await updateTaskFields(task.id, { status: "doing" });
  }
  async function handleUnblock(task: Task) {
    await updateTaskFields(task.id, { status: "doing", blocked_reason: null });
  }
  async function handleBlockConfirm(task: Task) {
    if (!reasonInput.trim()) return;
    const ok = await updateTaskFields(task.id, {
      status: "blocked",
      blocked_reason: reasonInput.trim(),
    });
    if (ok) {
      setShowBlockModal(false);
      setReasonInput("");
    }
  }
  async function handleSubmitReview(task: Task) {
    await updateTaskFields(task.id, {
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    });
  }
  async function handleApprove(task: Task) {
    await updateTaskFields(task.id, {
      status: "done",
      progress_percent: 100,
      completed_at: new Date().toISOString(),
      reject_reason: null,
    });
  }
  async function handleRejectConfirm(task: Task) {
    if (!reasonInput.trim()) return;
    const ok = await updateTaskFields(task.id, {
      status: "doing",
      reject_reason: reasonInput.trim(),
    });
    if (ok) {
      setShowRejectModal(false);
      setReasonInput("");
    }
  }
  async function handleCancel(task: Task) {
    if (!confirm("确定取消这个任务？")) return;
    await updateTaskFields(task.id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    });
  }
  async function handleUpdateProgress(task: Task, pct: number) {
    await updateTaskFields(task.id, { progress_percent: pct });
  }

  // 协作人 / 协助人自身的交互
  async function handleUpdateOwnProgress(participantId: string, pct: number) {
    const { error } = await supabase
      .from("task_participants")
      .update({ own_progress: pct })
      .eq("id", participantId);
    if (error) {
      alert("更新进度失败: " + error.message);
      return;
    }
    setParticipantsByTask((prev) => {
      const next: Record<string, Participant[]> = {};
      Object.keys(prev).forEach((tid) => {
        next[tid] = prev[tid].map((p) =>
          p.id === participantId ? { ...p, own_progress: pct } : p
        );
      });
      return next;
    });
  }
  async function handleToggleAssistDone(participantId: string, next: boolean) {
    const patch: Record<string, unknown> = {
      assist_done: next,
      assist_done_at: next ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from("task_participants")
      .update(patch)
      .eq("id", participantId);
    if (error) {
      alert("更新失败: " + error.message);
      return;
    }
    setParticipantsByTask((prev) => {
      const nextMap: Record<string, Participant[]> = {};
      Object.keys(prev).forEach((tid) => {
        nextMap[tid] = prev[tid].map((p) =>
          p.id === participantId ? { ...p, ...patch } as Participant : p
        );
      });
      return nextMap;
    });
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    // 校验：协助任务的协助内容必填
    if (form.task_type === "assist") {
      if (formAssistants.length === 0) {
        setFormError("协助任务至少需要添加 1 位协助人");
        setSubmitting(false);
        return;
      }
      for (const a of formAssistants) {
        if (!a.user_id) {
          setFormError("请为每个协助行选择协助人");
          setSubmitting(false);
          return;
        }
        if (!a.assist_content.trim()) {
          setFormError("协助内容为必填");
          setSubmitting(false);
          return;
        }
      }
    }
    if (form.task_type === "team" && formCollaborators.length === 0) {
      setFormError("团队任务至少需要选择 1 位协作人");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      module: form.module,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      status: "todo",
      due_date: form.due_date || null,
      owner_id: form.assigned_to || null,
      creator_id: currentUserId,
      task_type: form.task_type,
      source_type: form.source_type,
      acceptance_criteria: form.acceptance_criteria || null,
      progress_percent: form.progress_percent,
      blocked_reason: form.blocked_reason || null,
    };

    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert(payload)
      .select("id")
      .single();

    if (error || !inserted) {
      setFormError(error?.message || "创建任务失败");
      setSubmitting(false);
      return;
    }

    // 写入 task_participants
    const pRows: Record<string, unknown>[] = [];
    if (form.task_type === "team") {
      formCollaborators.forEach((uid) => {
        pRows.push({ task_id: inserted.id, user_id: uid, role: "collaborator" });
      });
    } else if (form.task_type === "assist") {
      formAssistants.forEach((a) => {
        pRows.push({
          task_id: inserted.id,
          user_id: a.user_id,
          role: "assistant",
          assist_content: a.assist_content,
          assist_deadline: a.assist_deadline || null,
          assist_done: false,
        });
      });
    }
    if (pRows.length > 0) {
      const { error: pErr } = await supabase.from("task_participants").insert(pRows);
      if (pErr) {
        setFormError("任务已创建，但参与人写入失败: " + pErr.message);
        setSubmitting(false);
        fetchTasks();
        return;
      }
    }

    // 如果是从笔记跳过来建的任务：把新任务 id 写回笔记的 linked_task_ids
    if (linkedNoteId && inserted?.id) {
      try {
        await fetch(`/api/notes/${linkedNoteId}/link-task`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: inserted.id }),
        });
      } catch { /* 关联失败不阻塞建任务流程 */ }
      setLinkedNoteId(null);
    }

    closeModal();
    fetchTasks();
    fetchParticipants();
    setSubmitting(false);
  }

  function closeModal() {
    setShowModal(false);
    setFormError(null);
    setLinkedNoteId(null);
    setForm({
      title: "",
      description: "",
      acceptance_criteria: "",
      module: "ecommerce",
      assigned_to: "",
      task_type: "normal",
      source_type: "manual",
      priority: "medium",
      due_date: "",
      progress_percent: 0,
      blocked_reason: "",
    });
    setFormCollaborators([]);
    setFormAssistants([]);
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
            任务中心
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

          {/* Year filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">年份：</span>
            <div className="relative">
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-violet-400 appearance-none bg-white"
                title="按截止日期年份筛选（无截止日期的任务不受影响）"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Month filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">月份：</span>
            <div className="relative">
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-violet-400 appearance-none bg-white"
                title="按截止日期月份筛选（无截止日期的任务不受影响）"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m).padStart(2, "0")}>{m}月</option>
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
        {/* 批量删除操作栏（仅管理员且有勾选时显示） */}
        {isAdmin && selectedIds.size > 0 && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <span className="text-sm text-red-700 font-medium">
              已选中 {selectedIds.size} 条任务
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-white transition"
              >
                取消选择
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={batchDeleting}
                className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
              >
                {batchDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                批量删除
              </button>
            </div>
          </div>
        )}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            共 {filtered.length} 项任务
          </span>
          {(statusFilter !== "all" || priorityFilter !== "all" || moduleFilter !== "all" || taskTypeFilter !== "all" || sourceFilter !== "all" || yearFilter !== String(new Date().getFullYear()) || monthFilter !== String(new Date().getMonth() + 1).padStart(2, "0") || searchText) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setModuleFilter("all");
                setTaskTypeFilter("all");
                setSourceFilter("all");
                setYearFilter(String(new Date().getFullYear()));
                setMonthFilter(String(new Date().getMonth() + 1).padStart(2, "0"));
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
              style={{ gridTemplateColumns: isAdmin
                ? "28px minmax(0,3fr) 90px 90px 90px 80px 100px 80px 90px 80px 80px"
                : "minmax(0,3fr) 90px 90px 90px 80px 100px 80px 90px 80px 60px" }}>
              {isAdmin && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-400 cursor-pointer"
                    checked={filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id))}
                    ref={(el) => {
                      if (el) {
                        const someSelected = filtered.some((t) => selectedIds.has(t.id));
                        const allSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));
                        el.indeterminate = someSelected && !allSelected;
                      }
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filtered.map((t) => t.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    title="全选 / 取消全选"
                  />
                </div>
              )}
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
                      overdueFlag && "bg-red-50/30",
                      selectedIds.has(task.id) && "bg-violet-50/40"
                    )}
                    style={{ gridTemplateColumns: isAdmin
                      ? "28px minmax(0,3fr) 90px 90px 90px 80px 100px 80px 90px 80px 80px"
                      : "minmax(0,3fr) 90px 90px 90px 80px 100px 80px 90px 80px 60px" }}
                    onClick={() => setSelectedTask(task)}
                  >
                    {/* Checkbox（仅管理员） */}
                    {isAdmin && (
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-400 cursor-pointer"
                          checked={selectedIds.has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                        />
                      </div>
                    )}
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
                      {(() => {
                        const ps = participantsByTask[task.id] || [];
                        if (ps.length === 0) return null;
                        const isAssist = task.task_type === "assist";
                        return (
                          <div
                            className={cn(
                              "mt-0.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full",
                              isAssist
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                            )}
                            title={ps
                              .map((p) => profiles.find((x) => x.id === p.user_id)?.full_name)
                              .filter(Boolean)
                              .join("、")}
                          >
                            {isAssist ? <UserPlus size={9} /> : <Users size={9} />}
                            {ps.length}人
                          </div>
                        );
                      })()}
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
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(task.id, task.title);
                          }}
                          className="text-gray-300 hover:text-red-600 transition p-0.5 rounded hover:bg-red-50"
                          title="删除任务（仅管理员）"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
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

                  {/* 协作人 / 协助人 */}
                  {(() => {
                    const ps = participantsByTask[selectedTask.id] || [];
                    if (ps.length === 0) return null;
                    const collabs = ps.filter((p) => p.role === "collaborator");
                    const assists = ps.filter((p) => p.role === "assistant");
                    return (
                      <>
                        {collabs.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                              <Users size={12} />
                              协作人（{collabs.length}）
                            </div>
                            <div className="space-y-2">
                              {collabs.map((c) => {
                                const name =
                                  profiles.find((p) => p.id === c.user_id)?.full_name || "未知";
                                const isMe = c.user_id === currentUserId;
                                const own = c.own_progress ?? 0;
                                const canEdit =
                                  isMe &&
                                  (selectedTask.status === "doing" ||
                                    selectedTask.status === "in_progress");
                                return (
                                  <div
                                    key={c.id || c.user_id}
                                    className={cn(
                                      "border rounded-xl px-3 py-2.5",
                                      isMe
                                        ? "bg-blue-50/40 border-blue-200"
                                        : "bg-gray-50/40 border-gray-100"
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-sm font-medium text-gray-800">
                                        {name}
                                        {isMe && (
                                          <span className="ml-1.5 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                                            我
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-xs text-blue-700 font-semibold">
                                        {own}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                                      <div
                                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                                        style={{ width: `${own}%` }}
                                      />
                                    </div>
                                    {canEdit && c.id && (
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={own}
                                        onChange={(e) =>
                                          handleUpdateOwnProgress(
                                            c.id!,
                                            parseInt(e.target.value)
                                          )
                                        }
                                        className="w-full accent-blue-600 mt-1"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {assists.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                              <UserPlus size={12} />
                              协助人（{assists.length}）
                            </div>
                            <div className="space-y-2">
                              {assists.map((a) => {
                                const name =
                                  profiles.find((p) => p.id === a.user_id)?.full_name || "未知";
                                const isMe = a.user_id === currentUserId;
                                return (
                                  <div
                                    key={a.id || a.user_id}
                                    className={cn(
                                      "border rounded-xl px-3 py-2.5",
                                      isMe
                                        ? "bg-amber-50/60 border-amber-200"
                                        : "bg-gray-50/50 border-gray-100"
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium text-gray-800">
                                        {name}
                                        {isMe && (
                                          <span className="ml-1.5 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                                            我
                                          </span>
                                        )}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {a.assist_deadline && (
                                          <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar size={11} />
                                            {a.assist_deadline}
                                          </span>
                                        )}
                                        <span
                                          className={cn(
                                            "text-xs px-2 py-0.5 rounded-full",
                                            a.assist_done
                                              ? "bg-green-100 text-green-700"
                                              : "bg-gray-100 text-gray-500"
                                          )}
                                        >
                                          {a.assist_done ? "已完成" : "待处理"}
                                        </span>
                                      </div>
                                    </div>
                                    {a.assist_content && (
                                      <p className="text-xs text-gray-600 whitespace-pre-wrap mb-1.5">
                                        {a.assist_content}
                                      </p>
                                    )}
                                    {/* 只有本人可以勾选完成 */}
                                    {isMe && a.id && (
                                      <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 hover:bg-amber-50 transition">
                                        <input
                                          type="checkbox"
                                          checked={!!a.assist_done}
                                          onChange={(e) =>
                                            handleToggleAssistDone(a.id!, e.target.checked)
                                          }
                                          className="accent-amber-600"
                                        />
                                        <span className="text-xs text-amber-800 font-medium">
                                          {a.assist_done ? "✓ 我已完成协助" : "勾选表示我已完成协助"}
                                        </span>
                                        {a.assist_done && a.assist_done_at && (
                                          <span className="text-[10px] text-gray-400 ml-auto">
                                            {new Date(a.assist_done_at).toLocaleString("zh-CN", {
                                              month: "numeric",
                                              day: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        )}
                                      </label>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* 打回原因 */}
                  {selectedTask.reject_reason && selectedTask.status === "doing" && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500 mb-2 uppercase tracking-wide">
                        <AlertCircle size={12} />
                        审核打回原因
                      </div>
                      <p className="text-sm text-red-700 leading-relaxed whitespace-pre-wrap bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        {selectedTask.reject_reason}
                      </p>
                    </div>
                  )}

                  {/* 任务进度 — 简化为状态文案 */}
                  {(() => {
                    const status = selectedTask.status ?? "todo";
                    const map: Record<string, { label: string; cls: string }> = {
                      todo: { label: "待开始", cls: "bg-gray-50 text-gray-600 border-gray-200" },
                      pending: { label: "待开始", cls: "bg-gray-50 text-gray-600 border-gray-200" },
                      doing: { label: "任务进行中", cls: "bg-blue-50 text-blue-700 border-blue-200" },
                      in_progress: { label: "任务进行中", cls: "bg-blue-50 text-blue-700 border-blue-200" },
                      blocked: { label: "已阻塞，等待处理", cls: "bg-orange-50 text-orange-700 border-orange-200" },
                      pending_review: { label: "已提交，待创建人审核", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                      review: { label: "已提交，待创建人审核", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                      done: { label: "任务已完成 ✓", cls: "bg-green-50 text-green-700 border-green-200" },
                      completed: { label: "任务已完成 ✓", cls: "bg-green-50 text-green-700 border-green-200" },
                      cancelled: { label: "任务已取消", cls: "bg-gray-50 text-gray-400 border-gray-200" },
                    };
                    const info = map[status] ?? map.todo;
                    return (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                          <BarChart2 size={12} />
                          任务进度
                        </div>
                        <div
                          className={cn(
                            "text-sm font-medium px-3 py-2 rounded-xl border",
                            info.cls
                          )}
                        >
                          {info.label}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ⭐ 状态操作区 */}
                  {(() => {
                    if (!currentUserId) return null;
                    const isOwner =
                      selectedTask.owner_id === currentUserId ||
                      selectedTask.assigned_to === currentUserId;
                    const isCreator = selectedTask.creator_id === currentUserId;
                    const status = selectedTask.status;
                    const pct = selectedTask.progress_percent ?? 0;
                    const buttons: React.ReactNode[] = [];

                    // 主负责人按钮
                    if (isOwner) {
                      if (status === "todo" || status === "pending") {
                        buttons.push(
                          <button
                            key="start"
                            disabled={actionLoading}
                            onClick={() => handleStartTask(selectedTask)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Clock size={14} /> 开始任务
                          </button>
                        );
                      }
                      if (status === "doing" || status === "in_progress") {
                        buttons.push(
                          <button
                            key="block"
                            disabled={actionLoading}
                            onClick={() => {
                              setReasonInput("");
                              setShowBlockModal(true);
                            }}
                            className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <PauseCircle size={14} /> 标记阻塞
                          </button>
                        );
                        buttons.push(
                          <button
                            key="submit"
                            disabled={actionLoading}
                            onClick={() => handleSubmitReview(selectedTask)}
                            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                          >
                            <CheckCheck size={14} /> 提交审核
                          </button>
                        );
                      }
                      if (status === "blocked") {
                        buttons.push(
                          <button
                            key="unblock"
                            disabled={actionLoading}
                            onClick={() => handleUnblock(selectedTask)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Clock size={14} /> 恢复进行
                          </button>
                        );
                      }
                      if (status === "pending_review" || status === "review") {
                        buttons.push(
                          <div
                            key="waiting"
                            className="flex-1 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                          >
                            <TrendingUp size={14} /> 已提交，等待创建人审核
                          </div>
                        );
                      }
                    }

                    // 创建人按钮
                    if (isCreator) {
                      if (status === "pending_review" || status === "review") {
                        buttons.push(
                          <button
                            key="approve"
                            disabled={actionLoading}
                            onClick={() => handleApprove(selectedTask)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} /> 审核通过
                          </button>
                        );
                        buttons.push(
                          <button
                            key="reject"
                            disabled={actionLoading}
                            onClick={() => {
                              setReasonInput("");
                              setShowRejectModal(true);
                            }}
                            className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <X size={14} /> 审核打回
                          </button>
                        );
                      }
                      if (
                        status !== "done" &&
                        status !== "completed" &&
                        status !== "cancelled"
                      ) {
                        buttons.push(
                          <button
                            key="cancel"
                            disabled={actionLoading}
                            onClick={() => handleCancel(selectedTask)}
                            className="bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 text-sm font-medium px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Ban size={14} /> 取消任务
                          </button>
                        );
                      }
                    }

                    if (buttons.length === 0) return null;
                    return (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                          状态操作
                        </div>
                        <div className="flex gap-2 flex-wrap">{buttons}</div>
                      </div>
                    );
                  })()}
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

              {/* Due date */}
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

              {/* ── 团队任务：协作人多选 ── */}
              {form.task_type === "team" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    <Users size={12} className="inline mr-1" />
                    协作人 <span className="text-red-500">*</span>
                    <span className="ml-1 text-gray-400">（可多选，与主负责人一起完成任务）</span>
                  </label>
                  <div className="border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 bg-gray-50/40">
                    {profiles
                      .filter((p) => p.id !== form.assigned_to)
                      .map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white rounded-lg px-2 py-1 transition"
                        >
                          <input
                            type="checkbox"
                            checked={formCollaborators.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormCollaborators([...formCollaborators, p.id]);
                              } else {
                                setFormCollaborators(
                                  formCollaborators.filter((id) => id !== p.id)
                                );
                              }
                            }}
                            className="accent-violet-600"
                          />
                          <span className="text-gray-700">{p.full_name || p.email}</span>
                        </label>
                      ))}
                    {profiles.filter((p) => p.id !== form.assigned_to).length === 0 && (
                      <p className="text-xs text-gray-400 py-2">暂无可选成员</p>
                    )}
                  </div>
                  {formCollaborators.length > 0 && (
                    <p className="text-xs text-violet-600 mt-1.5">
                      已选 {formCollaborators.length} 位协作人
                    </p>
                  )}
                </div>
              )}

              {/* ── 协助任务：协助人列表 ── */}
              {form.task_type === "assist" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    <UserPlus size={12} className="inline mr-1" />
                    协助人 <span className="text-red-500">*</span>
                    <span className="ml-1 text-gray-400">（每位协助人需说明协助内容）</span>
                  </label>
                  <div className="space-y-2">
                    {formAssistants.map((a, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-xl p-3 bg-gray-50/40 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0">#{idx + 1}</span>
                          <select
                            value={a.user_id}
                            onChange={(e) => {
                              const next = [...formAssistants];
                              next[idx] = { ...next[idx], user_id: e.target.value };
                              setFormAssistants(next);
                            }}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white"
                          >
                            <option value="">请选择协助人</option>
                            {profiles
                              .filter((p) => p.id !== form.assigned_to)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name || p.email}
                                </option>
                              ))}
                          </select>
                          <input
                            type="date"
                            value={a.assist_deadline}
                            onChange={(e) => {
                              const next = [...formAssistants];
                              next[idx] = { ...next[idx], assist_deadline: e.target.value };
                              setFormAssistants(next);
                            }}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormAssistants(formAssistants.filter((_, i) => i !== idx))
                            }
                            className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <textarea
                          value={a.assist_content}
                          onChange={(e) => {
                            const next = [...formAssistants];
                            next[idx] = { ...next[idx], assist_content: e.target.value };
                            setFormAssistants(next);
                          }}
                          placeholder="协助内容（必填）：请说明该协助人需要完成的具体事项"
                          rows={2}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-violet-400 resize-none bg-white"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setFormAssistants([
                          ...formAssistants,
                          { user_id: "", assist_content: "", assist_deadline: "" },
                        ])
                      }
                      className="w-full text-xs text-violet-600 border border-dashed border-violet-300 hover:bg-violet-50 rounded-xl py-2 transition flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> 添加协助人
                    </button>
                  </div>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  优先级 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "high",   label: "高", cls: "border-red-300 bg-red-50 text-red-600" },
                    { value: "medium", label: "中", cls: "border-yellow-300 bg-yellow-50 text-yellow-600" },
                    { value: "low",    label: "低", cls: "border-gray-300 bg-gray-50 text-gray-500" },
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

      {/* ══ 阻塞原因弹窗 ══ */}
      {showBlockModal && selectedTask && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <PauseCircle size={16} className="text-orange-500" />
              <h3 className="font-semibold text-gray-900">标记阻塞</h3>
            </div>
            <div className="px-5 py-4 space-y-2">
              <label className="block text-xs text-gray-600">
                阻塞原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="说明任务为何被阻塞，便于创建人协调资源"
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none"
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setReasonInput("");
                }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleBlockConfirm(selectedTask)}
                disabled={!reasonInput.trim() || actionLoading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm py-2 rounded-xl disabled:opacity-50"
              >
                确认标记阻塞
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 审核打回弹窗 ══ */}
      {showRejectModal && selectedTask && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <X size={16} className="text-red-500" />
              <h3 className="font-semibold text-gray-900">审核打回</h3>
            </div>
            <div className="px-5 py-4 space-y-2">
              <label className="block text-xs text-gray-600">
                打回原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="说明需要修改或补充的地方，任务将回到进行中状态"
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none"
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setReasonInput("");
                }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleRejectConfirm(selectedTask)}
                disabled={!reasonInput.trim() || actionLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm py-2 rounded-xl disabled:opacity-50"
              >
                确认打回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
