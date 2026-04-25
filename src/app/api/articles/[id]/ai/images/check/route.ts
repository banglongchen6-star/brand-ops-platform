// 轮询所有 generating 状态的图片任务，更新 DB
// 完成后立即下载 → 上传 Supabase Storage → 写持久 URL
import { pollImageTask, persistImage } from "@/lib/wxImageGen";
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  const { data: pending } = await admin
    .from("wx_article_images")
    .select("id, task_id, position")
    .eq("article_id", id)
    .eq("status", "generating");
  if (!pending || pending.length === 0) {
    const { data: all } = await admin.from("wx_article_images").select("*").eq("article_id", id).order("created_at");
    return Response.json({ images: all ?? [], all_done: true });
  }

  await Promise.allSettled(pending.map(async (img) => {
    if (!img.task_id) return;
    try {
      const r = await pollImageTask(img.task_id);
      if (r.status === "SUCCEEDED" && r.url) {
        try {
          const persisted = await persistImage(r.url, id, img.position);
          await admin.from("wx_article_images")
            .update({ status: "done", image_url: persisted, error: "", updated_at: new Date().toISOString() })
            .eq("id", img.id);
        } catch (e) {
          // 图床上传失败时回退用 DashScope URL（24h 内可见，便于排查）
          await admin.from("wx_article_images")
            .update({ status: "done", image_url: r.url, error: "持久化失败: " + (e instanceof Error ? e.message : String(e)), updated_at: new Date().toISOString() })
            .eq("id", img.id);
        }
      } else if (r.status === "FAILED") {
        await admin.from("wx_article_images")
          .update({ status: "failed", error: r.error || "生成失败", updated_at: new Date().toISOString() })
          .eq("id", img.id);
      }
      // PENDING / RUNNING / UNKNOWN -> 不动，下次轮询继续
    } catch {
      // 单张失败不影响其他
    }
  }));

  const { data: all } = await admin.from("wx_article_images").select("*").eq("article_id", id).order("created_at");
  const allDone = (all ?? []).every((x) => x.status === "done" || x.status === "failed");
  return Response.json({ images: all ?? [], all_done: allDone });
}
