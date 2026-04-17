"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Music2, Loader2, Eye, EyeOff } from "lucide-react";

const REMEMBER_KEY = "music_ops_remember";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 页面加载时读取已保存的账号密码
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const { email: e, password: p } = JSON.parse(saved);
        setEmail(e || "");
        setPassword(p || "");
        setRemember(true);
      }
    } catch {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 保存或清除记住的账号密码
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

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
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pr-11 text-sm text-white placeholder:text-white/40 outline-none focus:border-violet-400 focus:bg-white/15 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 记住账号密码 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRemember(!remember)}
              className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 ${
                remember
                  ? "bg-violet-500 border-violet-400"
                  : "bg-white/10 border-white/30"
              }`}
            >
              {remember && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span
              onClick={() => setRemember(!remember)}
              className="text-xs text-violet-300 cursor-pointer select-none"
            >
              记住账号和密码
            </span>
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
