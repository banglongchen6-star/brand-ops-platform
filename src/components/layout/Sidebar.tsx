"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  FileVideo,
  Store,
  Headphones,
  BrainCircuit,
  CheckSquare,
  Swords,
  BarChart3,
  Settings,
  LogOut,
  Music2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const navGroups = [
  {
    label: "核心业务",
    items: [
      { href: "/dashboard/home", label: "工作台首页", icon: LayoutDashboard },
      { href: "/dashboard/tasks", label: "工作任务中心", icon: CheckSquare, badge: "今日" },
      { href: "/dashboard/sales", label: "电商销售中心", icon: ShoppingCart },
      { href: "/dashboard/kol", label: "达人营销", icon: Users },
      { href: "/dashboard/content", label: "内容运营", icon: FileVideo },
    ],
  },
  {
    label: "渠道 & 服务",
    items: [
      { href: "/dashboard/channel", label: "渠道分销", icon: Store },
      { href: "/dashboard/service", label: "客服中心", icon: Headphones },
      { href: "/dashboard/competitor", label: "竞品情报中心", icon: Swords },
    ],
  },
  {
    label: "数据 & 智能",
    items: [
      { href: "/dashboard/review", label: "智能复盘中心", icon: BrainCircuit, badge: "AI" },
      { href: "/dashboard/data", label: "数据中心", icon: BarChart3 },
    ],
  },
  {
    label: "设置",
    items: [
      { href: "/dashboard/settings", label: "系统设置", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="flex flex-col w-56 bg-[#1e1b4b] text-white min-h-screen shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
            <Music2 size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">音乐密码</div>
            <div className="text-[10px] text-violet-300 leading-tight">管理后台 v0.1</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-4 mb-1 text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
              {group.label}
            </div>
            {group.items.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-violet-600 text-white"
                      : "text-violet-200 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {badge && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                      badge === "AI"
                        ? "bg-violet-400 text-white"
                        : "bg-violet-500/50 text-violet-200"
                    )}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-violet-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-xs font-bold shrink-0">
            我
          </div>
          <div className="flex-1 text-left">
            <div className="text-xs font-medium text-white">管理员</div>
            <div className="text-[10px] text-violet-400">退出登录</div>
          </div>
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
