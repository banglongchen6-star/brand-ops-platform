import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* ml-56 为固定侧边栏留出空间 */}
      <main className="flex-1 ml-56 overflow-auto min-h-screen">{children}</main>
    </div>
  );
}
