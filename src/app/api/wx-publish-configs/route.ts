// 公众号配置 CRUD —— GET 列表 / POST 创建
// AppSecret 加密存储，永不回传明文，前端只看到 last4
import { getAdminClient } from "@/lib/supabaseAdmin";
import { encryptKey } from "@/lib/aiCrypto";

export async function GET() {
  const admin = getAdminClient();
  // 先查基础列；token_expires_at 可能在 P4 SQL 跑前还不存在，单独尝试加载
  const { data, error } = await admin
    .from("wx_publish_configs")
    .select("id, name, app_id, account_type, default_author, enabled, notes, created_at, updated_at, app_secret_enc")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 尝试查 token_expires_at，失败就跳过（说明 P4 SQL 没跑）
  let tokenMap = new Map<string, string | null>();
  try {
    const { data: tokens } = await admin
      .from("wx_publish_configs")
      .select("id, token_expires_at");
    if (tokens) tokenMap = new Map(tokens.map((t) => [t.id, t.token_expires_at]));
  } catch { /* P4 SQL 未跑，忽略 */ }

  // 不回传 app_secret_enc，只暴露 last4 提示
  const safe = (data ?? []).map((row) => {
    const { app_secret_enc, ...rest } = row;
    return {
      ...rest,
      app_secret_set: !!app_secret_enc,
      token_expires_at: tokenMap.get(row.id) ?? null,
    };
  });
  return Response.json({ configs: safe });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const appId = String(body.app_id || "").trim();
  const appSecret = String(body.app_secret || "").trim();
  const accountType = body.account_type === "subscription" ? "subscription" : "service";
  const defaultAuthor = String(body.default_author || "").trim();
  const notes = String(body.notes || "").trim();

  if (!name) return Response.json({ error: "请填写名称" }, { status: 400 });
  if (!appId) return Response.json({ error: "请填写 AppID" }, { status: 400 });
  if (!appSecret) return Response.json({ error: "请填写 AppSecret" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.from("wx_publish_configs").insert({
    name,
    app_id: appId,
    app_secret_enc: encryptKey(appSecret),
    account_type: accountType,
    default_author: defaultAuthor,
    notes,
    enabled: true,
  }).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}
