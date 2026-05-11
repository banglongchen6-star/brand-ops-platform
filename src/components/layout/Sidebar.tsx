"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase, roleLabels } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Users, FileVideo, Store,
  Headphones, BrainCircuit, CheckSquare, Swords, BarChart3,
  Settings, LogOut, Music2, PenLine,
} from "lucide-react";

const navGroups = [
  {
    label: "核心业务",
    items: [
      { href: "/dashboard/home",       label: "工作笔记", icon: LayoutDashboard },
      { href: "/dashboard/tasks",      label: "任务中心",   icon: CheckSquare },
      { href: "/dashboard/sales",      label: "电商销售",   icon: ShoppingCart },
      { href: "/dashboard/kol",        label: "达人营销",   icon: Users, landing: "/dashboard/kol/schedule" },
      { href: "/dashboard/content",    label: "内容运营",   icon: FileVideo },
      { href: "/dashboard/articles",   label: "文字内容",   icon: PenLine },
      { href: "/dashboard/channel",    label: "渠道分销",   icon: Store },
      { href: "/dashboard/service",    label: "客服中心",   icon: Headphones },
    ],
  },
  {
    label: "数据 & 智能",
    items: [
      { href: "/dashboard/competitor", label: "竞品情报",   icon: Swords },
      { href: "/dashboard/data",       label: "数据中心",   icon: BarChart3 },
      { href: "/dashboard/review",     label: "AI复盘中心", icon: BrainCircuit },
    ],
  },
  {
    label: "设置",
    items: [
      { href: "/dashboard/settings",   label: "系统设置",   icon: Settings },
    ],
  },
];

interface UserProfile {
  full_name: string | null;
  role: string | null;
}

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const displayName = profile?.full_name || "用户";
  const displayRole = roleLabels[profile?.role || ""] || profile?.role || "成员";
  const avatarChar  = displayName[0]?.toUpperCase() || "U";

  // 当前路径下取「最长前缀匹配」的 href —— 避免 /dashboard/kol 把 /dashboard/kol/schedule 一起激活
  const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    // fixed + h-screen + overflow-y-auto 实现固定侧边栏
    <aside className="fixed top-0 left-0 h-screen w-36 bg-[#1e1b4b] text-white flex flex-col z-40 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 shrink-0">
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
      <nav className="flex-1 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-4 mb-1 text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
              {group.label}
            </div>
            {group.items.map((item) => {
              const { href, label, icon: Icon } = item;
              // 可选 landing：点击落到子路径，但 sidebar 高亮仍以 href 为前缀（如达人营销点击进 /kol/schedule）
              const linkHref = (item as { landing?: string }).landing ?? href;
              const badge = (item as { badge?: string }).badge;
              const active = href === activeHref;
              return (
                <Link
                  key={href}
                  href={linkHref}
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

      {/* 用户信息 + 退出 */}
      <div className="border-t border-white/10 p-3 shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-violet-300 hover:bg-white/10 hover:text-white transition-colors group"
        >
          {/* 头像 */}
          <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-xs font-bold shrink-0">
            {avatarChar}
          </div>
          {/* 姓名 + 角色 */}
          <div className="flex-1 text-left min-w-0">
            <div className="text-xs font-semibold text-white truncate">{displayName}</div>
            <div className="text-[10px] text-violet-400 truncate">{displayRole}</div>
          </div>
          <LogOut size={13} className="shrink-0 opacity-60 group-hover:opacity-100" />
        </button>
      </div>
    </aside>
  );
}
