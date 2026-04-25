// Markdown + 配图 → 公众号风格 HTML
// 模板：左紫色竖线的小标题 + 段落 + 首图 + 插图穿插 + 末尾品牌卡片
// 所有样式内联（微信编辑器不保留 <style>），放在 <section> 里直接复制可用

export interface RenderArticle {
  title: string;
  digest: string;
  author: string;
  content_md: string;
  cover_image_url: string;
}

export interface RenderImage {
  position: string;   // cover / body_1 / body_2 / body_3
  image_url: string;
  status: string;
}

export interface RenderOptions {
  accentColor?: string;   // 主题色，默认紫色
  showTitle?: boolean;    // HTML 中是否显示大标题（微信自带标题，默认关）
  showCTA?: boolean;      // 结尾是否加品牌卡片
  fontSize?: number;      // 正文字号 px，默认 15
}

const DEFAULT_OPTS: Required<RenderOptions> = {
  accentColor: "#7c3aed",
  showTitle: false,
  showCTA: true,
  fontSize: 15,
};

// 极简 Markdown 解析器（只处理公众号常见语法）
interface Block {
  type: "h2" | "h3" | "p" | "quote" | "ul" | "ol";
  items?: string[]; // for ul/ol
  text?: string;
}

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let cur: Block | null = null;

  const flush = () => { if (cur) { blocks.push(cur); cur = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }

    if (line.startsWith("## ")) { flush(); blocks.push({ type: "h2", text: line.slice(3).trim() }); continue; }
    if (line.startsWith("### ")) { flush(); blocks.push({ type: "h3", text: line.slice(4).trim() }); continue; }
    if (line.startsWith("# ")) { flush(); blocks.push({ type: "h2", text: line.slice(2).trim() }); continue; }
    if (line.startsWith("> ")) { flush(); blocks.push({ type: "quote", text: line.slice(2).trim() }); continue; }

    const ulMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (ulMatch) {
      if (cur?.type === "ul") cur.items!.push(ulMatch[1]);
      else { flush(); cur = { type: "ul", items: [ulMatch[1]] }; }
      continue;
    }
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (cur?.type === "ol") cur.items!.push(olMatch[1]);
      else { flush(); cur = { type: "ol", items: [olMatch[1]] }; }
      continue;
    }

    // 普通文本：同一段继续拼接
    if (cur?.type === "p") cur.text = cur.text + " " + line;
    else { flush(); cur = { type: "p", text: line }; }
  }
  flush();
  return blocks;
}

// 行内样式：**加粗** / *斜体* / `代码` —— 只处理 **加粗**（公众号最常用）
function inline(text: string, accent: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${accent};font-weight:bold;">$1</strong>`)
    .replace(/\*([^*]+)\*/g, `<em>$1</em>`);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderWxHtml(article: RenderArticle, images: RenderImage[], options: RenderOptions = {}): string {
  const opts = { ...DEFAULT_OPTS, ...options };
  const { accentColor: accent, showTitle, showCTA, fontSize } = opts;

  const cover = article.cover_image_url
    || images.find((i) => i.position === "cover" && i.status === "done")?.image_url
    || "";
  const bodyImgs = ["body_1", "body_2", "body_3"]
    .map((p) => images.find((i) => i.position === p && i.status === "done")?.image_url)
    .filter((x): x is string => !!x);

  const base = `font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;color:#333;line-height:1.8;font-size:${fontSize}px;letter-spacing:0.3px;`;

  const out: string[] = [];
  out.push(`<section style="${base}max-width:100%;padding:0 2px;">`);

  // 标题（可选）
  if (showTitle && article.title) {
    out.push(`<h1 style="font-size:22px;font-weight:bold;color:#222;margin:0 0 8px;line-height:1.4;">${escapeHtml(article.title)}</h1>`);
    if (article.author) {
      out.push(`<p style="font-size:12px;color:#999;margin:0 0 20px;">${escapeHtml(article.author)}</p>`);
    }
  }

  // 封面
  if (cover) {
    out.push(`<section style="margin:0 0 24px;text-align:center;">`);
    out.push(`<img src="${cover}" style="max-width:100%;display:block;margin:0 auto;border-radius:4px;" alt="封面"/>`);
    out.push(`</section>`);
  }

  // 正文块
  const blocks = parseMarkdown(article.content_md || "");

  // 计算插图插入位置：平均分布在 h2 段落之间
  const h2Positions: number[] = [];
  blocks.forEach((b, i) => { if (b.type === "h2") h2Positions.push(i); });
  // 需要在 h2 后各插一张图（最多 bodyImgs 张）
  const imgInsertAfter = new Map<number, string>();
  bodyImgs.forEach((url, idx) => {
    if (idx < h2Positions.length) {
      // 插到该 h2 对应的"段落结束后"，简化：就插到 h2 本身之后的下一个段落后
      // 为了分布均匀，找出该 h2 之后第一个 p 的索引
      const start = h2Positions[idx];
      for (let j = start + 1; j < blocks.length; j++) {
        if (blocks[j].type === "p") { imgInsertAfter.set(j, url); break; }
      }
    }
  });

  blocks.forEach((b, i) => {
    if (b.type === "h2") {
      out.push(`<h2 style="font-size:17px;font-weight:bold;color:#222;margin:28px 0 12px;padding:4px 0 4px 12px;border-left:3px solid ${accent};line-height:1.5;">${escapeHtml(b.text || "")}</h2>`);
    } else if (b.type === "h3") {
      out.push(`<h3 style="font-size:16px;font-weight:bold;color:#444;margin:20px 0 10px;">${escapeHtml(b.text || "")}</h3>`);
    } else if (b.type === "quote") {
      out.push(`<blockquote style="margin:16px 0;padding:12px 16px;background:#f5f3ff;border-left:3px solid ${accent};color:#555;font-size:${fontSize - 1}px;border-radius:0 4px 4px 0;">${inline(b.text || "", accent)}</blockquote>`);
    } else if (b.type === "ul") {
      out.push(`<ul style="margin:12px 0;padding-left:20px;">`);
      (b.items || []).forEach((it) => out.push(`<li style="margin:6px 0;">${inline(it, accent)}</li>`));
      out.push(`</ul>`);
    } else if (b.type === "ol") {
      out.push(`<ol style="margin:12px 0;padding-left:20px;">`);
      (b.items || []).forEach((it) => out.push(`<li style="margin:6px 0;">${inline(it, accent)}</li>`));
      out.push(`</ol>`);
    } else if (b.type === "p") {
      out.push(`<p style="margin:0 0 18px;text-align:justify;">${inline(b.text || "", accent)}</p>`);
    }

    // 插图
    if (imgInsertAfter.has(i)) {
      out.push(`<section style="margin:20px 0;text-align:center;">`);
      out.push(`<img src="${imgInsertAfter.get(i)}" style="max-width:100%;display:block;margin:0 auto;border-radius:4px;" alt="配图"/>`);
      out.push(`</section>`);
    }
  });

  // 未被分布的插图 → 追加到结尾
  const used = new Set(imgInsertAfter.values());
  bodyImgs.filter((u) => !used.has(u)).forEach((url) => {
    out.push(`<section style="margin:20px 0;text-align:center;">`);
    out.push(`<img src="${url}" style="max-width:100%;display:block;margin:0 auto;border-radius:4px;" alt="配图"/>`);
    out.push(`</section>`);
  });

  // 品牌 CTA
  if (showCTA) {
    out.push(`<section style="margin:32px 0 8px;padding:20px 16px;background:linear-gradient(135deg,${accent}15 0%,${accent}08 100%);border-radius:8px;text-align:center;">`);
    out.push(`<p style="margin:0 0 6px;font-size:13px;color:${accent};font-weight:bold;letter-spacing:1px;">—— 音乐密码 ——</p>`);
    out.push(`<p style="margin:0;font-size:12px;color:#666;">专注成年人钢琴弹唱 · 30 天体验课</p>`);
    out.push(`</section>`);
  }

  out.push(`</section>`);
  return out.join("\n");
}
