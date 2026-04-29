# 品牌经营协同平台 · 交接文档

> 最后更新：2026-04-29
> 项目：音乐密码（adult piano education）10 人团队内部管理后台
> 路径：`/Users/sheji/管理后台系统/brand-ops-platform`
> 部署：Vercel（auto-deploy on push to main）→ https://brand-ops-platform.vercel.app
> 仓库：https://github.com/banglongchen6-star/brand-ops-platform

---

## 1. 技术栈

| 层 | 技术 |
|---|---|
| 框架 | **Next.js 16** (App Router, Turbopack) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| DB / Auth | Supabase (邮箱密码登录) |
| AI | **Qwen3.6-plus** (主，DashScope) + Claude (备) |
| 视觉 AI | **Qwen-VL-plus** (DashScope OpenAI 兼容模式) |
| 图床 | Supabase Storage (`wx-article-images` bucket) |
| 部署 | Vercel (push to main 自动部署) |
| 第三方 API | TrendRadar/newsnow（热榜）、微信公众号 API、通义万相（图像生成） |

⚠️ **AGENTS.md 提醒：Next.js 16 跟训练数据有差异，写代码前查 `node_modules/next/dist/docs/`**

---

## 2. 仓库结构

```
brand-ops-platform/
├── src/
│   ├── app/
│   │   ├── api/                          # 服务端 API routes
│   │   │   ├── ai-config/                # AI 模型配置
│   │   │   ├── articles/                 # 文章 CRUD + AI workflow
│   │   │   ├── competitors/              # 竞品情报 CRUD + AI 周报
│   │   │   ├── content/                  # 内容运营 + 热榜同步
│   │   │   ├── hot-sources/              # 热点来源配置
│   │   │   ├── note-categories/          # 笔记板块
│   │   │   ├── notes/                    # 个人笔记
│   │   │   ├── tasks/                    # 任务（quick-add / my-related）
│   │   │   ├── topic-pool/               # 选题素材库
│   │   │   └── wx-publish-configs/       # 公众号配置
│   │   └── dashboard/
│   │       ├── articles/                 # 文字内容（公众号文章）
│   │       ├── competitor/               # 竞品情报
│   │       ├── content/                  # 内容运营
│   │       ├── home/                     # 工作台首页（笔记+任务）
│   │       ├── tasks/                    # 任务中心
│   │       └── ...
│   ├── components/layout/Sidebar.tsx
│   └── lib/
│       ├── aiClient.ts                   # 统一 LLM 调用层
│       ├── aiCrypto.ts                   # AES-256-GCM 密钥加解密
│       ├── requireAdmin.ts               # API 鉴权 (admin)
│       ├── requireUser.ts                # API 鉴权 (任何已登录)
│       ├── supabase.ts                   # 客户端 supabase
│       ├── supabaseAdmin.ts              # service_role 客户端
│       ├── wxApiClient.ts                # 微信公众号 API
│       ├── wxArticlePrompts.ts           # 6 个 AI prompt 模板
│       ├── wxArticleRender.ts            # MD → 公众号 HTML
│       └── wxImageGen.ts                 # 通义万相 + Supabase Storage
└── supabase/                              # SQL 迁移
```

---

## 3. 已完成模块（按业务）

### 3.1 工作台首页（/dashboard/home）
- 个人笔记：私人，按用户隔离（owner_id）
- 板块化：默认 5 个板块（电商运营/达人营销/内容运营/渠道分销/客服中心），用户可改名/换 emoji/增删
- 卡片视图：所有笔记同屏，Markdown 渲染，点编辑进入编辑态，手动保存
- 退出强制 flush 保存；新建后取消会删空笔记
- 右侧任务面板：4 tab（今日/即将/待审/协作），勾选完成
- AI 桥接：检测笔记里的待办意图 → 一键转任务（toast 通知，默认手动触发）

### 3.2 任务中心（/dashboard/tasks）
- 现有完整任务管理 2500 行（tab 我的/团队/我创建的）
- 加了年/月筛选（默认本年本月，去掉「全部」选项）
- 无 due_at 的任务**始终通过**年月筛选（不被错误过滤）

### 3.3 文字内容（/dashboard/articles）—— 公众号文章 AI 写作
- **8 步 AI 工作流：**
  1. 话题筛选（双源：素材库 / 今日热榜）
  2. 选题确认
  3. AI 大纲（Qwen）
  4. 正文生成（Qwen）+ 智能改写
  5. 配图生成（通义万相 wanx2.1-t2i-turbo + 手动上传备选）
  6. 标题/摘要（Qwen，5 个候选）
  7. 微信预览（iPhone 手机壳 + Markdown → 内联样式 HTML，可改主题色）
  8. 发布到微信草稿箱（access_token 缓存 + 图片转上传 + draft API）
- **辅助功能：**
  - 文章列表：筛选/搜索/批量删除/复制/封面 fallback 用配图
  - 选题素材库（/dashboard/articles/topics）：列表+月历视图，AI 批量生成（先预览再挑选添加）
  - 公众号配置（/dashboard/articles/settings）：AppID + AppSecret 加密存储

### 3.4 内容运营（/dashboard/content/workspace）
- TrendRadar/newsnow 集成（拉 40+ 平台热榜）
- DailyHot 兜底
- 热点来源配置面板（编辑 API URL）
- 平台管理（按数据源分组）
- 抖音/微博/B站/知乎 已切到 trendradar（dailyhot 不稳）

### 3.5 竞品情报（/dashboard/competitor）
- **Phase 1：** 竞品 + SKU + 快照 + 事件 + 趋势图
  - 卡片总览，按平台筛选，「我们品牌」+「竞品」分组
  - 详情页：SKU 列表 + recharts 折线图（价/销/评 切换）+ 事件时间线
  - 批量录入弹窗（一表搞定多个 SKU 的当日数据）
  - 异常告警：价格变动 > 10% / 销量飙升 > 20% 自动顶部红条
- **Phase 2：** Qwen 一键生成竞品周报
  - 拉过去 N 天（7/14/30）数据 → Qwen 出 Markdown 报告
  - 报告中心弹窗：左侧历史列表 + 右侧 MD 渲染 + 复制按钮
  - 报告自动存档到 `competitor_reports`
- **Phase 3（刚完成）：** Qwen-VL 截图智能识别 SKU
  - SKU 表单顶部加紫色面板
  - 支持点击上传 / 拖拽 / **Cmd+V 粘贴**
  - Qwen-VL 识别商品名/价格/销量/评分等 → 自动填表
  - 显示置信度（高/中/低）+ 已填字段列表

### 3.6 系统设置（/dashboard/settings）
- AI 模型配置：global / content scope，Qwen / Claude / OpenAI 兼容
- Key 加密存储（aiCrypto AES-256-GCM）
- 用户管理（admin only）

---

## 4. ⚠️ 待完成 / 进行中的任务

### 4.1 竞品情报 — OCR 替换 Qwen-VL（**最新决定，未开工**）
**用户决策：**
- Q1=B：用阿里云**通用文字识别高精版**（`RecognizeAdvanced`）
- Q2=1：凭证直接发给我，加密存数据库（暂未提供）
- Q3=B：完全替代 Qwen-VL，删掉旧代码

**现状：**
- 用户截图显示阿里云 OCR 控制台**还没开通**（"您当前尚未开通OCR统一识别服务"，赠送 200 次/月免费）
- 凭证还没提供

**架构方案（已与用户确认）：**
```
截图 → 阿里云通用 OCR 高精版 → 提取所有文字（带位置）
     → Qwen 文本模型 → 结构化为 JSON 字段
     → 自动填 SKU 表单
```

**待办：**
1. 用户去阿里云控制台**开通 OCR 统一识别服务**
2. 用户提供 AccessKey ID + AccessKey Secret
3. 写新 API：`POST /api/competitors/parse-sku-ocr`（替代 `parse-sku-image`）
4. 阿里云 OCR SDK 调用 + 解析返回的文字
5. 拼到 Qwen prompt → 结构化字段
6. 前端不用改（接口签名兼容即可）
7. 保留 `parse-sku-image`（Qwen-VL）作为备用还是直接删？用户选了 B（删）

**用户需要的环境变量：**
```
ALIYUN_OCR_ACCESS_KEY_ID=xxx
ALIYUN_OCR_ACCESS_KEY_SECRET=xxx
ALIYUN_OCR_REGION=cn-shanghai  # 或开通区域
```

### 4.2 电商销售模块（**用户已确认要做，旺店通对接，未开工**）
- 用户用旺店通已聚合多平台数据
- 计划：手工上传 Excel → 解析入库 → 看板（GMV/订单/退款/ROI）
- Phase B：旺店通 API 自动同步
- 推广费可能要手动录入

### 4.3 其他用户提过但未排期
- 学员真实问题模块（Phase 4 of 选题强化）
- Chrome 插件（用户问过但不做了，先用 OCR + 截图方案）

---

## 5. 必跑的 SQL 迁移（按时间顺序）

⚠️ Supabase 用 `IF NOT EXISTS` / `IF NOT EXISTS` 等幂等语句，可重复跑。

| 文件 | 是否已跑 | 用途 |
|------|---------|------|
| `schema.sql` | ✅（项目初始化） | 11 个模块基础表 |
| `ai_model_configs_v2.sql` | ✅ | AI 配置表 |
| `content_workspace_full.sql` | ✅ | 内容运营 |
| `add_trendradar_source.sql` | ✅ | TrendRadar 平台种子 |
| `hot_source_configs.sql` | ✅ | 热点来源配置 |
| `wx_articles.sql` | ✅ | 公众号文章 P0（3 张表） |
| `wx_articles_p2_images.sql` | ✅ | 配图任务 ID + 图床 bucket |
| `wx_articles_p4_publish.sql` | ✅ | 公众号 access_token 缓存列 |
| `wx_topic_pool.sql` | ✅ | 选题素材库 |
| `personal_notes.sql` | ✅ | 个人笔记 |
| `personal_notes_categories.sql` | ✅ | 笔记板块 |
| `competitor_intelligence.sql` | ✅ | 竞品情报（5 张表 + competitors 加列） |

⚠️ 「✅」是基于上次确认，新换电脑或新 Supabase 项目要重跑。

---

## 6. 环境变量（Vercel + .env.local）

### 必填
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # bypass RLS 用
AI_CONFIG_SECRET=64位hex                # AES 加密 AI key 用
```

### 可选 / 备用
```
ANTHROPIC_API_KEY=sk-ant-...           # Claude 备用（DashScope 失败时回退）
```

### 待加（OCR 模块开发后）
```
ALIYUN_OCR_ACCESS_KEY_ID=xxx
ALIYUN_OCR_ACCESS_KEY_SECRET=xxx
ALIYUN_OCR_REGION=cn-shanghai
```

---

## 7. 关键技术决策（容易踩坑）

### 7.1 Next.js 16 + Turbopack 特殊点
- `params` 是 **Promise**，必须 `await`：
  ```ts
  export async function GET(req, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
  }
  ```
- 不要用 `export const config = { ... }`（已废弃，会有警告）

### 7.2 Supabase 数据访问双客户端
- **客户端**（`src/lib/supabase.ts`）：anon key，受 RLS 限制
- **服务端**（`src/lib/supabaseAdmin.ts`）：service_role，bypass RLS
- **教训**：早期文章列表用客户端 supabase 直查，RLS 没真关掉导致看不到数据。**列表/详情都改走服务端 API + service_role 是稳的**。

### 7.3 RLS 一律 DISABLE，API 层做用户隔离
所有新表都用 `ALTER TABLE xxx DISABLE ROW LEVEL SECURITY`，靠 API 层（`requireUser` / `requireAdmin`）做权限。原因：
- RLS 调试困难，前端遇到 0 数据无报错
- service_role key 反正能 bypass

### 7.4 AI 调用统一走 `aiClient.ts`
- `loadActiveAIConfig(scope)` 从 `ai_model_configs` 加载激活配置
- scope 链：specific → global → 环境变量回退（Claude key）
- ⚠️ **scope 限制**：只允许 `'global'` / `'content'`（在 `/api/ai-config/route.ts` ALLOWED_SCOPES）。新模块（articles / competitors）也用 `scope='content'`，不要单独建 scope。

### 7.5 用户决策记忆（重要规则）
- ✅ **AI 按钮必须显示模型名**（如 `Qwen · 筛选选题`），不能光写 "AI"
  - 已通过 `/api/ai-config/current` 端点 + `<AIButton>` 组件统一处理
- ✅ **完成阶段后自动 `git commit + push`**（触发 Vercel 部署），不要让用户手动 push
- ✅ **响应要简短直接**，用户偏好快节奏
- ✅ **建表 SQL 用 `IF NOT EXISTS`** 等幂等语句，方便重复执行

### 7.6 Vercel Functions 超时
- Hobby 默认 10s，Pro 60s
- 长操作（如配图生成）必须**异步任务 + 前端轮询**模式（参考 `wxImageGen.ts`）
- 不要在单次请求里做 `await Promise.all(generateImage * 4)`

### 7.7 微信公众号 API 的两个老大难
- **IP 白名单**：Vercel 出口 IP 动态，每次报 40164 都要复制 IP 加到公众号后台。**没办法根治**，建议未来用固定 IP 代理。
- **access_token 限调 2000 次/天**：必须 DB 缓存（`wx_publish_configs.access_token + token_expires_at`，提前 60s 续期）

### 7.8 DashScope 端点选择
- **聊天**：用户配置的 base_url（`https://coding.dashscope.aliyuncs.com/v1` 或 `https://dashscope.aliyuncs.com/compatible-mode/v1`）
- **图像生成**（通义万相）：`https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis` 异步 API
- **视觉理解**（Qwen-VL）：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` OpenAI 兼容
- **同一个 API key 通常都能调用**，但要确认账号开通了对应模型

---

## 8. 常用开发命令

```bash
# 本地开发（Next 16 默认 turbopack）
npm run dev

# 构建检查（提交前必跑）
npx next build

# 部署
git push origin main      # 自动触发 Vercel

# 看 commits
git log --oneline -20
```

---

## 9. 用户偏好（来自记忆）

参考 `~/.claude/projects/-Users-sheji-------/memory/`：
- `user_profile.md` — 销售运营负责人，无编程基础
- `feedback_vercel_autosync.md` — 阶段完成自动 commit + push
- `feedback_ai_button_label.md` — AI 按钮要标模型名

---

## 10. 给下一个 Claude / 开发者的提示

1. **永远优先用现有的 hooks/utils**，不要重造轮子（如 `requireUser` / `getAdminClient`）
2. **新建表 SQL 必带 RLS DISABLE**，靠 API 层鉴权
3. **AI 调用走 `generateText({ scope: 'content' })`**，不要直接调 fetch
4. **文件命名约定**：`/api/<resource>/route.ts` + `/api/<resource>/[id]/route.ts`，遵循 Next 16 App Router
5. **每完成一个阶段就 commit + push**，让 Vercel 部署，让用户能立刻看到效果
6. **回答用户偏好简短**，不要长篇大论；他无编程基础但会问犀利问题
7. **改 SQL 模式时，新建独立 migration 文件**（`xxx_add_yyy.sql`），不要改 `schema.sql`
8. **每个新功能加完路由后必跑 `npx next build`**，避免推个挂掉的部署上去

---

**当前 commit：** `955c937` — Qwen-VL 截图智能识别（即将被阿里云 OCR 替换）
