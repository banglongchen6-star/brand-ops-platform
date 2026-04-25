// 手动上传图片 —— 直接把文件存到 Supabase Storage，写入 wx_article_images
// 同 position 已存在则覆盖（只替换 image_url，保留 prompt_zh）
import { getAdminClient } from "@/lib/supabaseAdmin";

const STORAGE_BUCKET = "wx-article-images";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB，微信上限
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return Response.json({ error: "请求必须是 multipart/form-data" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  const position = (formData.get("position") as string | null) || "";
  const aspect = (formData.get("aspect") as string | null) || (position === "cover" ? "16:9" : "1:1");

  if (!file) return Response.json({ error: "缺少文件" }, { status: 400 });
  if (!position) return Response.json({ error: "缺少 position" }, { status: 400 });
  if (file.size > MAX_SIZE) return Response.json({ error: `图片超过 10MB 上限` }, { status: 400 });
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: "只支持 JPG/PNG/GIF/WEBP" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const rawExt = (file.name.split(".").pop() || "png").toLowerCase();
  const ext = ["jpg", "jpeg", "png", "gif", "webp"].includes(rawExt) ? rawExt : "png";
  const filename = `${id}/${position}-${Date.now()}.${ext}`;
  const contentType = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;

  const admin = getAdminClient();
  const { error: upErr } = await admin.storage.from(STORAGE_BUCKET).upload(filename, buf, {
    contentType, upsert: false,
  });
  if (upErr) return Response.json({ error: "上传图床失败：" + upErr.message }, { status: 500 });

  const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
  const publicUrl = pub.publicUrl;

  // 同 position 已有行：更新；否则插入
  const { data: existing } = await admin
    .from("wx_article_images")
    .select("id")
    .eq("article_id", id)
    .eq("position", position)
    .maybeSingle();

  if (existing) {
    const { error } = await admin.from("wx_article_images").update({
      image_url: publicUrl,
      status: "done",
      error: "",
      task_id: "",
      aspect,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.from("wx_article_images").insert({
      article_id: id,
      position,
      aspect,
      image_url: publicUrl,
      status: "done",
      prompt_zh: "",
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, url: publicUrl });
}
