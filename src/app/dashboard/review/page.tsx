"use client";

import { useState, useRef } from "react";
import { BrainCircuit, Sparkles, Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, ArrowRight, FileText, Calendar, Zap, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Simple markdown renderer
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

function boldify(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>');
}

async function callAI(params: { prompt?: string; reportType?: string }, onChunk: (text: string) => void): Promise<void> {
  const res = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error("请求失败，请检查 API Key 配置");
  }

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
        } catch {}
      }
    }
  }
}

export default function ReviewPage() {
  const [activeType, setActiveType] = useState("weekly");
  const [generating, setGenerating] = useState(false);
  const [reportText, setReportText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setGenerating(true);
    setReportText("");
    setError("");
    try {
      await callAI({ reportType: activeType }, (chunk) => {
        setReportText(prev => prev + chunk);
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
        setAnalysisResult(prev => prev + chunk);
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

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">智能复盘中心</h1>
          <p className="text-sm text-gray-500 mt-1">AI 自动生成经营报告，识别风险与机会</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-violet-500 bg-violet-50 px-3 py-1.5 rounded-full">
          <Sparkles size={12} />
          由 Claude AI 提供支持
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* AI 自定义分析 */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-yellow-300" />
          <span className="font-semibold">自定义 AI 分析</span>
        </div>
        <div className="flex gap-2">
          <input
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !analyzing && handleAnalyze()}
            placeholder="问任何经营问题，例如：本周抖音直播数据怎么样？达人合作ROI如何？"
            className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm placeholder:text-white/60 outline-none focus:bg-white/25"
          />
          <button onClick={handleAnalyze} disabled={analyzing || !customPrompt.trim()}
            className="bg-white text-violet-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-violet-50 transition flex items-center gap-1.5 shrink-0 disabled:opacity-60">
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            分析
          </button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {["本周销售总结", "达人ROI分析", "竞品动态分析", "库存预警建议", "利润结构分析", "下周行动计划"].map(tag => (
            <button key={tag} onClick={() => setCustomPrompt(tag)}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition">
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* AI 分析结果 */}
      {(analyzing || analysisResult) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BrainCircuit size={16} className="text-violet-500" />
              <span className="font-semibold text-gray-900">AI 分析结果</span>
              {analyzing && <Loader2 size={14} className="animate-spin text-violet-400 ml-1" />}
            </div>
            {analysisResult && !analyzing && (
              <button onClick={() => handleCopy(analysisResult)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition">
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
            {reportTypes.map(t => (
              <button key={t.key} onClick={() => { setActiveType(t.key); setReportText(""); }}
                className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition",
                  activeType === t.key ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-100")}>
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
            <button onClick={handleGenerate}
              className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 mx-auto">
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
                <button onClick={() => handleCopy(reportText)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-xl transition">
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? "已复制" : "复制报告"}
                </button>
                <button onClick={() => { setReportText(""); }}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-xl transition">
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
