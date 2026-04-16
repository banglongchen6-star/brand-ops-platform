"use client";

import { useState, useEffect } from "react";
import {
  Headphones,
  Plus,
  X,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  Search,
} from "lucide-react";
import { supabase, platformLabels } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type TicketType = "all" | "presale" | "aftersale" | "return" | "complaint";
type TicketStatus = "all" | "open" | "processing" | "resolved" | "closed";

interface Ticket {
  id: string;
  type: "presale" | "aftersale" | "return" | "complaint";
  platform: string;
  order_no: string | null;
  customer_name: string;
  description: string;
  status: "open" | "processing" | "resolved" | "closed";
  assignee: string | null;
  result: string | null;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  presale: "售前咨询",
  aftersale: "售后处理",
  return: "退货退款",
  complaint: "投诉",
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  open: {
    label: "待处理",
    color: "bg-amber-100 text-amber-700",
    icon: <AlertCircle size={12} />,
  },
  processing: {
    label: "处理中",
    color: "bg-blue-100 text-blue-700",
    icon: <Clock size={12} />,
  },
  resolved: {
    label: "已解决",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 size={12} />,
  },
  closed: {
    label: "已关闭",
    color: "bg-gray-100 text-gray-600",
    icon: <XCircle size={12} />,
  },
};

const typeTabConfig = [
  { key: "all" as TicketType, label: "全部" },
  { key: "presale" as TicketType, label: "售前咨询" },
  { key: "aftersale" as TicketType, label: "售后处理" },
  { key: "return" as TicketType, label: "退货退款" },
  { key: "complaint" as TicketType, label: "投诉" },
];

const statusOptions = [
  { key: "all" as TicketStatus, label: "全部状态" },
  { key: "open" as TicketStatus, label: "待处理" },
  { key: "processing" as TicketStatus, label: "处理中" },
  { key: "resolved" as TicketStatus, label: "已解决" },
  { key: "closed" as TicketStatus, label: "已关闭" },
];

const platformOptions = [
  { value: "tianmao", label: "天猫" },
  { value: "jingdong", label: "京东" },
  { value: "douyin", label: "抖音" },
  { value: "pinduoduo", label: "拼多多" },
];

export default function ServicePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<TicketType>("all");
  const [activeStatus, setActiveStatus] = useState<TicketStatus>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailResult, setDetailResult] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    type: "presale",
    platform: "tianmao",
    order_no: "",
    customer_name: "",
    description: "",
    assignee: "",
  });

  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    processing: 0,
    resolvedThisMonth: 0,
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTickets(data as Ticket[]);
      const now = new Date();
      const thisMonth = data.filter((t) => {
        const d = new Date(t.created_at);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      });
      setStats({
        total: data.length,
        open: data.filter((t) => t.status === "open").length,
        processing: data.filter((t) => t.status === "processing").length,
        resolvedThisMonth: thisMonth.filter((t) => t.status === "resolved")
          .length,
      });
    }
    setLoading(false);
  }

  const filtered = tickets.filter((t) => {
    const typeMatch = activeType === "all" || t.type === activeType;
    const statusMatch = activeStatus === "all" || t.status === activeStatus;
    return typeMatch && statusMatch;
  });

  async function handleCreate() {
    if (!form.customer_name || !form.description) return;
    setSubmitting(true);
    const { error } = await supabase.from("service_tickets").insert([
      {
        type: form.type,
        platform: form.platform,
        order_no: form.order_no || null,
        customer_name: form.customer_name,
        description: form.description,
        assignee: form.assignee || null,
        status: "open",
      },
    ]);
    setSubmitting(false);
    if (!error) {
      setShowCreateModal(false);
      setForm({
        type: "presale",
        platform: "tianmao",
        order_no: "",
        customer_name: "",
        description: "",
        assignee: "",
      });
      fetchTickets();
    }
  }

  async function handleStatusAdvance(ticket: Ticket) {
    const next: Record<string, string> = {
      open: "processing",
      processing: "resolved",
    };
    const nextStatus = next[ticket.status];
    if (!nextStatus) return;
    await supabase
      .from("service_tickets")
      .update({ status: nextStatus })
      .eq("id", ticket.id);
    fetchTickets();
  }

  async function handleSaveResult() {
    if (!selectedTicket) return;
    setSubmitting(true);
    await supabase
      .from("service_tickets")
      .update({ result: detailResult })
      .eq("id", selectedTicket.id);
    setSubmitting(false);
    setShowDetailModal(false);
    fetchTickets();
  }

  function openDetail(ticket: Ticket) {
    setSelectedTicket(ticket);
    setDetailResult(ticket.result || "");
    setShowDetailModal(true);
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客服中心</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理售前售后工单，跟踪处理进度
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus size={16} />
          新建工单
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "总工单数",
            value: stats.total,
            color: "text-violet-600",
            bg: "bg-violet-50",
            icon: <Headphones size={20} className="text-violet-500" />,
          },
          {
            label: "待处理",
            value: stats.open,
            color: "text-amber-600",
            bg: "bg-amber-50",
            icon: <AlertCircle size={20} className="text-amber-500" />,
          },
          {
            label: "处理中",
            value: stats.processing,
            color: "text-blue-600",
            bg: "bg-blue-50",
            icon: <Clock size={20} className="text-blue-500" />,
          },
          {
            label: "本月已解决",
            value: stats.resolvedThisMonth,
            color: "text-green-600",
            bg: "bg-green-50",
            icon: <CheckCircle2 size={20} className="text-green-500" />,
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", s.bg)}>
              {s.icon}
            </div>
            <div>
              <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Type Tabs + Status Filter */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 border-b border-gray-100">
          <div className="flex gap-1">
            {typeTabConfig.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveType(tab.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2",
                  activeType === tab.key
                    ? "border-violet-600 text-violet-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2">
            <select
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value as TicketStatus)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              {statusOptions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="animate-spin w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full mr-2" />
              加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Search size={32} className="mb-2 opacity-40" />
              <p className="text-sm">暂无工单数据</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-3 font-medium">类型</th>
                  <th className="text-left px-4 py-3 font-medium">平台</th>
                  <th className="text-left px-4 py-3 font-medium">订单号</th>
                  <th className="text-left px-4 py-3 font-medium">客户姓名</th>
                  <th className="text-left px-4 py-3 font-medium w-48">问题描述</th>
                  <th className="text-left px-4 py-3 font-medium">状态</th>
                  <th className="text-left px-4 py-3 font-medium">负责人</th>
                  <th className="text-left px-4 py-3 font-medium">创建时间</th>
                  <th className="text-left px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((ticket) => {
                  const sc = statusConfig[ticket.status];
                  return (
                    <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            ticket.type === "presale" && "bg-violet-100 text-violet-700",
                            ticket.type === "aftersale" && "bg-blue-100 text-blue-700",
                            ticket.type === "return" && "bg-orange-100 text-orange-700",
                            ticket.type === "complaint" && "bg-red-100 text-red-700"
                          )}
                        >
                          {typeLabels[ticket.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {platformLabels[ticket.platform] || ticket.platform}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {ticket.order_no || "-"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {ticket.customer_name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[180px]">
                        <span className="line-clamp-1" title={ticket.description}>
                          {ticket.description}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            sc.color
                          )}
                        >
                          {sc.icon}
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {ticket.assignee || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(ticket.created_at).toLocaleDateString("zh-CN")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDetail(ticket)}
                            className="text-violet-600 hover:text-violet-800 text-xs flex items-center gap-1"
                          >
                            <Eye size={13} />
                            详情
                          </button>
                          {(ticket.status === "open" ||
                            ticket.status === "processing") && (
                            <button
                              onClick={() => handleStatusAdvance(ticket)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              {ticket.status === "open"
                                ? "开始处理"
                                : "标记解决"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">新建工单</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    工单类型 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  >
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    平台
                  </label>
                  <select
                    value={form.platform}
                    onChange={(e) =>
                      setForm({ ...form, platform: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  >
                    {platformOptions.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  订单号
                </label>
                <input
                  type="text"
                  value={form.order_no}
                  onChange={(e) =>
                    setForm({ ...form, order_no: e.target.value })
                  }
                  placeholder="选填"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) =>
                    setForm({ ...form, customer_name: e.target.value })
                  }
                  placeholder="请输入客户姓名"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  问题描述 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  placeholder="请描述客户问题"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  负责人
                </label>
                <input
                  type="text"
                  value={form.assignee}
                  onChange={(e) =>
                    setForm({ ...form, assignee: e.target.value })
                  }
                  placeholder="选填"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !form.customer_name || !form.description}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "提交中..." : "创建工单"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">工单详情</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">类型：</span>
                  <span className="font-medium">{typeLabels[selectedTicket.type]}</span>
                </div>
                <div>
                  <span className="text-gray-500">平台：</span>
                  <span className="font-medium">
                    {platformLabels[selectedTicket.platform] || selectedTicket.platform}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">客户：</span>
                  <span className="font-medium">{selectedTicket.customer_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">订单号：</span>
                  <span className="font-medium">{selectedTicket.order_no || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500">状态：</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      statusConfig[selectedTicket.status].color
                    )}
                  >
                    {statusConfig[selectedTicket.status].label}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">负责人：</span>
                  <span className="font-medium">{selectedTicket.assignee || "-"}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">问题描述</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">
                  {selectedTicket.description}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  处理结果
                </label>
                <textarea
                  value={detailResult}
                  onChange={(e) => setDetailResult(e.target.value)}
                  rows={3}
                  placeholder="请填写处理结果..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:text-gray-800"
              >
                关闭
              </button>
              <button
                onClick={handleSaveResult}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {submitting ? "保存中..." : "保存处理结果"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
