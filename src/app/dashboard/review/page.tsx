"use client";

import { useState, useRef, useEffect } from "react";
import {
  BrainCircuit,
  Sparkles,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  Calendar,
  Zap,
  Copy,
  Check,
  MessageSquare,
  Send,
  Trash2,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DataCounts {
  sales: number;
  tasks: number;
  kols: number;
  channels: number;
  tickets: number;
  competitors: number;
}

// ─── Report types ─────────────────────────────────────────────────────────────

const reportTypes = [
  { key: "daily", label: "日报", icon: Calendar },
  { key: "weekly", label: "周报", icon: FileText },
  { key: "monthly", label: "月报", icon: TrendingUp },
];

const sampleInsights = [
  { type: "risk", label: "风险", color: "bg-red-50 border-red-100 text-red-700", dot: "bg-red-500", text: "京东GMV连续3日环比下滑，累计下降约18%，建议检查竞品促销动态和搜索排名变化。" },
  { type: "opportunity", label: "机会", color: "bg-green-50 border-green-100 text-green-700", dot: "bg-green-500", text: "抖音本周GMV增速+28.7%，超出行业均值12个百分点，直播转化率提升明显，建议加大投入。" },
  { type: "suggestion", label: "建议", color: "bg-blue-50 border-blue-100 text-blue-700", dot: "bg-blue-500", text: "客服首响时长14分钟，高于行业均值8分钟，建议优化客服排班，增加高峰时段值班人数。" },
  { type: "suggestion", label: "建议", color: "bg-blue-50 border-blue-100 text-blue-700", dot: "bg-blue-500", text: "本周达人内容发布12条，其中3条播放量超10万，建议复制爆款内容结构，扩大投放规模。" },
];

// ─── Markdown renderer ────────────────────────────────────────────────────────

function boldify(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>');
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <h3 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-sm">{line.slice(4)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={i} className="font-bold text-gray-900 mt-4 mb-2 text-base">{line.slice(3)}</h2>;
        }
        if (line.startsWith("# ")) {
          return <h1 key={i} className="font-bold text-gray-900 mt-4 mb-2 text-lg">{line.slice(2)}</h1>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.slice(2);
          return (
            <div key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-violet-400 mt-1">•</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
            </div>
          );
        }
        if (/^\d+\. /.test(line)) {
          const match = line.match(/^(\d+)\. (.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-violet-500 font-medium shrink-0">{match[1]}.</span>
                <span dangerouslySetInnerHTML={{ __html: boldify(match[2]) }} />
              </div>
            );
          }
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: boldify(line) }} />;
      })}
    </div>
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAndBuildContext(): Promise<{ context: string; counts: DataCounts }> {
  const [salesRes, tasksRes, kolsRes, channelsRes, ticketsRes, competitorsRes] =
    await Promise.all([
      supabase.from("sales_data").select("*").order("date", { ascending: false }).limit(60),
      supabase.from("tasks").select("*").limit(100),
      supabase.from("kols").select("*").limit(50),
      supabase.from("channels").select("*").limit(50),
      supabase.from("service_tickets").select("*").limit(100),
      supabase.from("competitors").select("*").limit(20),
    ]);

  const sales = salesRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const kols = kolsRes.data ?? [];
  const channels = channelsRes.data ?? [];
  const tickets = ticketsRes.data ?? [];
  const competitors = competitorsRes.data ?? [];

  const counts: DataCounts = {
    sales: sales.length,
    tasks: tasks.length,
    kols: kols.length,
    channels: channels.length,
    tickets: tickets.length,
    competitors: competitors.length,
  };

  // ── Sales summary by platform ──
  let salesSection = "### 销售数据（最近记录）\n";
  if (sales.length === 0) {
    salesSection += "暂无销售数据\n";
  } else {
    const byPlatform: Record<string, { gmv: number; orders: number; count: number }> = {};
    for (const row of sales) {
      const p = (row.platform as string) || "其他";
      if (!byPlatform[p]) byPlatform[p] = { gmv: 0, orders: 0, count: 0 };
      byPlatform[p].gmv += Number(row.gmv) || 0;
      byPlatform[p].orders += Number(row.orders) || 0;
      byPlatform[p].count += 1;
    }
    for (const [platform, data] of Object.entries(byPlatform)) {
      salesSection += `- ${platform}：GMV ¥${data.gmv.toLocaleString()}，订单 ${data.orders} 单，共 ${data.count} 条记录\n`;
    }
    const latestDates = sales.slice(0, 3).map((r) => r.date).filter(Boolean);
    if (latestDates.length) salesSection += `（最新数据日期：${latestDates[0]}）\n`;
  }

  // ── Tasks ──
  let tasksSection = "\n### 任务数据\n";
  if (tasks.length === 0) {
    tasksSection += "暂无任务数据\n";
  } else {
    const statusCount: Record<string, number> = {};
    for (const t of tasks) {
      const s = (t.status as string) || "unknown";
      statusCount[s] = (statusCount[s] || 0) + 1;
    }
    const statusLabels: Record<string, string> = {
      pending: "待开始",
      in_progress: "进行中",
      review: "待审核",
      completed: "已完成",
      overdue: "已逾期",
    };
    for (const [s, c] of Object.entries(statusCount)) {
      tasksSection += `- ${statusLabels[s] || s}：${c} 个\n`;
    }
    const overdue = tasks.filter((t) => t.status === "overdue");
    if (overdue.length) {
      tasksSection += `逾期任务：${overdue.map((t) => t.title).slice(0, 3).join("、")}\n`;
    }
  }

  // ── KOLs ──
  let kolsSection = "\n### 达人数据\n";
  if (kols.length === 0) {
    kolsSection += "暂无达人数据\n";
  } else {
    const active = kols.filter((k) => k.status === "active" || k.status === "cooperating");
    kolsSection += `共 ${kols.length} 位达人，活跃合作 ${active.length} 位\n`;
    const top = [...kols]
      .sort((a, b) => (Number(b.follower_count) || 0) - (Number(a.follower_count) || 0))
      .slice(0, 5);
    for (const k of top) {
      const followers = Number(k.follower_count) || 0;
      const avgGmv = Number(k.avg_gmv) || 0;
      kolsSection += `- ${k.name}（${k.platform || "-"}）：粉丝 ${followers >= 10000 ? (followers / 10000).toFixed(1) + "万" : followers}，平均带货 ¥${avgGmv.toLocaleString()}，状态：${k.status || "-"}\n`;
    }
  }

  // ── Channels ──
  let channelsSection = "\n### 渠道数据\n";
  if (channels.length === 0) {
    channelsSection += "暂无渠道数据\n";
  } else {
    const stores = channels.filter((c) => c.type === "store");
    const agents = channels.filter((c) => c.type === "agent");
    channelsSection += `门店 ${stores.length} 个，代理商 ${agents.length} 个\n`;
    const top = [...channels]
      .sort((a, b) => (Number(b.monthly_gmv) || 0) - (Number(a.monthly_gmv) || 0))
      .slice(0, 5);
    for (const c of top) {
      const gmv = Number(c.monthly_gmv) || 0;
      channelsSection += `- ${c.name}（${c.region || "-"}）：月GMV ¥${gmv.toLocaleString()}，状态：${c.status || "-"}\n`;
    }
  }

  // ── Service tickets ──
  let ticketsSection = "\n### 客服工单数据\n";
  if (tickets.length === 0) {
    ticketsSection += "暂无工单数据\n";
  } else {
    const statusCount: Record<string, number> = {};
    for (const t of tickets) {
      const s = (t.status as string) || "unknown";
      statusCount[s] = (statusCount[s] || 0) + 1;
    }
    for (const [s, c] of Object.entries(statusCount)) {
      ticketsSection += `- ${s}：${c} 单\n`;
    }
    const highPriority = tickets.filter((t) => t.priority === "high" && t.status !== "resolved");
    if (highPriority.length) {
      ticketsSection += `高优先级未解决：${highPriority.length} 单\n`;
    }
  }

  // ── Competitors ──
  let competitorsSection = "\n### 竞品数据\n";
  if (competitors.length === 0) {
    competitorsSection += "暂无竞品数据\n";
  } else {
    for (const c of competitors) {
      const gmv = Number(c.monthly_est_gmv) || 0;
      competitorsSection += `- ${c.name}（${c.platform || "-"}）：价格区间 ${c.price_range || "-"}，月估算GMV ¥${gmv.toLocaleString()}`;
      if (c.strengths) competitorsSection += `，优势：${c.strengths}`;
      competitorsSection += "\n";
    }
  }

  const context = [
    "以下是音乐密码公司当前系统中的真实业务数据，请基于这些数据进行分析：\n",
    salesSection,
    tasksSection,
    kolsSection,
    channelsSection,
    ticketsSection,
    competitorsSection,
  ].join("");

  return { context, counts };
}

// ─── Simple AI call (existing behavior) ──────────────────────────────────────

async function callAI(
  params: { prompt?: string; reportType?: string },
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) throw new Error("请求失败，请检查 API Key 配置");

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) onChunk(parsed.text);
          if (parsed.error) throw new Error(parsed.error);
        } catch { /* ignore parse errors for partial chunks */ }
      }
    }
  }
}

// ─── Deep chat AI call ────────────────────────────────────────────────────────

async function callDeepChat(
  messages: ChatMessage[],
  dataContext: string,
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, dataContext }),
  });

  if (!res.ok) throw new Error("请求失败，请检查 API Key 配置");

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) onChunk(parsed.text);
          if (parsed.error) throw new Error(parsed.error);
        } catch { /* ignore parse errors */ }
      }
    }
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  // Deep chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState<"idle" | "fetching" | "thinking">("idle");
  const [dataCounts, setDataCounts] = useState<DataCounts | null>(null);
  const [chatError, setChatError] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Simple / report state
  const [activeType, setActiveType] = useState("weekly");
  const [generating, setGenerating] = useState(false);
  const [reportText, setReportText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // ── Deep chat send ──
  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    setChatInput("");
    setChatError("");
    setChatLoading(true);

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);

    try {
      // Step 1: fetch data
      setChatStatus("fetching");
      const { context, counts } = await fetchAndBuildContext();
      setDataCounts(counts);

      // Step 2: stream AI response
      setChatStatus("thinking");

      // Add a placeholder assistant message for streaming
      const assistantMsg: ChatMessage = { role: "assistant", content: "" };
      setChatMessages([...nextMessages, assistantMsg]);

      let accumulated = "";
      await callDeepChat(nextMessages, context, (chunk) => {
        accumulated += chunk;
        setChatMessages([...nextMessages, { role: "assistant", content: accumulated }]);
      });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "分析失败，请稍后重试");
      // Remove the empty assistant placeholder if it was added
      setChatMessages(nextMessages);
    } finally {
      setChatLoading(false);
      setChatStatus("idle");
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setDataCounts(null);
    setChatError("");
  };

  // ── Simple / report handlers ──
  const handleGenerate = async () => {
    setGenerating(true);
    setReportText("");
    setError("");
    try {
      await callAI({ reportType: activeType }, (chunk) => {
        setReportText((prev) => prev + chunk);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!customPrompt.trim()) return;
    setAnalyzing(true);
    setAnalysisResult("");
    setError("");
    try {
      await callAI({ prompt: customPrompt }, (chunk) => {
        setAnalysisResult((prev) => prev + chunk);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusLabel =
    chatStatus === "fetching"
      ? "正在读取系统数据..."
      : chatStatus === "thinking"
      ? "AI 分析中..."
      : "";

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI复盘中心</h1>
          <p className="text-sm text-gray-500 mt-1">AI 自动生成经营报告，识别风险与机会</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-violet-500 bg-violet-50 px-3 py-1.5 rounded-full">
          <Sparkles size={12} />
          由 Claude AI 提供支持
        </div>
      </div>

      {/* ═══ DEEP AI CHAT SECTION ═══════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
              <MessageSquare size={16} className="text-white" />
            </div>
            <div>
              <span className="font-semibold text-gray-900 text-sm">深度 AI 分析</span>
              <p className="text-xs text-gray-500">基于真实数据的多轮对话分析</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dataCounts && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-100 px-3 py-1.5 rounded-full">
                <Database size={11} className="text-violet-400" />
                <span>
                  本次分析基于：{dataCounts.sales} 条销售记录 · {dataCounts.tasks} 个任务 · {dataCounts.kols} 个达人 · {dataCounts.channels} 个渠道
                </span>
              </div>
            )}
            {chatMessages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-full transition"
              >
                <Trash2 size={12} />
                清空对话
              </button>
            )}
          </div>
        </div>

        {/* Chat messages area */}
        <div className="h-[420px] overflow-y-auto px-5 py-4 space-y-4 bg-gray-50/40">
          {chatMessages.length === 0 && !chatLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                <BrainCircuit size={26} className="text-violet-500" />
              </div>
              <div>
                <p className="text-gray-700 font-medium text-sm">向 AI 提问任何经营问题</p>
                <p className="text-gray-400 text-xs mt-1">AI 会先读取系统真实数据，再给出深度分析</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {[
                  "分析一下当前整体销售情况",
                  "哪个渠道表现最好？",
                  "有哪些紧急任务需要处理？",
                  "达人合作效果怎么样？",
                  "竞品有哪些值得关注的动向？",
                  "客服工单有什么问题？",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setChatInput(q)}
                    className="text-xs bg-white border border-violet-100 text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-full transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <BrainCircuit size={14} className="text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-3",
                  msg.role === "user"
                    ? "bg-violet-600 text-white text-sm"
                    : "bg-white border border-gray-100 shadow-sm"
                )}
              >
                {msg.role === "user" ? (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                ) : msg.content ? (
                  <MarkdownText text={msg.content} />
                ) : (
                  // Empty assistant bubble = streaming not yet started
                  <div className="flex items-center gap-1.5 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator (before first assistant token) */}
          {chatLoading && statusLabel && chatMessages[chatMessages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <BrainCircuit size={14} className="text-white" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 size={13} className="animate-spin text-violet-500" />
                <span className="text-xs text-gray-500">{statusLabel}</span>
              </div>
            </div>
          )}

          {chatError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs px-4 py-2.5 rounded-xl">
              <AlertCircle size={13} />
              {chatError}
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Chat input */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white">
          <div className="flex gap-3 items-end">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="输入问题，按 Enter 发送（Shift+Enter 换行）"
              rows={2}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 placeholder:text-gray-400 transition"
              disabled={chatLoading}
            />
            <button
              onClick={handleChatSend}
              disabled={chatLoading || !chatInput.trim()}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition"
            >
              {chatLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">每次发送前自动读取最新系统数据</p>
        </div>
      </div>
      {/* ═══ END DEEP AI CHAT ════════════════════════════════════════════════ */}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* AI 自定义分析 (quick, simple mode) */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-yellow-300" />
          <span className="font-semibold">快速分析</span>
        </div>
        <div className="flex gap-2">
          <input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !analyzing && handleAnalyze()}
            placeholder="快速提问，无需数据上下文，例如：如何提升抖音直播转化率？"
            className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm placeholder:text-white/60 outline-none focus:bg-white/25"
          />
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !customPrompt.trim()}
            className="bg-white text-violet-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-violet-50 transition flex items-center gap-1.5 shrink-0 disabled:opacity-60"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            分析
          </button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {["本周销售总结", "达人ROI分析", "竞品动态分析", "库存预警建议", "利润结构分析", "下周行动计划"].map((tag) => (
            <button
              key={tag}
              onClick={() => setCustomPrompt(tag)}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Quick analysis result */}
      {(analyzing || analysisResult) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BrainCircuit size={16} className="text-violet-500" />
              <span className="font-semibold text-gray-900">AI 分析结果</span>
              {analyzing && <Loader2 size={14} className="animate-spin text-violet-400 ml-1" />}
            </div>
            {analysisResult && !analyzing && (
              <button
                onClick={() => handleCopy(analysisResult)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? "已复制" : "复制"}
              </button>
            )}
          </div>
          {analyzing && !analysisResult ? (
            <div className="space-y-2">
              {[80, 60, 90, 45].map((w, i) => (
                <div key={i} className="h-3 bg-violet-100 rounded-full animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <MarkdownText text={analysisResult} />
          )}
        </div>
      )}

      {/* 报告生成 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-violet-500" />
            <span className="font-semibold text-gray-900">自动生成报告</span>
          </div>
          <div className="flex gap-2">
            {reportTypes.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveType(t.key); setReportText(""); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                  activeType === t.key ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {!reportText && !generating ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BrainCircuit size={28} className="text-violet-400" />
            </div>
            <p className="text-gray-500 text-sm mb-2">
              点击生成本{activeType === "daily" ? "日" : activeType === "weekly" ? "周" : "月"}经营报告
            </p>
            <p className="text-gray-400 text-xs mb-5">AI 将结合音乐密码产品特点和电商运营规律，自动分析并给出建议</p>
            <button
              onClick={handleGenerate}
              className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 mx-auto"
            >
              <Sparkles size={14} />
              生成{activeType === "daily" ? "日" : activeType === "weekly" ? "周" : "月"}报
            </button>
          </div>
        ) : (
          <div>
            <div className="bg-gray-50 rounded-xl p-5 min-h-[120px]">
              {generating && !reportText && (
                <div className="space-y-2">
                  {[75, 55, 85, 40, 65].map((w, i) => (
                    <div key={i} className="h-3 bg-violet-100 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
              <MarkdownText text={reportText} />
              {generating && (
                <span className="inline-block w-1 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
            {!generating && reportText && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleCopy(reportText)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-xl transition"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? "已复制" : "复制报告"}
                </button>
                <button
                  onClick={() => setReportText("")}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-xl transition"
                >
                  重新生成
                </button>
                <button className="flex items-center gap-1.5 text-sm bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 transition">
                  <CheckCircle2 size={14} /> 归档保存
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI 经营洞察 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-500" />
            <span className="font-semibold text-gray-900">本周 AI 经营洞察</span>
          </div>
          <span className="text-xs text-gray-400">基于近7天数据</span>
        </div>
        <div className="space-y-3">
          {sampleInsights.map((insight, i) => (
            <div key={i} className={cn("flex items-start gap-3 p-4 rounded-xl border", insight.color)}>
              <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", insight.dot)} />
              <div className="flex-1">
                <span className="text-xs font-bold mr-2">[{insight.label}]</span>
                <span className="text-sm">{insight.text}</span>
              </div>
              <button className="text-xs font-medium flex items-center gap-0.5 shrink-0 hover:underline">
                转为任务 <ArrowRight size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 关键指标趋势 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "本周GMV", value: "¥45.3万", change: 15.2, up: true },
          { label: "达人合作ROI", value: "3.2x", change: -21.9, up: false },
          { label: "内容发布量", value: "12条", change: 20, up: true },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-2">{m.label}</div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{m.value}</div>
            <div className={cn("flex items-center gap-1 text-xs", m.up ? "text-green-600" : "text-red-500")}>
              {m.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(m.change)}% 较上周
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
