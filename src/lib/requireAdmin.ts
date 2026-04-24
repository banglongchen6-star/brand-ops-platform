// 服务端管理员守卫：验证调用者已登录且 profiles.role === 'admin'
// 任何 /api/ai-config/* 和 /api/admin/* 路由处理函数第一行都应该调用它
//
// 用法：
//   const guard = await requireAdmin();
//   if (!guard.ok) return guard.response;
//   const adminUserId = guard.userId;

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getAdminClient } from "./supabaseAdmin";

type GuardOk = { ok: true; userId: string };
type GuardFail = { ok: false; response: Response };

export async function requireAdmin(): Promise<GuardOk | GuardFail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, response: Response.json({ error: "服务端未配置 Supabase" }, { status: 500 }) };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // API Route 内不回写 cookie；session 刷新由客户端/中间件负责
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: Response.json({ error: "未登录" }, { status: 401 }) };
  }

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    return { ok: false, response: Response.json({ error: "账号未启用" }, { status: 403 }) };
  }
  if (profile.role !== "admin") {
    return { ok: false, response: Response.json({ error: "仅系统管理员可操作" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id };
}
