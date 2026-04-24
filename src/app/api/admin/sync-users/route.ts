import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

// 从 Supabase Auth 同步用户到 profiles 表
// 补全那些在 Auth 有账号但 profiles 里没记录的用户
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) {
      return Response.json({ error: "服务器配置错误" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. 获取 Auth 里所有用户（最多1000个）
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
    });

    if (!authRes.ok) {
      return Response.json({ error: "获取用户列表失败" }, { status: 500 });
    }

    const authData = await authRes.json();
    const authUsers: Array<{
      id: string;
      email: string;
      user_metadata?: { full_name?: string; role?: string; department?: string };
      created_at: string;
    }> = authData.users || [];

    if (authUsers.length === 0) {
      return Response.json({ synced: 0, message: "Auth 中没有用户" });
    }

    // 2. 获取 profiles 里已有的用户 id
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id");

    const existingIds = new Set((existingProfiles || []).map((p: { id: string }) => p.id));

    // 3. 找出 Auth 有但 profiles 没有的用户
    const missing = authUsers.filter((u) => !existingIds.has(u.id));

    if (missing.length === 0) {
      return Response.json({ synced: 0, message: "所有用户已同步，无需补全" });
    }

    // 4. 批量插入缺失的 profiles
    const toInsert = missing.map((u) => ({
      id: u.id,
      email: u.email || "",
      full_name: u.user_metadata?.full_name || u.email?.split("@")[0] || "",
      role: u.user_metadata?.role || "viewer",
      department: u.user_metadata?.department || "",
      is_active: true,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .upsert(toInsert, { onConflict: "id" });

    if (insertError) {
      console.error("Profile sync error:", insertError);
      return Response.json({ error: "同步写入失败: " + insertError.message }, { status: 500 });
    }

    return Response.json({
      synced: missing.length,
      message: `成功同步 ${missing.length} 位用户`,
      users: missing.map((u) => ({ email: u.email, id: u.id })),
    });
  } catch (err) {
    console.error("Sync error:", err);
    return Response.json({ error: "服务器错误" }, { status: 500 });
  }
}
