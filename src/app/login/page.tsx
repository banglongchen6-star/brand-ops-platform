"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Music2, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("账号或密码错误，请重试");
    } else {
      router.push("/dashboard/home");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-indigo-900 to-violet-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-500 flex items-center justify-center mb-4 shadow-lg">
            <Music2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">音乐密码</h1>
          <p className="text-violet-300 text-sm mt-1">品牌经营协同平台</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur rounded-2xl p-6 space-y-4 border border-white/20">
          <div>
            <label className="block text-xs font-medium text-violet-200 mb-1.5">邮箱账号</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              required
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-violet-400 focus:bg-white/15 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-violet-200 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-violet-400 focus:bg-white/15 transition"
            />
          </div>
          {error && (
            <p className="text-red-300 text-xs text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-500 hover:bg-violet-400 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="text-center text-xs text-violet-400 mt-6">
          账号问题请联系系统管理员
        </p>
      </div>
    </div>
  );
}
