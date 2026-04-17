import { createClient } from "@supabase/supabase-js";

// Admin client using service role key — bypasses RLS, server-side only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, password, full_name, role, department } = await req.json();

    if (!email || !password || !full_name) {
      return Response.json({ error: "邮箱、密码和姓名不能为空" }, { status: 400 });
    }

    // Create auth user (no email confirmation required)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 直接确认，无需邮件验证
      user_metadata: { full_name, role, department },
    });

    if (authError) {
      return Response.json({ error: authError.message }, { status: 400 });
    }

    // Upsert profile
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: authData.user.id,
        email,
        full_name,
        role,
        department,
        is_active: true,
      });
      if (profileError) {
        console.error("Profile upsert error:", profileError);
      }
    }

    return Response.json({ success: true, userId: authData.user?.id });
  } catch (err) {
    console.error("Create user error:", err);
    return Response.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
