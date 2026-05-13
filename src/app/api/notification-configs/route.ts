// 用户推送配置 · 当前用户读自己 / 写自己
// GET  返回当前用户配置（token 不回传，只回 last4）
// PUT  upsert 当前用户配置；如果 body.pushplus_token 非空则加密落库 + 计算 last4

import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { encryptKey, maskKey } from "@/lib/aiCrypto";

interface ConfigDTO {
  enabled: boolean;
  frequency: "daily" | "weekly";
  push_hour: number;
  push_minute: number;
  push_weekday: number | null;
  pushplus_token_last4: string;
  has_token: boolean;
  last_pushed_at: string | null;
  last_error: string;
}

function toDTO(row: Record<string, unknown> | null): ConfigDTO {
  return {
    enabled: !!row?.enabled,
    frequency: (row?.frequency as "daily" | "weekly") || "daily",
    push_hour: Number(row?.push_hour ?? 9),
    push_minute: Number(row?.push_minute ?? 0),
    push_weekday: row?.push_weekday == null ? null : Number(row.push_weekday),
    pushplus_token_last4: (row?.pushplus_token_last4 as string) || "",
    has_token: !!(row?.pushplus_token_enc as string),
    last_pushed_at: (row?.last_pushed_at as string) || null,
    last_error: (row?.last_error as string) || "",
  };
}

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("notification_configs")
    .select("*")
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ config: toDTO(data) });
}

export async function PUT(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));

  const enabled = body.enabled !== undefined ? !!body.enabled : undefined;
  const frequency = body.frequency as "daily" | "weekly" | undefined;
  const push_hour = body.push_hour !== undefined ? Number(body.push_hour) : undefined;
  const push_minute = body.push_minute !== undefined ? Number(body.push_minute) : undefined;
  const push_weekday = "push_weekday" in body
    ? (body.push_weekday == null || body.push_weekday === "" ? null : Number(body.push_weekday))
    : undefined;
  const rawToken = typeof body.pushplus_token === "string" ? body.pushplus_token.trim() : undefined;

  // 校验
  if (frequency && !["daily", "weekly"].includes(frequency)) {
    return Response.json({ error: "frequency 非法" }, { status: 400 });
  }
  if (push_hour !== undefined && (!Number.isInteger(push_hour) || push_hour < 0 || push_hour > 23)) {
    return Response.json({ error: "push_hour 必须 0-23" }, { status: 400 });
  }
  if (push_minute !== undefined && ![0, 30].includes(push_minute)) {
    return Response.json({ error: "push_minute 只允许 0 或 30" }, { status: 400 });
  }
  if (push_weekday !== undefined && push_weekday !== null && (!Number.isInteger(push_weekday) || push_weekday < 1 || push_weekday > 7)) {
    return Response.json({ error: "push_weekday 必须 1-7" }, { status: 400 });
  }
  if (frequency === "weekly" && push_weekday === null) {
    return Response.json({ error: "选择每周时，必须指定 push_weekday" }, { status: 400 });
  }

  const admin = getAdminClient();

  // 取现有行
  const { data: existing } = await admin
    .from("notification_configs")
    .select("*").eq("user_id", guard.userId).maybeSingle();

  const merged: Record<string, unknown> = {
    user_id: guard.userId,
    enabled: enabled ?? existing?.enabled ?? false,
    frequency: frequency ?? existing?.frequency ?? "daily",
    push_hour: push_hour ?? existing?.push_hour ?? 9,
    push_minute: push_minute ?? existing?.push_minute ?? 0,
    push_weekday: push_weekday !== undefined ? push_weekday : existing?.push_weekday ?? null,
    pushplus_token_enc: existing?.pushplus_token_enc ?? "",
    pushplus_token_last4: existing?.pushplus_token_last4 ?? "",
    updated_at: new Date().toISOString(),
  };

  // 如果传了新 token，加密 + last4
  if (rawToken !== undefined && rawToken.length > 0) {
    try {
      merged.pushplus_token_enc = encryptKey(rawToken);
      merged.pushplus_token_last4 = maskKey(rawToken);
    } catch (e) {
      return Response.json({ error: "加密失败：" + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
    }
  } else if (rawToken === "") {
    // 显式传空字符串 → 清除 token
    merged.pushplus_token_enc = "";
    merged.pushplus_token_last4 = "";
  }

  const { data, error } = await admin
    .from("notification_configs")
    .upsert(merged, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ config: toDTO(data) });
}
