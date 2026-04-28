// AI 从笔记里挖出"可转任务"的动作意图
// 防抖：客户端控制，停笔 5s 后才调；服务端 dedup：内容长度未变化时直接返回 cached
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { generateText } from "@/lib/aiClient";

interface ActionCandidate {
  text: string;            // 原文片段
  suggested_title: string; // 建议任务标题
  suggested_due: string | null; // ISO 日期
  priority: "low" | "medium" | "high";
  reason: string;          // 为什么判断为待办
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = getAdminClient();
  const { data: note } = await admin.from("personal_notes")
    .select("owner_id, content_md, last_detect_len")
    .eq("id", id).maybeSingle();
  if (!note || note.owner_id !== guard.userId) {
    return Response.json({ error: "笔记不存在或无权限" }, { status: 404 });
  }

  const content: string = note.content_md || "";
  if (content.length < 30) {
    return Response.json({ candidates: [], skipped: "内容太短" });
  }
  // 简单 dedup：长度变化 < 20 字直接跳过（用户没新输入啥）
  if (Math.abs(content.length - (note.last_detect_len || 0)) < 20) {
    return Response.json({ candidates: [], skipped: "内容变化太小" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = {
    system: `你是个人工作助理，从用户的工作笔记里挖出"应该转成正式待办任务"的动作意图。
注意：
- 只提取明确的动作意图（"明天联系xx"、"需要做xx"、"提醒xxx"、"[ ] xxx"）
- 跳过：模糊感想（"觉得xx有趣"）、已完成项（"[x] xxx"）、单纯观察陈述
- 中文用户，要理解"记得xx"、"别忘了xx"、"@TODO" 等口语表达
- 保守：宁可少挖也不要乱挖虚假待办
- 今天日期：${today}`,
    user: `笔记正文如下，请提取应转任务的动作意图，最多 5 个：

\`\`\`
${content.slice(0, 4000)}
\`\`\`

严格以 JSON 数组返回，不要任何额外文字。如果没有动作意图，返回 []：
[
  {
    "text": "原文片段（不超过50字）",
    "suggested_title": "建议任务标题（≤25字）",
    "suggested_due": "YYYY-MM-DD 或 null（笔记里若说'明天/后天/下周'要解析成日期；说不清则 null）",
    "priority": "low / medium / high",
    "reason": "为什么判断为待办（≤15字）"
  }
]`,
  };

  let text: string;
  try {
    text = await generateText({ ...prompt, scope: "content", maxTokens: 1500 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }

  const m = text.match(/\[[\s\S]*\]/);
  let candidates: ActionCandidate[] = [];
  if (m) {
    try { candidates = JSON.parse(m[0]); } catch { /* keep empty */ }
  }

  // 标记已检测
  await admin.from("personal_notes").update({
    last_detect_len: content.length,
    last_detect_at: new Date().toISOString(),
  }).eq("id", id);

  return Response.json({ candidates });
}
