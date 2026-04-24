"use client";

import Link from "next/link";
import {
  Sparkles,
  Users,
  ClipboardCheck,
  Send,
  BarChart3,
  MessageCircle,
  ArrowRight,
} from "lucide-react";

const modules = [
  {
    href: "/dashboard/content/workspace",
    title: "内容工作台",
    desc: "热点/爆款 → AI创作 → 审核发布 → 复盘 的一体化工作台",
    icon: Sparkles,
    color: "bg-amber-50 text-amber-600",
    featured: true,
  },
  {
    href: "/dashboard/content/accounts",
    title: "账号矩阵",
    desc: "管理全平台运营账号，统一查看粉丝与定位",
    icon: Users,
    color: "bg-blue-50 text-blue-600",
  },
  {
    href: "/dashboard/tasks?module=content",
    title: "审核流转",
    desc: "内容审核流程走任务中心，统一管理",
    icon: ClipboardCheck,
    color: "bg-purple-50 text-purple-600",
  },
  {
    href: "/dashboard/content/distribute",
    title: "分发中心",
    desc: "排期发布，追踪各平台分发状态",
    icon: Send,
    color: "bg-teal-50 text-teal-600",
  },
  {
    href: "/dashboard/content/review",
    title: "内容复盘",
    desc: "聚合内容数据表现，AI 生成复盘报告",
    icon: BarChart3,
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    href: "/dashboard/content/comments",
    title: "评论运营",
    desc: "统一管理评论区互动，提炼用户反馈",
    icon: MessageCircle,
    color: "bg-pink-50 text-pink-600",
  },
];

export default function ContentOverviewPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">内容运营</h1>
        <p className="mt-1 text-sm text-gray-500">
          从热点挖掘到复盘沉淀的全链路内容生产中心
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`group relative flex flex-col rounded-xl border bg-white p-5 transition hover:shadow-md ${
                m.featured
                  ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white md:col-span-2 lg:col-span-2"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${m.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-900">
                {m.title}
                {m.featured && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">核心</span>}
              </h3>
              <p className="text-xs leading-relaxed text-gray-500">{m.desc}</p>
              <ArrowRight className="absolute right-4 top-5 h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-600" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
