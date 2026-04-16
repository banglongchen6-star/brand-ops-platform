"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  ArrowRight, Sparkles, ShoppingCart, Users, FileVideo,
  Store, Bell, Clock, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const platforms = [
  { name: "天猫", gmv: "128,400", trend: 12.3, status: "正常" },
  { name: "京东", gmv: "86,200", trend: -3.1, status: "正常" },
  { name: "抖音", gmv: "203,800", trend: 28.7, status: "正常" },
  { name: "拼多多", gmv: "34,600", trend: 5.2, status: "正常" },
];

const tasks = [
  { title: "跟进抖音达人「音乐小白」寄样进度", module: "达人营销", priority: "高", deadline: "今日", done: false },
  { title: "审核本周内容选题方案", module: "内容运营", priority: "中", deadline: "明日", done: false },
  { title: "更新天猫旗舰店主图Banner", module: "电商销售", priority: "中", deadline: "4月18日", done: true },
  { title: "整理Q2渠道经销商进货计划", module: "渠道分销", priority: "高", deadline: "4月20日", done: false },
];

const aiSuggestions = [
  {
    tag: "风险提醒",
    tagColor: "bg-red-100 text-red-600",
    title: "京东GMV连续3日下滑，需关注",
    desc: "过去3天京东日均GMV环比下降11%，建议检查搜索排名和竞品促销动态。",
    action: "查看数据",
  },
  {
    tag: "机会发现",
    tagColor: "bg-green-100 text-green-600",
    title: "抖音「母亲节」热点匹配度高",
    desc: "音乐密码2代适合母亲节礼物场景，当前热度上升217%，建议提前布局达人合作。",
    action: "创建任务",
  },
  {
    tag: "优化建议",
    tagColor: "bg-blue-100 text-blue-600",
    title: "天猫客服响应时效低于行业均值",
    desc: "近7日平均首响时长14分钟，行业均值8分钟，建议优化客服排班。",
    action: "查看详情",
  },
];

const alerts = [
  { icon: AlertCircle, text: "2个任务今日逾期", color: "text-red-500", bg: "bg-red-50" },
  { icon: Bell, text: "达人「乐器君」已回复合作意向", color: "text-violet-500", bg: "bg-violet-50" },
  { icon: Clock, text: "本周复盘报告待生成", color: "text-orange-500", bg: "bg-orange-50" },
];

function getHour() {
  const h = new Date().getHours();
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function HomePage() {
  const [aiInput, setAiInput] = useState("");
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  const totalGMV = platforms.reduce((s, p) => s + parseFloat(p.gmv.replace(",", "")), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getHour()}，总监 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{today} · 今日有 {tasks.filter(t => !t.done).length} 项待处理任务</p>
        </div>
        <div className="flex items-center gap-2">
          {alerts.map((a, i) => (
            <div key={i} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer", a.bg, a.color)}>
              <a.icon size={12} />
              {a.text}
            </div>
          ))}
        </div>
      </div>

      {/* AI 输入框 */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-yellow-300" />
          <span className="text-sm font-medium">让 AI 帮你分析经营数据，给出建议</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="例：上周抖音直播数据怎么样？有哪些可以优化的地方？"
            className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/60 outline-none focus:bg-white/25"
          />
          <button className="bg-white text-violet-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-violet-50 transition flex items-center gap-1.5 shrink-0">
            <Zap size={14} />
            分析
          </button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {["本周销售总结", "达人ROI分析", "竞品动态", "库存预警", "利润分析"].map((tag) => (
            <button
              key={tag}
              onClick={() => setAiInput(tag)}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "今日总GMV", value: `¥${(totalGMV / 10000).toFixed(1)}万`, trend: 15.2, icon: ShoppingCart, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "今日订单量", value: "1,284", trend: 8.3, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "达人合作中", value: "23人", trend: 4, icon: Users, color: "text-green-600", bg: "bg-green-50" },
          { label: "内容发布中", value: "6条", trend: -1, icon: FileVideo, color: "text-orange-600", bg: "bg-orange-50" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{item.label}</span>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", item.bg)}>
                <item.icon size={15} className={item.color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{item.value}</div>
            <div className={cn("flex items-center gap-1 text-xs", item.trend >= 0 ? "text-green-600" : "text-red-500")}>
              {item.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(item.trend)}% 较昨日
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* 各平台 GMV */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">各平台今日GMV</h3>
            <button className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
              详情 <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {platforms.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                  {p.name[0]}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{p.name}</span>
                    <span className="font-semibold text-gray-900">¥{p.gmv}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${(parseFloat(p.gmv.replace(",", "")) / 210000) * 100}%` }}
                    />
                  </div>
                </div>
                <span className={cn("text-xs font-medium shrink-0", p.trend >= 0 ? "text-green-600" : "text-red-500")}>
                  {p.trend >= 0 ? "+" : ""}{p.trend}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI 分析建议 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-violet-500" />
              <h3 className="font-semibold text-gray-900">AI 今日经营洞察</h3>
            </div>
            <span className="text-xs text-gray-400">基于实时数据 · 刚刚更新</span>
          </div>
          <div className="space-y-3">
            {aiSuggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5", s.tagColor)}>
                  {s.tag}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">{s.title}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{s.desc}</div>
                </div>
                <button className="text-xs text-violet-600 hover:underline shrink-0 flex items-center gap-0.5 mt-0.5">
                  {s.action} <ArrowRight size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 今日待办 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">今日待办</h3>
          <button className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
            全部任务 <ArrowRight size={12} />
          </button>
        </div>
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className={cn("flex items-center gap-3 p-3 rounded-xl transition", task.done ? "opacity-50" : "hover:bg-gray-50")}>
              <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                task.done ? "border-green-500 bg-green-500" : "border-gray-300"
              )}>
                {task.done && <CheckCircle2 size={12} className="text-white" />}
              </div>
              <span className={cn("flex-1 text-sm", task.done ? "line-through text-gray-400" : "text-gray-700")}>
                {task.title}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{task.module}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                task.priority === "高" ? "bg-red-50 text-red-500" : "bg-yellow-50 text-yellow-600"
              )}>
                {task.priority}
              </span>
              <span className="text-xs text-gray-400 w-16 text-right">{task.deadline}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
