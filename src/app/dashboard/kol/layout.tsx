"use client";

// 达人营销板块布局：标题 + 「达人列表 / 排期表」tab 栏
// 子页面（page.tsx 和 schedule/page.tsx）只渲染各自内容

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Calendar } from "lucide-react";

export default function KolLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSchedule = pathname === "/dashboard/kol/schedule" || pathname.startsWith("/dashboard/kol/schedule/");

  return (
    <div className="p-6 min-h-screen">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">达人营销</h1>
        <p className="text-sm text-gray-500 mt-1">管理达人资源、合作流程与投放排期</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <TabLink href="/dashboard/kol" active={!isSchedule} icon={Users}>
          达人列表
        </TabLink>
        <TabLink href="/dashboard/kol/schedule" active={isSchedule} icon={Calendar}>
          排期表
        </TabLink>
      </div>

      {children}
    </div>
  );
}

function TabLink({
  href, active, icon: Icon, children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px transition ${
        active
          ? "border-violet-600 text-violet-700 font-medium"
          : "border-transparent text-gray-500 hover:text-gray-900"
      }`}
    >
      <Icon size={15} />
      {children}
    </Link>
  );
}
