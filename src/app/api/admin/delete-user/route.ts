import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const { userId } = await req.json();

    if (!userId) {
      return Response.json({ error: "缺少用户ID" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) {
      return Response.json({ error: "服务器配置错误" }, { status: 500 });
    }

    // 1. 删除 Supabase Auth 用户
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
    });

    if (!authRes.ok) {
      const authErr = await authRes.json().catch(() => ({}));
      console.error("Auth delete error:", authErr);
      // 即使 auth 删除失败也继续删 profiles（可能已不存在）
    }

    // 2. 删除 profiles 表记录
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("Profile delete error:", profileError);
      return Response.json({ error: "删除用户资料失败" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return Response.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
