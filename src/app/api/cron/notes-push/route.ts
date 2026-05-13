// 定时推送笔记到微信（PushPlus）
// 由 GitHub Actions Cron 每 30 分钟触发一次
//
// 重构：每条笔记自己存 push_frequency + push_hour + push_minute + push_weekday
//
// 逻辑：
//   1. 鉴权：可选 CRON_SECRET，Bearer header 校验
//   2. 取当前北京时间的 hour、minute（对齐到 0/30 槽位）、weekday
//   3. 找匹配的笔记：
//        push_enabled=true
//        + push_hour=currentHour AND push_minute=currentMinute
//        + push_frequency='daily' OR (push_frequency='weekly' AND push_weekday=currentWeekday)
//   4. 按 owner_id 分组
//   5. 对每个 owner：拿其 notification_configs.pushplus_token_enc + enabled
//      若总开关 enabled=true 且 token 存在 → 拼 markdown → POST 到 PushPlus
//   6. 更新 last_pushed_at；失败写 last_error

import { getAdminClient } from "@/lib/supabaseAdmin";
import { decryptKey } from "@/lib/aiCrypto";
import { sendPushPlus, buildNotesPushContent } from "@/lib/pushplus";

interface NoteRow {
  id: string;
  owner_id: string;
  title: string;
  content_md: string;
  date: string;
  updated_at: string;
}

function nowBeijing(): { hour: number; minute: number; weekday: number } {
  const utc = new Date();
  const beijing = new Date(utc.getTime() + 8 * 3600 * 1000);
  const hour = beijing.getUTCHours();
  const minute = beijing.getUTCMinutes();
  const day = beijing.getUTCDay();
  const weekday = day === 0 ? 7 : day;
  return { hour, minute, weekday };
}

function snapMinute(m: number): 0 | 30 {
  return m < 30 ? 0 : 30;
}

export async function GET(req: Request) {
  // 1. 鉴权（可选）
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 2. 当前时间槽
  const { hour, minute, weekday } = nowBeijing();
  const slot = snapMinute(minute);
  const startedAt = new Date().toISOString();
  const admin = getAdminClient();

  // 3. 找匹配笔记
  // 注意：weekly 的过滤在 JS 端做（Supabase 客户端 .or 写起来啰嗦，量也不大）
  const { data: rawNotes, error } = await admin
    .from("personal_notes")
    .select("id, owner_id, title, content_md, date, updated_at, push_frequency, push_weekday")
    .eq("push_enabled", true)
    .eq("push_hour", hour)
    .eq("push_minute", slot)
    .eq("is_archived", false);
  if (error) {
    return Response.json({ error: error.message, slot: `${hour}:${slot}`, weekday }, { status: 500 });
  }

  const matched = (rawNotes ?? []).filter((n) => {
    const freq = (n.push_frequency as string) || "daily";
    if (freq === "weekly") {
      return Number(n.push_weekday) === weekday;
    }
    return true; // daily 总是匹配
  });

  if (matched.length === 0) {
    return Response.json({
      ok: true, slot: `${hour}:${String(slot).padStart(2, "0")}`, weekday,
      sent: 0, matched: 0, message: "无匹配笔记",
    });
  }

  // 4. 按 owner 分组
  const byOwner = new Map<string, NoteRow[]>();
  for (const n of matched) {
    const arr = byOwner.get(n.owner_id as string) ?? [];
    arr.push(n as unknown as NoteRow);
    byOwner.set(n.owner_id as string, arr);
  }

  // 5. 取所有相关 owner 的配置
  const ownerIds = Array.from(byOwner.keys());
  const { data: configs } = await admin
    .from("notification_configs")
    .select("user_id, pushplus_token_enc, enabled")
    .in("user_id", ownerIds);
  const cfgByUser = new Map<string, { tokenEnc: string; enabled: boolean }>();
  for (const c of configs ?? []) {
    cfgByUser.set(c.user_id as string, {
      tokenEnc: (c.pushplus_token_enc as string) || "",
      enabled: !!c.enabled,
    });
  }

  // 6. 给每个 owner 推送
  const results: Array<{ user_id: string; status: "ok" | "skip" | "error"; reason?: string; notes?: number }> = [];

  for (const [ownerId, notes] of byOwner.entries()) {
    const cfg = cfgByUser.get(ownerId);
    if (!cfg || !cfg.enabled || !cfg.tokenEnc) {
      results.push({ user_id: ownerId, status: "skip", reason: !cfg ? "无配置" : (!cfg.enabled ? "总开关未启用" : "未配 token") });
      continue;
    }
    try {
      const token = decryptKey(cfg.tokenEnc);
      const preview = notes.map((n) => ({
        title: n.title || "速记",
        content_md: n.content_md || "",
        date: n.date || "",
        updated_at: n.updated_at,
      }));
      const { title, content } = buildNotesPushContent(preview);
      await sendPushPlus({ token, title, content, template: "markdown" });

      await admin.from("notification_configs").update({
        last_pushed_at: startedAt, last_error: "", updated_at: startedAt,
      }).eq("user_id", ownerId);

      results.push({ user_id: ownerId, status: "ok", notes: notes.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("notification_configs").update({
        last_error: msg, updated_at: startedAt,
      }).eq("user_id", ownerId);
      results.push({ user_id: ownerId, status: "error", reason: msg });
    }
  }

  return Response.json({
    ok: true,
    slot: `${hour}:${String(slot).padStart(2, "0")}`,
    weekday,
    matched: matched.length,
    sent: results.filter((r) => r.status === "ok").length,
    total: results.length,
    results,
  });
}
