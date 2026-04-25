// 单张重新生成 —— 用客户端可能编辑过的 prompt_zh 重新提交任务
import { submitImageTask } from "@/lib/wxImageGen";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; imgId: string }> }) {
  const { id, imgId } = await params;
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();

  const { data: img } = await admin
    .from("wx_article_images")
    .select("id, prompt_zh, aspect")
    .eq("id", imgId)
    .eq("article_id", id)
    .single();
  if (!img) return Response.json({ error: "图片记录不存在" }, { status: 404 });

  const prompt = (body.prompt_zh as string) || img.prompt_zh;
  if (!prompt) return Response.json({ error: "提示词为空" }, { status: 400 });

  try {
    const { task_id } = await submitImageTask(prompt, img.aspect || "1:1");
    await admin.from("wx_article_images").update({
      prompt_zh: prompt,
      task_id,
      status: "generating",
      image_url: "",
      error: "",
      updated_at: new Date().toISOString(),
    }).eq("id", imgId);
    return Response.json({ ok: true, task_id });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
