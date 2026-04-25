// 微信公众号 API 封装
// 接口文档：https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html
//
// 重要：access_token 7200 秒有效，每日限调 2000 次，必须在 DB 缓存
// 重要：调用方 IP 需要在公众号后台 IP 白名单里（Vercel 动态 IP 是个老大难）

import { getAdminClient } from "./supabaseAdmin";
import { decryptKey } from "./aiCrypto";

const WX_BASE = "https://api.weixin.qq.com/cgi-bin";

export interface WxConfig {
  id: string;
  name: string;
  app_id: string;
  app_secret_enc: string;
  default_author: string;
  access_token: string;
  token_expires_at: string | null;
}

export class WxApiError extends Error {
  errcode?: number;
  raw?: unknown;
  constructor(msg: string, errcode?: number, raw?: unknown) {
    super(msg); this.errcode = errcode; this.raw = raw;
  }
}

// 取/刷新 access_token
export async function getAccessToken(configId: string): Promise<string> {
  const admin = getAdminClient();
  const { data: cfg, error } = await admin
    .from("wx_publish_configs")
    .select("id, app_id, app_secret_enc, access_token, token_expires_at")
    .eq("id", configId)
    .single();
  if (error || !cfg) throw new WxApiError("公众号配置不存在");

  // 缓存有效（提前 60s 续期）
  if (cfg.access_token && cfg.token_expires_at) {
    const exp = new Date(cfg.token_expires_at).getTime();
    if (exp - Date.now() > 60 * 1000) return cfg.access_token;
  }

  const secret = decryptKey(cfg.app_secret_enc);
  const url = `${WX_BASE}/token?grant_type=client_credential&appid=${encodeURIComponent(cfg.app_id)}&secret=${encodeURIComponent(secret)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new WxApiError(`获取 access_token 失败 ${r.status}`);
  const j = await r.json();
  if (j.errcode) throw new WxApiError(wxErrorMessage(j.errcode, j.errmsg), j.errcode, j);

  const token = j.access_token as string;
  const expiresIn = (j.expires_in as number) || 7200;
  await admin.from("wx_publish_configs").update({
    access_token: token,
    token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", configId);

  return token;
}

// 上传正文图片，返回微信 url（可在 HTML 里直接引用，不占素材库）
export async function uploadContentImage(configId: string, imageUrl: string): Promise<{ url: string }> {
  const r = await fetch(imageUrl);
  if (!r.ok) throw new WxApiError("下载图片失败 " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = guessExt(imageUrl, r.headers.get("content-type"));
  const filename = `image.${ext}`;
  const ct = r.headers.get("content-type") || `image/${ext === "jpg" ? "jpeg" : ext}`;

  const token = await getAccessToken(configId);
  const fd = new FormData();
  fd.append("media", new Blob([new Uint8Array(buf)], { type: ct }), filename);

  const up = await fetch(`${WX_BASE}/media/uploadimg?access_token=${token}`, {
    method: "POST", body: fd,
  });
  const j = await up.json();
  if (j.errcode) throw new WxApiError(wxErrorMessage(j.errcode, j.errmsg), j.errcode, j);
  if (!j.url) throw new WxApiError("微信未返回 url: " + JSON.stringify(j));
  return { url: j.url as string };
}

// 上传永久封面素材，返回 media_id（draft.thumb_media_id 用）
export async function uploadCoverMaterial(configId: string, imageUrl: string): Promise<{ media_id: string; url: string }> {
  const r = await fetch(imageUrl);
  if (!r.ok) throw new WxApiError("下载封面失败 " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = guessExt(imageUrl, r.headers.get("content-type"));
  const filename = `cover.${ext}`;
  const ct = r.headers.get("content-type") || `image/${ext === "jpg" ? "jpeg" : ext}`;

  const token = await getAccessToken(configId);
  const fd = new FormData();
  fd.append("media", new Blob([new Uint8Array(buf)], { type: ct }), filename);

  const up = await fetch(`${WX_BASE}/material/add_material?access_token=${token}&type=image`, {
    method: "POST", body: fd,
  });
  const j = await up.json();
  if (j.errcode) throw new WxApiError(wxErrorMessage(j.errcode, j.errmsg), j.errcode, j);
  if (!j.media_id) throw new WxApiError("微信未返回 media_id: " + JSON.stringify(j));
  return { media_id: j.media_id as string, url: (j.url as string) || "" };
}

// 添加草稿
export interface DraftArticle {
  title: string;
  author?: string;
  digest?: string;
  content: string;          // HTML
  content_source_url?: string;
  thumb_media_id: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
}

export async function addDraft(configId: string, article: DraftArticle): Promise<{ media_id: string }> {
  const token = await getAccessToken(configId);
  const body = {
    articles: [{
      title: article.title,
      author: article.author || "",
      digest: article.digest || "",
      content: article.content,
      content_source_url: article.content_source_url || "",
      thumb_media_id: article.thumb_media_id,
      need_open_comment: article.need_open_comment ?? 1,
      only_fans_can_comment: article.only_fans_can_comment ?? 0,
    }],
  };
  const r = await fetch(`${WX_BASE}/draft/add?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.errcode) throw new WxApiError(wxErrorMessage(j.errcode, j.errmsg), j.errcode, j);
  if (!j.media_id) throw new WxApiError("微信未返回 media_id: " + JSON.stringify(j));
  return { media_id: j.media_id as string };
}

// 工具
function guessExt(url: string, contentType: string | null): string {
  const m = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
  if (m) return m[1].toLowerCase();
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("gif")) return "gif";
  if (contentType?.includes("webp")) return "webp";
  return "jpg";
}

function wxErrorMessage(code: number, msg: string): string {
  const friendly: Record<number, string> = {
    40001: "AppSecret 错误或 access_token 失效",
    40013: "AppID 不合法",
    40164: "调用方 IP 不在白名单 — 公众号后台「设置 → 公众号设置 → IP 白名单」需加上 Vercel 出口 IP",
    45009: "接口调用超频",
    45064: "草稿超过上限",
    48001: "API 功能未授权 — 服务号需通过认证",
    61007: "频次超限",
  };
  return `微信 API 错误 ${code}: ${friendly[code] || msg}`;
}
