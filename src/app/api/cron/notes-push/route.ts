// 定时推送笔记到微信（PushPlus）
// 由 Vercel Cron 每 30 分钟触发一次（vercel.json schedule "0,30 * * * *"）
//
// 逻辑：
//   1. 鉴权：Vercel Cron 在请求头加 Authorization: Bearer <CRON_SECRET>
//      没设 CRON_SECRET 时跳过校验（dev 环境）
//   2. 取当前北京时间的 hour、minute、weekday
//   3. 找所有 notification_configs 中匹配的用户：
//        enabled=true
//        + push_hour=currentHour AND push_minute=currentMinute
//        + 若 frequency='weekly'，push_weekday=currentWeekday
//        + last_pushed_at 不在最近 25 分钟内（防重复）
//   4. 对每个用户：拉自己 push_enabled=true 的笔记 → 拼 markdown → POST 到 PushPlus
//   5. 更新 last_pushed_at；失败写 last_error

import { getAdminClient } from "@/lib/supabaseAdmin";
import { decryptKey } from "@/lib/aiCrypto";
import { sendPushPlus, buildNotesPushContent } from "@/lib/pushplus";

// 当前时间转北京（UTC+8）的 hour/minute/weekday
function nowBeijing(): { hour: number; minute: number; weekday: number } {
  const utc = new Date();
  const beijing = new Date(utc.getTime() + 8 * 3600 * 1000);
  const hour = beijing.getUTCHours();
  const minute = beijing.getUTCMinutes();
  // Beijing weekday: Mon=1 .. Sun=7
  const day = beijing.getUTCDay(); // Sun=0 .. Sat=6
  const weekday = day === 0 ? 7 : day;
  return { hour, minute, weekday };
}

// 把分钟对齐到 cron 槽位（0 或 30）—— 当前分钟在 [0,29] → 0；[30,59] → 30
function snapMinute(m: number): 0 | 30 {
  return m < 30 ? 0 : 30;
}

interface PushUser {
  user_id: string;
  pushplus_token_enc: string;
  frequency: "daily" | "weekly";
  push_weekday: number | null;
  last_pushed_at: string | null;
}

export async function GET(req: Request) {
  // 1. Vercel Cron 鉴权
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 2. 当前北京时间槽
  const { hour, minute, weekday } = nowBeijing();
  const slot = snapMinute(minute); // 0 or 30
  const startedAt = new Date().toISOString();

  const admin = getAdminClient();

  // 3. 找匹配用户
  let q = admin
    .from("notification_configs")
    .select("user_id, pushplus_token_enc, frequency, push_weekday, last_pushed_at, enabled, push_hour, push_minute")
    .eq("enabled", true)
    .eq("push_hour", hour)
    .eq("push_minute", slot);
  const { data: candidates, error } = await q;
  if (error) {
    return Response.json({ error: error.message, slot: `${hour}:${slot}`, weekday }, { status: 500 });
  }

  // 过滤 weekly（必须 weekday 匹配）+ last_pushed_at 防重（25 分钟窗口）
  const now = Date.now();
  const eligible: PushUser[] = (candidates ?? []).filter((c) => {
    if (c.frequency === "weekly" && c.push_weekday !== weekday) return false;
    if (c.last_pushed_at) {
      const last = new Date(c.last_pushed_at as string).getTime();
      if (now - last < 25 * 60 * 1000) return false; // 已在 25 分钟内推过
    }
    if (!c.pushplus_token_enc) return false;          // 没 token 跳过
    return true;
  }) as unknown as PushUser[];

  if (eligible.length === 0) {
    return Response.json({
      ok: true, slot: `${hour}:${String(slot).padStart(2, "0")}`, weekday, sent: 0,
      message: "无匹配用户",
    });
  }

  // 4. 给每个 eligible 用户推送
  const results: Array<{ user_id: string; status: "ok" | "skip" | "error"; reason?: string; notes?: number }> = [];

  for (const u of eligible) {
    try {
      // 拉该用户标记 push_enabled 的笔记
      const { data: notes } = await admin
        .from("personal_notes")
        .select("title, content_md, date, updated_at")
        .eq("owner_id", u.user_id)
        .eq("push_enabled", true)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (!notes || notes.length === 0) {
        results.push({ user_id: u.user_id, status: "skip", reason: "无关注笔记" });
        await admin.from("notification_configs").update({
          last_pushed_at: startedAt,        // 也记一下，避免下个周期重新检测
          last_error: "",
          updated_at: startedAt,
        }).eq("user_id", u.user_id);
        continue;
      }

      const token = decryptKey(u.pushplus_token_enc);
      const previewNotes = notes.map((n) => ({
        title: (n.title as string) || "速记",
        content_md: (n.content_md as string) || "",
        date: (n.date as string) || "",
        updated_at: (n.updated_at as string) || undefined,
      }));
      const { title, content } = buildNotesPushContent(previewNotes);

      await sendPushPlus({ token, title, content, template: "markdown" });

      await admin.from("notification_configs").update({
        last_pushed_at: startedAt,
        last_error: "",
        updated_at: startedAt,
      }).eq("user_id", u.user_id);

      results.push({ user_id: u.user_id, status: "ok", notes: notes.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("notification_configs").update({
        last_error: msg,
        updated_at: startedAt,
      }).eq("user_id", u.user_id);
      results.push({ user_id: u.user_id, status: "error", reason: msg });
    }
  }

  return Response.json({
    ok: true,
    slot: `${hour}:${String(slot).padStart(2, "0")}`,
    weekday,
    sent: results.filter((r) => r.status === "ok").length,
    total: results.length,
    results,
  });
}
