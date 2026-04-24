import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const { email, password, full_name, role, department } = await req.json();

    if (!email || !password || !full_name) {
      return Response.json({ error: "邮箱、密码和姓名不能为空" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) {
      return Response.json({ error: "服务器配置错误，请联系管理员" }, { status: 500 });
    }

    // 直接调用 Supabase Auth Admin REST API（更可靠）
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role, department },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      console.error("Auth create error:", authData);
      return Response.json(
        { error: authData.message || authData.msg || "创建用户失败，请重试" },
        { status: 400 }
      );
    }

    const userId = authData.id;

    // 写入 profiles 表
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      role: role || "viewer",
      department: department || "",
      is_active: true,
    });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      // 用户已创建，忽略 profile 写入错误
    }

    return Response.json({ success: true, userId });
  } catch (err) {
    console.error("Create user error:", err);
    return Response.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
