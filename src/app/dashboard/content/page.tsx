import { FileVideo } from "lucide-react";

export default function Page() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">内容运营</h1>
      </div>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-2xl bg-violet-50 flex items-center justify-center mb-6">
          <FileVideo size={36} className="text-violet-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">模块建设中</h2>
        <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
          即将支持热点雷达、选题管理、脚本制作、多平台分发全链路
        </p>
        <div className="mt-6 px-4 py-2 bg-violet-50 rounded-full text-xs text-violet-500 font-medium">
          即将上线
        </div>
      </div>
    </div>
  );
}
