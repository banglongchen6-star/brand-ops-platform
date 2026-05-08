// 把笔记内容交给 AI，生成新建任务的预填字段（标题 / 描述 / 验收标准）
// 不直接建任务，只返回 JSON 给前端弹表单用
import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { generateText } from "@/lib/aiClient";

interface GeneratedTask {
  title: string;
  description: string;
  acceptance_criteria: string;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = getAdminClient();
  const { data: note } = await admin
    .from("personal_notes")
    .select("owner_id, content_md")
    .eq("id", id)
    .maybeSingle();
  if (!note || note.owner_id !== guard.userId) {
    return Response.json({ error: "笔记不存在或无权限" }, { status: 404 });
  }

  const content: string = note.content_md || "";
  if (!content.trim()) {
    return Response.json({ error: "笔记内容为空，无法生成任务" }, { status: 400 });
  }

  const prompt = {
    system: `你是个人工作助理，把用户的工作笔记浓缩为一条可执行任务。要求：
- 标题简短具体（≤25 字），动宾结构（"完成 X / 推进 Y / 解决 Z"）
- 描述补充上下文：为什么做、关键信息、相关方等（笔记里没提到的信息别编）
- 验收标准是可衡量的"做完的标志"，3 条以内，每条一行
- 不一定要把笔记每个字都用上，可以归纳；但不能凭空编造笔记里没有的内容
- 用中文回答`,
    user: `笔记原文如下：

\`\`\`
${content.slice(0, 4000)}
\`\`\`

严格以 JSON 返回，不要任何额外文字、不要 markdown 代码块包裹：
{
  "title": "任务标题",
  "description": "任务描述（可多行，用 \\n 换行）",
  "acceptance_criteria": "验收标准 1\\n验收标准 2\\n验收标准 3"
}`,
  };

  let text: string;
  try {
    text = await generateText({ ...prompt, scope: "content", maxTokens: 1200 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI 调用失败" }, { status: 500 });
  }

  // 容忍 AI 偶尔包 ```json ... ```
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) {
    return Response.json({ error: "AI 返回格式无法解析" }, { status: 500 });
  }
  let parsed: GeneratedTask;
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return Response.json({ error: "AI 返回 JSON 格式错误" }, { status: 500 });
  }
  if (!parsed.title) {
    return Response.json({ error: "AI 未生成标题" }, { status: 500 });
  }

  return Response.json({
    title: parsed.title.slice(0, 100),
    description: parsed.description || "",
    acceptance_criteria: parsed.acceptance_criteria || "",
  });
}
