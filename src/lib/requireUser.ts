// 服务端用户守卫：只验证已登录、账号已启用，不限制角色
// 用法：
//   const guard = await requireUser();
//   if (!guard.ok) return guard.response;
//   const userId = guard.userId;

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getAdminClient } from "./supabaseAdmin";

type GuardOk = { ok: true; userId: string };
type GuardFail = { ok: false; response: Response };

export async function requireUser(): Promise<GuardOk | GuardFail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, response: Response.json({ error: "服务端未配置 Supabase" }, { status: 500 }) };
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => { /* noop */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: Response.json({ error: "未登录" }, { status: 401 }) };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles").select("is_active").eq("id", user.id).maybeSingle();
  if (!profile || profile.is_active === false) {
    return { ok: false, response: Response.json({ error: "账号未启用" }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}
