// 服务端守卫：admin 或 manager 角色都通过
// 用法：
//   const guard = await requireManager();
//   if (!guard.ok) return guard.response;

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getAdminClient } from "./supabaseAdmin";

type GuardOk = { ok: true; userId: string; role: string };
type GuardFail = { ok: false; response: Response };

export async function requireManager(): Promise<GuardOk | GuardFail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, response: Response.json({ error: "服务端未配置 Supabase" }, { status: 500 }) };
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: Response.json({ error: "未登录" }, { status: 401 }) };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile || profile.is_active === false) {
    return { ok: false, response: Response.json({ error: "账号未启用" }, { status: 403 }) };
  }
  if (profile.role !== "admin" && profile.role !== "manager") {
    return { ok: false, response: Response.json({ error: "需要 manager 或更高权限" }, { status: 403 }) };
  }
  return { ok: true, userId: user.id, role: profile.role };
}
