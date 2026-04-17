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
  FileText,
  Sparkles,
  Pencil,
  Trash2,
  CheckCheck,
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

// 会议纪要解析出的任务（预览用）
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 导入会议纪要状态
  const [showImport, setShowImport]       = useState(false);
  const [minutesText, setMinutesText]     = useState("");
  const [parsing, setParsing]             = useState(false);
  const [parseError, setParseError]       = useState<string | null>(null);
  const [parsedSummary, setParsedSummary] = useState("");
  // step: "input" → "preview" → done
  const [importStep, setImportStep]       = useState<"input" | "preview">("input");
  const [parsedTasks, setParsedTasks]     = useState<ParsedTask[]>([]);
  const [importing, setImporting]         = useState(false);

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
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("fetchTasks error:", error.message);
    } else {
      setTasks(data || []);
    }
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

  // 解析会议纪要
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
      if (!res.ok) { setParseError(json.error || "解析失败"); return; }
      if (json.tasks.length === 0) {
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

  // 删除预览中某条任务
  function removeParsedTask(idx: number) {
    setParsedTasks(prev => prev.filter((_, i) => i !== idx));
  }

  // 修改预览中某条任务的字段
  function updateParsedTask(idx: number, field: keyof ParsedTask, value: string | null) {
    setParsedTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  }

  // 确认批量导入
  async function handleImportConfirm() {
    if (parsedTasks.length === 0) return;
    setImporting(true);
    const rows = parsedTasks.map(t => ({
      title: t.title,
      description: t.description || null,
      module: t.module || "other",
      assigned_to: t.assigned_to_id || null,
      priority: t.priority || "medium",
      status: "pending",
      due_date: t.due_date || null,
    }));
    const { error } = await supabase.from("tasks").insert(rows);
    if (error) {
      setParseError("导入失败: " + error.message);
    } else {
      setShowImport(false);
      setMinutesText("");
      setImportStep("input");
      setParsedTasks([]);
      setParsedSummary("");
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
                      {task.assigned_to
                        ? (profiles.find(p => p.id === task.assigned_to)?.full_name || "未知用户")
                        : "未分配"}
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

      {/* ══ 导入会议纪要弹窗 ══ */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* 弹窗头部 */}
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
              <button onClick={closeImport}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                <X size={14} />
              </button>
            </div>

            {/* 步骤指示 */}
            <div className="flex items-center gap-0 px-6 pt-4 shrink-0">
              {["粘贴纪要", "确认任务"].map((step, i) => (
                <div key={step} className="flex items-center">
                  <div className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full",
                    (i === 0 && importStep === "input") || (i === 1 && importStep === "preview")
                      ? "bg-violet-600 text-white"
                      : i === 0 && importStep === "preview"
                      ? "bg-violet-100 text-violet-600"
                      : "bg-gray-100 text-gray-400")}>
                    <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">{i + 1}</span>
                    {step}
                  </div>
                  {i < 1 && <div className="w-6 h-px bg-gray-200 mx-1" />}
                </div>
              ))}
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">

              {/* Step 1：输入纪要 */}
              {importStep === "input" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                    💡 将会议纪要文字粘贴到下方，AI 会自动识别任务、负责人、截止日期和优先级
                  </div>
                  <textarea
                    value={minutesText}
                    onChange={e => setMinutesText(e.target.value)}
                    placeholder={`例：\n2026年4月18日 周五 产品周会纪要\n\n议题一：电商平台优化\n- 陈一负责天猫店铺首页改版，下周五前完成\n- 王二跟进京东活动报名，高优先级，4月20日截止\n\n议题二：达人合作\n- 李三联系抖音头部达人，本周内完成初步洽谈`}
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

              {/* Step 2：预览任务 */}
              {importStep === "preview" && (
                <div className="space-y-4">
                  {/* 会议摘要 */}
                  {parsedSummary && (
                    <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-700">
                      <span className="font-semibold">会议摘要：</span>{parsedSummary}
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    共识别到 <span className="font-semibold text-violet-600">{parsedTasks.length}</span> 个任务，可直接编辑后导入：
                  </p>

                  {parsedTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">所有任务已删除</div>
                  ) : (
                    <div className="space-y-3">
                      {parsedTasks.map((t, idx) => (
                        <div key={idx} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 hover:border-violet-200 transition">
                          <div className="flex items-start gap-3">
                            {/* 序号 */}
                            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1 space-y-2 min-w-0">
                              {/* 标题 */}
                              <input
                                value={t.title}
                                onChange={e => updateParsedTask(idx, "title", e.target.value)}
                                className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-violet-400 outline-none pb-0.5"
                              />
                              {/* 说明 */}
                              {t.description && (
                                <p className="text-xs text-gray-500">{t.description}</p>
                              )}
                              {/* 标签行 */}
                              <div className="flex flex-wrap gap-2 items-center">
                                {/* 负责人 */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">负责人：</span>
                                  <select
                                    value={t.assigned_to_id || ""}
                                    onChange={e => {
                                      const p = profiles.find(p => p.id === e.target.value);
                                      updateParsedTask(idx, "assigned_to_id", e.target.value || null);
                                      updateParsedTask(idx, "assigned_to_name", p?.full_name || null);
                                    }}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 bg-white"
                                  >
                                    <option value="">未分配</option>
                                    {profiles.map(p => (
                                      <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                                    ))}
                                  </select>
                                </div>
                                {/* 优先级 */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">优先级：</span>
                                  <select
                                    value={t.priority}
                                    onChange={e => updateParsedTask(idx, "priority", e.target.value)}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 bg-white"
                                  >
                                    <option value="high">高</option>
                                    <option value="medium">中</option>
                                    <option value="low">低</option>
                                  </select>
                                </div>
                                {/* 模块 */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">模块：</span>
                                  <select
                                    value={t.module}
                                    onChange={e => updateParsedTask(idx, "module", e.target.value)}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-violet-400 bg-white"
                                  >
                                    {moduleOptions.map(m => (
                                      <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                  </select>
                                </div>
                                {/* 截止日期 */}
                                {t.due_date && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg">
                                    <Calendar size={11} />
                                    {t.due_date}
                                  </span>
                                )}
                                {/* 优先级标签 */}
                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                                  t.priority === "high" ? "bg-red-50 text-red-600" :
                                  t.priority === "medium" ? "bg-yellow-50 text-yellow-600" :
                                  "bg-gray-50 text-gray-500")}>
                                  {t.priority === "high" ? "高优先" : t.priority === "medium" ? "中优先" : "低优先"}
                                </span>
                              </div>
                            </div>
                            {/* 删除 */}
                            <button onClick={() => removeParsedTask(idx)}
                              className="w-6 h-6 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {parseError && (
                    <div className="bg-red-50 text-red-600 text-xs px-4 py-3 rounded-xl">{parseError}</div>
                  )}
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              {importStep === "input" ? (
                <div className="flex gap-3">
                  <button onClick={closeImport}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition">
                    取消
                  </button>
                  <button
                    onClick={handleParse}
                    disabled={parsing || !minutesText.trim()}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {parsing ? (
                      <><Loader2 size={15} className="animate-spin" />AI 解析中...</>
                    ) : (
                      <><Sparkles size={15} />开始解析</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => { setImportStep("input"); setParseError(null); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                    <Pencil size={14} />
                    重新编辑
                  </button>
                  <button
                    onClick={handleImportConfirm}
                    disabled={importing || parsedTasks.length === 0}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {importing ? (
                      <><Loader2 size={15} className="animate-spin" />导入中...</>
                    ) : (
                      <><CheckCheck size={15} />确认导入 {parsedTasks.length} 个任务</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
