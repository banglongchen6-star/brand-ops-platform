// 通用「功能正在开发中」占位页
// 用于已下线 / 暂未启用的模块

import { Wrench } from "lucide-react";

export function UnderDevelopment({ moduleName }: { moduleName?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-violet-50 flex items-center justify-center">
          <Wrench size={36} className="text-violet-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">功能正在开发中</h1>
        <p className="text-sm text-gray-500">
          {moduleName ? `「${moduleName}」` : "此模块"} 暂未开放，敬请期待
        </p>
      </div>
    </div>
  );
}
