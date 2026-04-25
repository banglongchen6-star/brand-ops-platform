// 批量添加选题到素材库（AI 生成后让用户挑选添加）
import { getAdminClient } from "@/lib/supabaseAdmin";

interface InputTopic {
  title: string;
  pain_point?: string;
  target_audience?: string;
  angle?: string;
  tags?: string[];
  priority?: number;
  source_type?: string;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const topics: InputTopic[] = Array.isArray(body.topics) ? body.topics : [];
  if (topics.length === 0) return Response.json({ error: "topics 不能为空" }, { status: 400 });
  if (topics.length > 50) return Response.json({ error: "单次最多 50 条" }, { status: 400 });

  const rows = topics
    .filter((t) => typeof t.title === "string" && t.title.trim())
    .map((t) => ({
      title: t.title.trim(),
      pain_point: t.pain_point || "",
      target_audience: t.target_audience || "",
      angle: t.angle || "",
      tags: Array.isArray(t.tags) ? t.tags : [],
      priority: Number(t.priority) || 3,
      status: "candidate",
      source_type: t.source_type || "ai",
    }));
  if (rows.length === 0) return Response.json({ error: "无有效选题" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.from("wx_topic_pool").insert(rows).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, added: data?.length ?? 0 });
}
