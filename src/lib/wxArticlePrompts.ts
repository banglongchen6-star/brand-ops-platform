// 文字内容模块 —— 6 个 prompt 模板
// 集中管理便于运营调优。所有调用统一 generateText(scope='articles')

const BRAND_BACKGROUND = `你是音乐密码品牌的公众号主笔。音乐密码是专注成年人钢琴教学的在线教育品牌，主打流行钢琴弹唱、简化谱教学，用户主要是 25-45 岁、想圆儿时音乐梦的城市白领。品牌调性：专业但亲切，让"想弹琴"的成年人觉得"我也可以"。`;

// ============ Step 1: 话题筛选 ============
export function buildTopicsPrompt(trends: { id: string; title: string; platform: string; description?: string }[], userHint?: string) {
  const trendsJson = JSON.stringify(
    trends.map((t) => ({ id: t.id, title: t.title, platform: t.platform, desc: t.description || "" })),
    null,
    2,
  );
  return {
    system: BRAND_BACKGROUND,
    user: `以下是今日各平台热榜条目（JSON）：
${trendsJson}

${userHint ? `用户特别关注方向：${userHint}\n` : ""}
任务：从中挑选最多 5 条与"音乐人 / 音乐学习 / 音乐版权 / 音乐产业 / 创作者经济"相关度高的话题。即使只是间接相关（例如 AI 工具、文化现象、年轻人生活方式）也可以选，给出转化角度即可。

严格以 JSON 数组返回，不要任何额外文字：
[
  {
    "trend_id": "对应原条目id",
    "topic": "改写后的文章选题（15-25字）",
    "reason": "推荐理由（≤25字）",
    "angle": "切入角度（如：从XX现象出发，落到成年人学琴的XX痛点）"
  }
]`,
  };
}

// ============ Step 3: 大纲生成 ============
export function buildOutlinePrompt(topic: string, angle: string, userHint?: string) {
  return {
    system: BRAND_BACKGROUND,
    user: `选题：${topic}
切入角度：${angle}
${userHint ? `补充信息：${userHint}\n` : ""}
请生成一篇公众号文章的结构化大纲：
- 总字数目标 1500-2000 字
- 结构：引言 → 3-4 个正文段落（各有小标题）→ 结尾行动召唤
- 每个段落注明核心观点 + 1-2 个可展开的举例方向
- 行动召唤要自然引导到"音乐密码 30 天弹唱体验课"，但不能像广告

严格以 JSON 返回，不要任何额外文字：
{
  "intro": "引言段落核心思路（一两句）",
  "sections": [
    { "heading": "小标题", "keypoint": "核心观点", "examples": ["可展开的例子1", "例子2"] }
  ],
  "conclusion": "结尾行动召唤的方向（一两句）"
}`,
  };
}

// ============ Step 4: 正文生成 ============
export function buildContentPrompt(outline: unknown, topic: string, brandVoiceSamples?: string) {
  const outlineStr = typeof outline === "string" ? outline : JSON.stringify(outline, null, 2);
  return {
    system: `${BRAND_BACKGROUND}

写作风格：
- 专业但亲切，站在成年学员的视角
- 不用"首先/其次/最后"等套语
- 多用具体场景和小故事，少用空泛形容词
- 每段结尾不要做总结句
- 用 Markdown 格式输出，小标题用 ## ，重点词用 **加粗**`,
    user: `选题：${topic}

大纲：
${outlineStr}

${brandVoiceSamples ? `品牌历史文章片段（请模仿语气）：\n${brandVoiceSamples}\n\n` : ""}
请按大纲完整写出 1500-2000 字的 Markdown 正文。直接给正文，不要写"以下是文章正文"这样的引导语。`,
  };
}

// ============ Step 6: 标题候选 ============
export function buildTitlesPrompt(content: string, topic: string) {
  const digest = content.slice(0, 800);
  return {
    system: BRAND_BACKGROUND,
    user: `文章选题：${topic}
文章开头节选：
${digest}

请生成 5 个公众号标题候选，要求：
- 每个长度 18-26 字
- 至少 2 个含 emoji
- 风格差异化：① 疑问式 ② 数字式 ③ 故事式 ④ 反常识/钩子式 ⑤ 利他承诺式
- 不能虚假夸张（不能说"绝对/必看/100%"）

严格以 JSON 数组返回，不要任何额外文字：
[
  { "title": "标题文本", "style": "疑问式/数字式/故事式/反常识式/利他式", "emoji_used": true }
]`,
  };
}

// ============ Step 6 辅助: 摘要生成 ============
export function buildDigestPrompt(content: string) {
  return {
    system: BRAND_BACKGROUND,
    user: `请为以下公众号文章生成 100-120 字的摘要（公众号"摘要"字段，决定推送时朋友圈/订阅消息的预览文案）：
- 语气与正文一致
- 不要重复标题
- 给出"读完能得到什么"的承诺感

文章正文：
${content.slice(0, 3000)}

直接返回摘要文本，不要任何引导语或引号。`,
  };
}

// ============ Step 5: 配图提示词（4 张：封面 + 3 张正文插图） ============
export function buildImagesPrompt(topic: string, content: string) {
  const brief = content.slice(0, 1500);
  return {
    system: `${BRAND_BACKGROUND}\n\n你是公众号美术指导，擅长把文章内容转译为通义万相 AI 绘画的提示词。`,
    user: `文章选题：${topic}

文章正文节选：
${brief}

请生成 4 组通义万相图片提示词。整体视觉风格：明亮、温暖、有质感，适合音乐 / 钢琴 / 城市生活的氛围；不要写实人脸特写，避免版权风险。

各组要求：
- cover：封面图，比例 16:9，作为公众号文章首图，要有强视觉冲击和主题感
- body_1 / body_2 / body_3：正文插图，比例 1:1（方形），分别对应正文中的 3 个核心场景

严格以 JSON 数组返回，不要任何额外文字：
[
  {
    "position": "cover",
    "aspect": "16:9",
    "prompt_zh": "中文提示词，描述画面元素+风格+色调+氛围（80-150字）",
    "prompt_en": "English prompt, same content"
  },
  { "position": "body_1", "aspect": "1:1", "prompt_zh": "...", "prompt_en": "..." },
  { "position": "body_2", "aspect": "1:1", "prompt_zh": "...", "prompt_en": "..." },
  { "position": "body_3", "aspect": "1:1", "prompt_zh": "...", "prompt_en": "..." }
]`,
  };
}

// ============ Step 6 辅助: 智能改写 ============
export function buildRewritePrompt(originalText: string, instruction: string) {
  return {
    system: BRAND_BACKGROUND,
    user: `请根据指令改写下列文本。只输出改写后的文字，不要解释、不要引号包裹。

原文：
${originalText}

改写指令：${instruction}`,
  };
}
