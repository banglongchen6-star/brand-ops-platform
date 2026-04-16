"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { supabase, priorityLabels, taskStatusLabels } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  module: string | null;
  assigned_to: string | null;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
  profiles?: { full_name: string | null } | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

const moduleOptions = [
  { value: "ecommerce", label: "电商销售" },
  { value: "kol", label: "达人营销" },
  { value: "content", label: "内容运营" },
  { value: "channel", label: "渠道分销" },
  { value: "service", label: "客服" },
  { value: "other", label: "其他" },
];

const moduleLabels: Record<string, string> = {
  ecommerce: "电商销售",
  kol: "达人营销",
  content: "内容运营",
  channel: "渠道分销",
  service: "客服",
  other: "其他",
};

const statusFlow: Record<string, string> = {
  pending: "in_progress",
  in_progress: "completed",
  completed: "pending",
  review: "completed",
  overdue: "in_progress",
};

const statusStyles: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

const priorityStyles: Record<string, string> = {
  high: "bg-red-50 text-red-600 border border-red-200",
  medium: "bg-yellow-50 text-yellow-600 border border-yellow-200",
  low: "bg-gray-50 text-gray-500 border border-gray-200",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Circle size={14} />,
  in_progress: <Clock size={14} />,
  review: <TrendingUp size={14} />,
  completed: <CheckCircle2 size={14} />,
  overdue: <AlertCircle size={14} />,
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    module: "ecommerce",
    assigned_to: "",
    priority: "medium",
    due_date: "",
  });

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false });
    if (!error) setTasks(data || []);
    setLoading(false);
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name");
    setProfiles(data || []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      module: form.module,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      status: "pending",
      due_date: form.due_date || null,
    });
    if (error) {
      setFormError(error.message);
    } else {
      setShowModal(false);
      setForm({ title: "", description: "", module: "ecommerce", assigned_to: "", priority: "medium", due_date: "" });
      fetchTasks();
    }
    setSubmitting(false);
  }

  async function cycleStatus(task: Task) {
    const next = statusFlow[task.status || "pending"] || "in_progress";
    const { error } = await supabase
      .from("tasks")
      .update({ status: next })
      .eq("id", task.id);
    if (!error) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
    }
  }

  const filtered = tasks.filter((t) => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchStatus && matchPriority;
  });

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === "completed") return false;
    return new Date(task.due_date) < new Date();
  };

  const stats = {
    total: tasks.length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter((t) => isOverdue(t)).length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare size={24} className="text-violet-600" />
            工作任务中心
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">跟踪和管理全团队的工作任务</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-sm"
        >
          <Plus size={16} />
          新建任务
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "总任务数", value: stats.total, icon: ListTodo, color: "text-violet-600", bg: "bg-violet-50", onClick: () => setStatusFilter("all") },
          { label: "进行中", value: stats.in_progress, icon: Clock, color: "text-blue-600", bg: "bg-blue-50", onClick: () => setStatusFilter("in_progress") },
          { label: "已完成", value: stats.completed, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", onClick: () => setStatusFilter("completed") },
          { label: "已逾期", value: stats.overdue, icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", onClick: () => setStatusFilter("overdue") },
        ].map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-left hover:border-violet-200 transition"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{s.label}</span>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon size={15} className={s.color} />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{s.value}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter size={14} />
            <span className="font-medium">筛选</span>
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">状态：</span>
            <div className="flex gap-1">
              {[
                { value: "all", label: "全部" },
                { value: "pending", label: "待开始" },
                { value: "in_progress", label: "进行中" },
                { value: "review", label: "待审核" },
                { value: "completed", label: "已完成" },
                { value: "overdue", label: "已逾期" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg transition",
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
          {/* Priority filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">优先级：</span>
            <div className="flex gap-1">
              {[
                { value: "all", label: "全部" },
                { value: "high", label: "高" },
                { value: "medium", label: "中" },
                { value: "low", label: "低" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriorityFilter(opt.value)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg transition",
                    priorityFilter === opt.value
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
      </div>

      {/* Task Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            {filtered.length} 项任务
          </span>
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
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs text-gray-400 font-medium bg-gray-50">
              <div className="col-span-4">任务标题</div>
              <div className="col-span-2">所属模块</div>
              <div className="col-span-2">负责人</div>
              <div className="col-span-1">优先级</div>
              <div className="col-span-2">状态</div>
              <div className="col-span-1">截止日期</div>
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map((task) => {
                const overdue = isOverdue(task);
                const displayStatus = overdue && task.status !== "completed" ? "overdue" : (task.status || "pending");
                return (
                  <div key={task.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 transition">
                    {/* Title */}
                    <div className="col-span-4">
                      <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</div>
                      )}
                    </div>

                    {/* Module */}
                    <div className="col-span-2">
                      <span className="text-xs bg-violet-50 text-violet-600 px-2 py-1 rounded-full">
                        {moduleLabels[task.module || ""] || task.module || "—"}
                      </span>
                    </div>

                    {/* Assignee */}
                    <div className="col-span-2 text-sm text-gray-600">
                      {(task.profiles as { full_name: string | null } | null)?.full_name || "未分配"}
                    </div>

                    {/* Priority */}
                    <div className="col-span-1">
                      <span className={cn(
                        "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                        priorityStyles[task.priority || "low"]
                      )}>
                        {priorityLabels[task.priority || ""] || task.priority || "—"}
                      </span>
                    </div>

                    {/* Status - clickable */}
                    <div className="col-span-2">
                      <button
                        onClick={() => cycleStatus(task)}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition hover:opacity-80 cursor-pointer",
                          statusStyles[displayStatus]
                        )}
                        title="点击切换状态"
                      >
                        {statusIcons[displayStatus]}
                        {taskStatusLabels[displayStatus] || displayStatus}
                      </button>
                    </div>

                    {/* Due Date */}
                    <div className={cn(
                      "col-span-1 text-xs flex items-center gap-1",
                      overdue ? "text-red-500 font-medium" : "text-gray-400"
                    )}>
                      {task.due_date ? (
                        <>
                          <Calendar size={11} />
                          {new Date(task.due_date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                        </>
                      ) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Plus size={16} className="text-violet-600" />
                新建任务
              </h3>
              <button
                onClick={() => { setShowModal(false); setFormError(null); }}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">任务标题 *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="简洁描述任务内容"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">任务描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="详细说明任务目标和要求（选填）"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">所属模块</label>
                  <div className="relative">
                    <select
                      value={form.module}
                      onChange={(e) => setForm({ ...form, module: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      {moduleOptions.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">负责人</label>
                  <div className="relative">
                    <select
                      value={form.assigned_to}
                      onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      <option value="">不指定</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">优先级</label>
                  <div className="flex gap-2">
                    {[
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
                          form.priority === p.value ? p.cls : "border-gray-200 text-gray-400 hover:border-gray-300"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">截止日期</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(null); }}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  创建任务
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
