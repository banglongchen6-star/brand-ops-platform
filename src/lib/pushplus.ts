// PushPlus 微信推送服务封装
// 官方文档：https://www.pushplus.plus/doc/

const PUSHPLUS_ENDPOINT = "https://www.pushplus.plus/send";

export interface PushPlusResp {
  code: number;       // 200 成功
  msg: string;
  data?: string;
}

export type PushTemplate = "html" | "markdown" | "txt" | "json";

// 推送内容上限：PushPlus 文档 64KB，留余量截断到 20000 字符
const CONTENT_MAX = 20000;

export async function sendPushPlus(opts: {
  token: string;
  title: string;
  content: string;
  template?: PushTemplate;     // 默认 markdown
}): Promise<PushPlusResp> {
  if (!opts.token) throw new Error("PushPlus token 不能为空");

  let content = opts.content;
  if (content.length > CONTENT_MAX) {
    content = content.slice(0, CONTENT_MAX) + "\n\n…内容过长已截断";
  }

  const body = {
    token: opts.token,
    title: opts.title.slice(0, 100),
    content,
    template: opts.template ?? "markdown",
  };

  const r = await fetch(PUSHPLUS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!r.ok) {
    throw new Error(`PushPlus HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  const j = (await r.json()) as PushPlusResp;
  if (j.code !== 200) {
    throw new Error(`PushPlus 业务错误 ${j.code}: ${j.msg}`);
  }
  return j;
}

// 把多条笔记拼成一条 markdown 推送
// 优先用 push_summary（用户专门写的推送摘要）；为空才用完整 content_md
export function buildNotesPushContent(
  notes: Array<{ title: string; content_md: string; push_summary?: string; date: string; updated_at?: string }>,
): { title: string; content: string } {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const title = notes.length === 1
    ? `📌 ${notes[0].title || "笔记"} · ${dateStr}`
    : `📌 关注笔记 ${notes.length} 条 · ${dateStr}`;

  const sections = notes.map((n) => {
    const summary = (n.push_summary || "").trim();
    const body = summary || (n.content_md || "_（无内容）_").trim();
    return `## ${n.title || "速记"}\n\n${body}`;
  });
  const content = sections.join("\n\n---\n\n");
  return { title, content };
}
