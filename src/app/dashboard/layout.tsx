import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* ml-44 为固定侧边栏留出空间（侧边栏宽 w-44） */}
      <main className="flex-1 ml-44 overflow-auto min-h-screen">{children}</main>
    </div>
  );
}
