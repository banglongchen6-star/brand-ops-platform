// 一键加入达人库 —— 排期表录入时若达人不在库中，自动建一条最简档案
// POST { name, platform? }  →  返回 { item: { id, name, platform } }
//
// 注意：kols 表的实际字段是 followers / price / remark（schema.sql 里是
// followers_count / fee / notes，但生产环境已经迁过名）。本接口只设置 name + platform，
// 其他字段交给数据库默认值。

import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

const ALLOWED_PLATFORMS = ["douyin", "xiaohongshu", "bilibili", "weibo", "kuaishou", "other", ""] as const;

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const platform = String(body.platform ?? "").trim();

  if (!name) return Response.json({ error: "name 不能为空" }, { status: 400 });
  if (!ALLOWED_PLATFORMS.includes(platform as typeof ALLOWED_PLATFORMS[number])) {
    return Response.json({ error: "platform 非法" }, { status: 400 });
  }

  const admin = getAdminClient();

  // 先看有没有同名同平台的，有就直接返回（避免重复建）
  let dup = admin.from("kols").select("*").eq("name", name).limit(1);
  if (platform) dup = dup.eq("platform", platform);
  const { data: existing } = await dup;
  if (existing && existing[0]) return Response.json({ item: existing[0], reused: true });

  const { data, error } = await admin
    .from("kols")
    .insert({
      name,
      platform: platform || "",
      status: "pending",
      created_by: guard.userId,
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ item: data, reused: false });
}
