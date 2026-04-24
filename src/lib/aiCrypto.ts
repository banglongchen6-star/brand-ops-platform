// AES-256-GCM 加密/解密 AI API Key
// 需要环境变量 AI_CONFIG_SECRET（64 位 hex = 32 字节）

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const hex = process.env.AI_CONFIG_SECRET;
  if (!hex) throw new Error("AI_CONFIG_SECRET 环境变量未配置");
  if (hex.length !== 64) throw new Error("AI_CONFIG_SECRET 必须是 64 位 hex（32 字节）");
  return Buffer.from(hex, "hex");
}

// 加密：返回 base64(iv(12) | tag(16) | ciphertext)
export function encryptKey(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptKey(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// 取最后 4 位供 UI 显示（xxxx****abcd）
export function maskKey(plaintext: string): string {
  if (plaintext.length < 8) return "****";
  return plaintext.slice(-4);
}
