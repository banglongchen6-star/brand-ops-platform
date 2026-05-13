// 发送测试推送 —— 验证 token 配对了 + 链路通
// POST /api/notification-configs/test
//   不需要 body；用当前登录用户的 token + 自己 push_enabled=true 的笔记预览

import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { decryptKey } from "@/lib/aiCrypto";
import { sendPushPlus, buildNotesPushContent } from "@/lib/pushplus";

export async function POST() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();

  // 1. 取用户的 token
  const { data: cfg } = await admin
    .from("notification_configs")
    .select("pushplus_token_enc")
    .eq("user_id", guard.userId).maybeSingle();
  const tokenEnc = (cfg?.pushplus_token_enc as string) || "";
  if (!tokenEnc) {
    return Response.json({ error: "请先在系统设置里填写 PushPlus token" }, { status: 400 });
  }

  let token: string;
  try { token = decryptKey(tokenEnc); }
  catch (e) {
    return Response.json({ error: "Token 解密失败：" + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }

  // 2. 取该用户当前标记 push_enabled 的笔记预览（最多 3 条，作为测试展示）
  const { data: notes } = await admin
    .from("personal_notes")
    .select("title, content_md, push_summary, date, updated_at")
    .eq("owner_id", guard.userId)
    .eq("push_enabled", true)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(3);

  const previewNotes = (notes ?? []).map((n) => ({
    title: (n.title as string) || "速记",
    content_md: (n.content_md as string) || "",
    push_summary: (n.push_summary as string) || "",
    date: (n.date as string) || "",
    updated_at: (n.updated_at as string) || undefined,
  }));

  let title: string;
  let content: string;
  if (previewNotes.length > 0) {
    const built = buildNotesPushContent(previewNotes);
    title = "🧪 测试推送 · " + built.title;
    content = `> 这是一条测试推送，正式推送时不会有这段说明。\n> 当前共 **${previewNotes.length}** 条已开启推送的笔记，下面预览：\n\n` + built.content;
  } else {
    title = "🧪 测试推送";
    content = `> 这是一条测试推送，链路已打通 ✅\n\n你目前还没有任何笔记被标记为「推送」。  \n在工作笔记里点笔记右上角的小铃铛 🔔，就能加入到每日/每周推送列表。`;
  }

  try {
    await sendPushPlus({ token, title, content, template: "markdown" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 把错误也写回 last_error 便于排查
    await admin.from("notification_configs")
      .update({ last_error: msg, updated_at: new Date().toISOString() })
      .eq("user_id", guard.userId);
    return Response.json({ error: msg }, { status: 500 });
  }

  // 清掉历史错误
  await admin.from("notification_configs")
    .update({ last_error: "", updated_at: new Date().toISOString() })
    .eq("user_id", guard.userId);

  return Response.json({ ok: true, notesCount: previewNotes.length });
}
