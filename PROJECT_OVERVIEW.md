# PROJECT_OVERVIEW · 品牌经营协同平台 (brand-ops-platform)

> 本文件用于让另一个 AI 在"零上下文"情况下完整理解本项目，并能直接接手开发。
> 生成时间：2026-05-08
> 项目根：`/Users/Admin/管理后台/brand-ops-platform`
> 在线：https://brand-ops-platform.vercel.app
> 仓库：https://github.com/banglongchen6-star/brand-ops-platform

---

## 1. 项目基本信息

### 1.1 项目定位
- **项目名**：`brand-ops-platform`（中文："品牌经营协同平台"）
- **业务主体**：音乐密码（adult piano education，成人钢琴教育品牌）
- **使用对象**：约 10 人内部团队（运营/达人商务/内容/客服/管理层）的**管理后台**
- **核心价值**：把分散的电商运营、达人营销、内容运营、竞品监控、个人笔记/任务等动作集中在一个 Web 系统里，并且**全程嵌入 AI（Qwen / Claude / Qwen-VL）能力**作为加速器
- **特色亮点**：
  - 公众号文章 8 步 AI 写作工作流（选题→大纲→正文→配图→标题→预览→草稿推送）
  - 竞品 SKU 截图 + 阿里云 OCR + Qwen 自动结构化录入
  - 工作笔记 AI 自动识别待办意图 → 一键转任务
  - TrendRadar / DailyHot 多源热榜聚合
  - AI 模型配置后台（按 scope 隔离 + AES-256-GCM 加密 API Key）

### 1.2 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | **Next.js**（App Router + Turbopack） | `16.2.4` |
| 语言 | TypeScript | `^5` |
| UI 库 | React | `19.2.4` |
| 样式 | Tailwind CSS v4（PostCSS plugin） | `^4` |
| 图标 | lucide-react | `^1.8.0` |
| 表单 / DnD | @dnd-kit/core, @dnd-kit/sortable | `^6.3.1` / `^10.0.0` |
| 图表 | recharts（竞品趋势折线图用） | `^3.8.1` |
| Excel | xlsx（销售数据导入用） | `^0.18.5` |
| 工具 | clsx + tailwind-merge（`cn()` 合并 class） | — |
| 后端 | Next.js API Routes（无独立后端） | — |
| 数据库 / 鉴权 | **Supabase**（PostgreSQL + Auth + Storage） | `@supabase/ssr ^0.10.2` + `@supabase/supabase-js ^2.103.2` |
| AI | Anthropic SDK（Claude 备用 + 任务/笔记解析） + DashScope（Qwen 主） | `@anthropic-ai/sdk ^0.90.0` |
| 视觉 AI / OCR | Qwen-VL（已被替换） + 阿里云通用文字识别高精版 | `@alicloud/ocr-api20210707 ^3.1.3` |
| 部署 | Vercel（main 分支自动部署） | — |
| 第三方 API | 微信公众号 API、TrendRadar/newsnow 热榜、通义万相文生图 | — |

### 1.3 状态管理 / 路由

- **没有引入** Redux、Zustand、Jotai 等专门的全局状态库。
- 状态管理策略：
  - 服务器状态：直接 `fetch('/api/...')` + 组件本地 `useState`
  - 用户登录态：通过 Supabase 客户端 (`@supabase/ssr`) 写入 cookie，服务端 `cookies()` 读出
  - 跨组件共享：极少，主要是页面级 `useState`，必要时父组件下传 props
- **路由**：Next.js 16 App Router（`src/app/**/page.tsx` 文件路由）。

### 1.4 关键依赖（来自 `package.json`）

```json
{
  "dependencies": {
    "@alicloud/ocr-api20210707": "^3.1.3",
    "@alicloud/openapi-client": "^0.4.15",
    "@alicloud/tea-util": "^1.4.11",
    "@anthropic-ai/sdk": "^0.90.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@supabase/ssr": "^0.10.2",
    "@supabase/supabase-js": "^2.103.2",
    "clsx": "^2.1.1",
    "lucide-react": "^1.8.0",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.1",
    "tailwind-merge": "^3.5.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### 1.5 ⚠️ 项目特别提醒（来自 `AGENTS.md`）

```text
This is NOT the Next.js you know.
This version (Next 16) has breaking changes — APIs, conventions, and file structure
may all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
```

具体踩过的坑：

- **动态路由 `params` 是 `Promise`**，必须 `await`：
  ```ts
  export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
    // ...
  }
  ```
- 不要用 `export const config = { ... }`（已废弃，会有警告）
- `cookies()` 是异步的：`const cookieStore = await cookies();`

---

## 2. 目录结构

### 2.1 根目录（2 层）

```
brand-ops-platform/
├── AGENTS.md              # ⚠️ 写代码前必读：Next 16 与训练数据有差异
├── CLAUDE.md              # 仅引用 @AGENTS.md @HANDOFF.md
├── HANDOFF.md             # 完整交接文档（业务/SQL/已知坑）⭐ 必读
├── README.md              # create-next-app 默认 README（无业务信息）
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.ts         # 几乎为空
├── eslint.config.mjs
├── postcss.config.mjs
├── next-env.d.ts
├── .env.local             # ⚠️ 含 Supabase / Anthropic / 阿里云 OCR 密钥
├── .gitignore
├── docs/
│   ├── 公众号接入方案.md
│   └── 热点模块.md
├── public/                # 静态资源
├── supabase/              # 所有 SQL 迁移（详见 §9）
└── src/                   # 源码（详见 §2.2）
```

### 2.2 `src/` 详细结构（3 层）

```
src/
├── app/                                    # Next.js App Router 入口
│   ├── layout.tsx                          # 根布局（Geist 字体）
│   ├── globals.css                         # Tailwind v4 入口
│   ├── page.tsx                            # → redirect('/login')
│   ├── login/page.tsx                      # 邮箱密码登录页
│   │
│   ├── dashboard/                          # 登录后所有页面（共享 Sidebar）
│   │   ├── layout.tsx                      # 固定左侧 Sidebar + 主内容区
│   │   ├── home/page.tsx                   # 工作台首页（笔记+任务）
│   │   ├── tasks/page.tsx                  # 任务中心（2767 行）
│   │   ├── sales/page.tsx                  # 电商销售（待开发，占位）
│   │   ├── kol/page.tsx                    # 达人营销
│   │   ├── content/                        # 内容运营
│   │   │   ├── page.tsx                    # 内容运营总览
│   │   │   ├── workspace/                  # 热点工作台（核心）
│   │   │   ├── topics/                     # 选题
│   │   │   ├── trends/                     # 趋势
│   │   │   ├── studio/                     # 制作
│   │   │   ├── hits/                       # 爆款
│   │   │   └── accounts/                   # 账号
│   │   ├── articles/                       # 文字内容（公众号文章 AI 写作）
│   │   │   ├── page.tsx                    # 文章列表
│   │   │   ├── new/page.tsx                # 新建文章入口
│   │   │   ├── [id]/page.tsx               # 8 步工作流（1453 行）
│   │   │   ├── topics/page.tsx             # 选题素材库（含月历视图）
│   │   │   └── settings/page.tsx           # 公众号 AppID/Secret 配置
│   │   ├── channel/page.tsx                # 渠道分销
│   │   ├── service/page.tsx                # 客服中心
│   │   ├── competitor/                     # 竞品情报
│   │   │   ├── page.tsx                    # 竞品卡片总览
│   │   │   └── [id]/page.tsx               # 竞品详情（趋势图+SKU+事件）
│   │   ├── data/page.tsx                   # 数据中心
│   │   ├── review/page.tsx                 # AI 复盘中心
│   │   └── settings/page.tsx               # 系统设置（AI 配置 + 用户管理）
│   │
│   └── api/                                # 服务端 API Routes
│       ├── admin/                          # 用户管理（admin-only）
│       │   ├── create-user/route.ts
│       │   ├── delete-user/route.ts
│       │   └── sync-users/route.ts
│       ├── ai/analyze/route.ts             # 通用 AI 分析端点
│       ├── ai-config/                      # AI 模型配置（admin-only）
│       │   ├── route.ts                    # 列表 / 新增
│       │   ├── [id]/route.ts               # 更新 / 删除
│       │   ├── activate/route.ts           # 切换激活
│       │   ├── current/route.ts            # 取当前激活配置（给 <AIButton> 显示模型名）
│       │   └── test/route.ts               # 连通性测试
│       ├── articles/                       # 公众号文章（CRUD + AI workflow）
│       │   ├── route.ts                    # GET 列表 / POST 创建草稿
│       │   ├── batch-delete/route.ts
│       │   └── [id]/                       # 单篇文章
│       │       ├── route.ts                # GET / PATCH / DELETE
│       │       ├── clone/route.ts          # 克隆
│       │       ├── ai/                     # 8 步 AI 工作流
│       │       │   ├── topics/route.ts     # Step 1: AI 筛选/生成选题
│       │       │   ├── outline/route.ts    # Step 3: AI 大纲
│       │       │   ├── content/route.ts    # Step 4: AI 正文
│       │       │   ├── rewrite/route.ts    # 智能改写
│       │       │   ├── titles/route.ts     # Step 6: AI 生成 5 个标题
│       │       │   └── images/             # Step 5: 配图（异步任务）
│       │       │       ├── start/route.ts
│       │       │       ├── check/route.ts
│       │       │       └── [imgId]/route.ts (+ regenerate)
│       │       ├── images/upload/route.ts  # 手动上传配图
│       │       └── publish/draft/route.ts  # Step 8: 推送到微信草稿箱
│       ├── competitors/                    # 竞品情报
│       │   ├── route.ts                    # 竞品 CRUD
│       │   ├── [id]/route.ts
│       │   ├── [id]/skus/{,[skuId]}/route.ts          # SKU
│       │   ├── [id]/snapshots/route.ts                # 数据快照
│       │   ├── [id]/events/route.ts                   # 事件
│       │   ├── parse-sku-ocr/route.ts                 # ⭐ 阿里云 OCR + Qwen 截图识别
│       │   └── reports/                               # AI 周报
│       │       ├── route.ts (列表)
│       │       ├── [id]/route.ts
│       │       └── generate/route.ts                  # 一键 Qwen 生成周报
│       ├── content/                        # 内容运营 / 热榜
│       │   ├── hot-feed/route.ts           # 拉热榜
│       │   ├── hot-feed/sync/route.ts      # 同步落库
│       │   ├── trends/import/route.ts
│       │   ├── trends/analyze/route.ts     # AI 拆解爆款因子
│       │   ├── analyze-hit/route.ts
│       │   ├── compliance/route.ts
│       │   ├── generate/route.ts
│       │   └── generate-script/route.ts
│       ├── hot-sources/route.ts            # 热点来源配置
│       ├── topic-pool/                     # 选题素材库
│       │   ├── route.ts (CRUD)
│       │   ├── [id]/{,use}/route.ts
│       │   ├── ai-generate/route.ts        # AI 批量生成选题
│       │   └── batch-add/route.ts
│       ├── note-categories/                # 笔记板块（5 个默认）
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── notes/                          # 个人笔记
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   └── [id]/link-task/route.ts     # AI 检测待办 → 链接到任务
│       ├── tasks/                          # 任务中心
│       │   ├── [id]/route.ts
│       │   ├── batch-delete/route.ts
│       │   ├── my-related/route.ts         # 我相关的任务
│       │   ├── parse-minutes/route.ts      # ⭐ Claude 解析会议纪要 → 任务列表
│       │   └── quick-add/route.ts
│       ├── data/                           # 数据中心 / 销售导入
│       │   ├── import/route.ts
│       │   └── sales/route.ts
│       └── wx-publish-configs/             # 公众号账号配置（AppSecret 加密）
│           ├── route.ts
│           └── [id]/route.ts
│
├── components/                             # 复用组件（极少）
│   ├── layout/Sidebar.tsx                  # 左侧导航（含登录用户气泡）
│   └── ui/                                 # 极简 UI 组件
│
└── lib/                                    # 服务端 / 客户端工具库
    ├── aiClient.ts                         # ⭐ 统一 LLM 调用层（Claude / Qwen / OpenAI 兼容）
    ├── aiCrypto.ts                         # AES-256-GCM 加解密 API Key
    ├── requireAdmin.ts                     # API 鉴权：必须是 admin
    ├── requireUser.ts                      # API 鉴权：任何已登录用户
    ├── supabase.ts                         # 浏览器端 Supabase 客户端
    ├── supabaseAdmin.ts                    # 服务端 service_role 客户端（bypass RLS）
    ├── useIsAdmin.ts                       # 客户端 hook：是否 admin（仅 UI 用）
    ├── utils.ts                            # cn() 合并 class
    ├── workspaceSettings.ts
    ├── wxApiClient.ts                      # 微信公众号 API（access_token、上传图、加草稿）
    ├── wxArticlePrompts.ts                 # 6 个 AI prompt 模板
    ├── wxArticleRender.ts                  # Markdown → 公众号内联样式 HTML
    └── wxImageGen.ts                       # 通义万相 + Supabase Storage
```

### 2.3 `supabase/` 目录

所有 SQL 迁移（按时间顺序、幂等可重跑）：

```
supabase/
├── schema.sql                              # 11 张基础表（profiles/tasks/sales_data/kols/...）
├── ai_model_configs.sql                    # AI 配置 v1
├── ai_model_configs_v2.sql                 # AI 配置 v2（加 scope 字段）
├── content_workspace.sql / _full.sql / _migrate_trends.sql
├── add_trendradar_source.sql
├── hot_source_configs.sql
├── fix_hit_factors_columns.sql
├── fix_trends_rls.sql
├── fix_trends_unique.sql
├── wx_articles.sql                         # 公众号文章 P0（3 张表）
├── wx_articles_p2_images.sql               # 配图任务 ID + 图床 bucket
├── wx_articles_p4_publish.sql              # access_token 缓存列
├── wx_topic_pool.sql                       # 选题素材库
├── personal_notes.sql                      # 个人笔记
├── personal_notes_categories.sql           # 板块（5 个默认）
├── personal_notes_linked_tasks.sql
├── add_notes_sort_order.sql
└── competitor_intelligence.sql             # 竞品 SKU/快照/事件/报告
```

---

## 3. 路由与页面清单

### 3.1 公开路由

| 路径 | 文件 | 说明 |
|---|---|---|
| `/` | `src/app/page.tsx` | 服务端 redirect 到 `/login` |
| `/login` | `src/app/login/page.tsx` | 邮箱+密码登录，支持记住账号（localStorage） |

### 3.2 已登录路由（全部以 `/dashboard/*` 开头）

> 鉴权方式：客户端进入 dashboard 页面时由各页面自己 `supabase.auth.getUser()` 检查；
> **真正的权限护栏在服务端 API**（`requireUser` / `requireAdmin`），前端层面没有路由守卫中间件。
> Sidebar 显示登录用户气泡（`profile.full_name + role`），点击登出。

| 路径 | 文件 | 功能简述 | 权限 |
|---|---|---|---|
| `/dashboard/home` | `home/page.tsx` | 工作台首页：5 板块个人笔记 + 右侧任务面板，AI 检测笔记里的待办意图 | 任意已登录 |
| `/dashboard/tasks` | `tasks/page.tsx` | 任务中心 (2767 行)：我的/团队/我创建的 三 tab，年/月筛选 | 任意已登录 |
| `/dashboard/sales` | `sales/page.tsx` | 电商销售（待对接旺店通，目前占位） | 任意 |
| `/dashboard/kol` | `kol/page.tsx` | 达人营销（KOL 档案 + 合作记录） | 任意 |
| `/dashboard/content` | `content/page.tsx` | 内容运营总览 | 任意 |
| `/dashboard/content/workspace` | `content/workspace/page.tsx` | ⭐ 热点工作台（2157 行）：拉 40+ 平台热榜（TrendRadar+DailyHot），AI 拆解爆款因子 | 任意 |
| `/dashboard/content/topics` | `content/topics/page.tsx` | 内容选题 | 任意 |
| `/dashboard/content/trends` | `content/trends/page.tsx` | 趋势 | 任意 |
| `/dashboard/content/studio` | `content/studio/page.tsx` | 制作工作室 | 任意 |
| `/dashboard/content/hits` | `content/hits/page.tsx` | 爆款分析 | 任意 |
| `/dashboard/content/accounts` | `content/accounts/page.tsx` | 账号管理 | 任意 |
| `/dashboard/articles` | `articles/page.tsx` | 文字内容：公众号文章列表 | 任意 |
| `/dashboard/articles/new` | `articles/new/page.tsx` | 新建文章入口 | 任意 |
| `/dashboard/articles/[id]` | `articles/[id]/page.tsx` | ⭐ 公众号 8 步 AI 工作流（1453 行） | 任意 |
| `/dashboard/articles/topics` | `articles/topics/page.tsx` | 选题素材库 + 月历视图 + AI 批量生成 | 任意 |
| `/dashboard/articles/settings` | `articles/settings/page.tsx` | 公众号 AppID/AppSecret 配置 | admin（写入用 service_role） |
| `/dashboard/channel` | `channel/page.tsx` | 渠道分销 | 任意 |
| `/dashboard/service` | `service/page.tsx` | 客服中心 / 工单 | 任意 |
| `/dashboard/competitor` | `competitor/page.tsx` | 竞品总览（卡片，按平台筛选） | 任意 |
| `/dashboard/competitor/[id]` | `competitor/[id]/page.tsx` | ⭐ 竞品详情（916 行）：SKU + recharts 趋势图 + 事件时间线 + AI 周报 + 截图 OCR | 任意 |
| `/dashboard/data` | `data/page.tsx` | 数据中心 / 销售 Excel 导入 | 任意 |
| `/dashboard/review` | `review/page.tsx` | AI 复盘中心（带 "AI" badge） | 任意 |
| `/dashboard/settings` | `settings/page.tsx` | 系统设置（1048 行）：AI 模型配置 + 用户管理 | admin only |

### 3.3 服务端 API 路由（按业务分组）

完整列表见 §2.2。鉴权：
- `/api/admin/*`、`/api/ai-config/*`、`/api/wx-publish-configs/*` → `requireAdmin()`
- `/api/notes/*`、`/api/tasks/*`、`/api/articles/*` 等业务接口 → `requireUser()`
- 部分公开/广义读接口（如 `/api/articles` GET）当前**无显式鉴权**，依赖 Cookie 隔离

---

## 4. 核心功能模块

### 4.1 工作台首页 `/dashboard/home`

| 项 | 说明 |
|---|---|
| 主页面 | `src/app/dashboard/home/page.tsx`（1147 行） |
| 关键 API | `/api/notes`、`/api/note-categories`、`/api/notes/[id]/link-task`、`/api/tasks/my-related`、`/api/tasks/quick-add` |
| 数据表 | `personal_notes`、`personal_notes_categories`、`tasks` |
| 业务逻辑 | 5 个默认板块（电商运营/达人营销/内容运营/渠道分销/客服中心，可改名/换 emoji），笔记按板块卡片化展示，**Markdown 渲染**，编辑后**手动**保存（退出强制 flush，新建后取消会自动删除空笔记）。右侧 4 tab 任务面板（今日/即将/待审/协作）。AI 检测笔记里的"@TODO/@FOLLOW/@IDEA"或自然语言待办意图 → toast 提示一键转任务。 |

### 4.2 任务中心 `/dashboard/tasks`

| 项 | 说明 |
|---|---|
| 主页面 | `tasks/page.tsx`（2767 行，最大单页） |
| 关键 API | `/api/tasks/*`（CRUD 客户端直连 Supabase） + `/api/tasks/parse-minutes`（Claude 解析会议纪要） |
| 数据表 | `tasks`（schema.sql） |
| 业务逻辑 | 三 tab：我的 / 团队 / 我创建的；按年/月筛选（默认本年本月）；**无 due_date 的任务始终通过年月筛选**；批量删除；AI 解析会议纪要批量产任务；快速添加；负责人下拉。 |

### 4.3 文字内容 `/dashboard/articles`（公众号 AI 写作）⭐ 核心模块

8 步 AI 工作流（`articles/[id]/page.tsx` 1453 行）：

```
Step 1  话题筛选：选题素材库 + 今日热榜双源        → /api/articles/[id]/ai/topics
Step 2  选题确认（用户挑选 / 编辑）
Step 3  AI 大纲（Qwen，JSON: intro + sections + conclusion）
        → /api/articles/[id]/ai/outline
Step 4  正文生成（Qwen Markdown）+ 智能改写
        → /api/articles/[id]/ai/content (+ rewrite)
Step 5  配图（通义万相 wanx2.1-t2i-turbo 异步任务 + 手动上传备选，cover/body_1..3）
        → /api/articles/[id]/ai/images/start  →  /check  →  [imgId]/regenerate
Step 6  标题/摘要（Qwen，5 个候选）
        → /api/articles/[id]/ai/titles
Step 7  微信预览（iPhone 手机壳 + Markdown → 内联样式 HTML，可改主题色）
Step 8  发布到微信草稿箱
        → /api/articles/[id]/publish/draft（access_token 缓存 + 图片转上传 + draft API）
```

| 数据表 | 说明 |
|---|---|
| `wx_publish_configs` | 公众号账号（AppID 明文 + AppSecret AES-256-GCM 加密 + access_token 缓存列） |
| `wx_articles` | 文章主表（status: draft/ai_writing/ready/scheduled/published/failed；current_step 1-8；ai_outline JSONB；ai_title_options JSONB；content_md / content_html；wx_draft_media_id / wx_article_url） |
| `wx_article_images` | 文章配图（position: cover/body_1..3；image_url；wx_media_id；status: pending/generating/done/failed） |
| `wx_topic_pool` | 选题素材库（标题、角度、状态、AI 批量生成入库） |

辅助页面：
- `/articles/topics`：列表 + 月历视图，AI 批量生成（先预览再挑选添加）
- `/articles/settings`：公众号 AppID + AppSecret 加密存储

### 4.4 内容运营 `/dashboard/content/workspace` ⭐

| 项 | 说明 |
|---|---|
| 主页面 | `content/workspace/page.tsx`（2157 行） |
| 关键 API | `/api/content/hot-feed/sync`、`/api/content/trends/analyze`、`/api/hot-sources` |
| 数据表 | `content_trends`、`content_platforms`、`content_hit_factors`、`hot_source_configs`、`content_topics` |
| 业务逻辑 | TrendRadar / newsnow（拉 40+ 平台热榜）+ DailyHot 兜底；热点来源 API URL 可在面板配置；平台按数据源分组管理；抖音/微博/B 站/知乎已切到 TrendRadar（DailyHot 不稳）；AI 拆解爆款因子（hook/structure/emotion/topic_angle/audience/format/...） |

### 4.5 竞品情报 `/dashboard/competitor` ⭐

**Phase 1：基础数据**
- 卡片总览（按平台筛选，"我们品牌"+"竞品"分组）
- 详情页：SKU 列表 + recharts 折线图（价/销/评切换）+ 事件时间线
- 批量录入弹窗（一表多 SKU 当日数据）
- 异常告警：价格变动 >10% / 销量飙升 >20% 顶部红条

**Phase 2：AI 周报**
- 拉过去 N 天数据 → Qwen 生成 Markdown 报告
- 报告中心：左侧历史列表 + 右侧 MD 渲染 + 复制按钮
- 自动存档到 `competitor_reports`（content_md + highlights JSONB + competitor_ids UUID[]）

**Phase 3：截图智能识别 SKU（已切到阿里云 OCR）**
- SKU 表单顶部紫色面板，支持点击/拖拽/Cmd+V 粘贴
- 流程：图片 → Supabase Storage（拿公开 URL）→ 阿里云 OCR 高精版 → Qwen 文本结构化 → 自动填表
- 显示 confidence + 已填字段列表
- 旧版 Qwen-VL 端点 `parse-sku-image` 已被 `parse-sku-ocr` 替换

数据表（`competitor_intelligence.sql`）：
- `competitors`（扩展：category / brand_position / followers / priority / is_self / is_archived）
- `competitor_skus`（current_price / original_price / current_sales / monthly_sales / rating / is_hot）
- `competitor_sku_snapshots`（snapshot_date + 当日各字段）
- `competitor_events`（new_product/price_change/promotion/livestream/collab）
- `competitor_reports`

### 4.6 系统设置 `/dashboard/settings`（admin only）

- AI 模型配置：global / content scope，Qwen / Claude / OpenAI 兼容三种 provider
- API Key AES-256-GCM 加密存 `ai_model_configs.api_key_encrypted`，UI 只显示 last4
- 一键测试连通性（`/api/ai-config/test`）
- 用户管理（`/api/admin/create-user|delete-user|sync-users`）

---

## 5. 数据流与状态管理

### 5.1 全局状态

> 没有 Redux / Zustand。"全局状态"实际上只有两类：

1. **登录态** —— Supabase 客户端通过 `@supabase/ssr` 的 `createBrowserClient` 把 session 写到 cookie，
   - 客户端：`supabase.auth.getUser()` 拿用户
   - 服务端：`createServerClient(url, anonKey, { cookies })` 从 cookie 拿到同一个 session
2. **侧栏用户信息** —— `Sidebar.tsx` 自己 `useEffect` 拉 `profiles` 表数据，仅用于显示

页面级状态都是 `useState` + `useEffect` + `fetch('/api/...')`。

### 5.2 API 请求层

**没有封装 axios/fetch wrapper**。每个页面都直接：

```ts
const r = await fetch("/api/articles");
const j = await r.json();
if (!r.ok) { setLoadError(j.error || "加载失败"); }
else { setArticles(j.articles ?? []); }
```

错误处理约定：服务端永远返回 `Response.json({ error: "..." }, { status: 4xx/5xx })`，
前端用 `r.ok` 判断成功 / 失败。**没有统一错误 toast**，各页面自己处理。

### 5.3 鉴权机制

**Token 存储**：Supabase session 写入 httpOnly cookie（由 `@supabase/ssr` 自动管理），refresh token 也由 SDK 后台刷新。前端不手动管理 token。

**双 Supabase 客户端**：
- 客户端 `src/lib/supabase.ts`：anon key，理论上受 RLS 约束
- 服务端 `src/lib/supabaseAdmin.ts`：service_role key，**bypass RLS**

**RLS 策略**：除最早的 `schema.sql` 把 9 张基础表打开 `ENABLE ROW LEVEL SECURITY` 并允许 `authenticated` 全读写之外，
**所有新建表一律 `DISABLE ROW LEVEL SECURITY`**（`personal_notes` / `wx_*` / `competitor_*` 等），
权限完全靠服务端 API 层（`requireUser` / `requireAdmin`）做隔离。

**路由守卫**：
- 没有中间件 / route guard
- 每个 dashboard 页面在 `useEffect` 里自己跑 `supabase.auth.getUser()`，未登录就 `router.push('/login')`
- 真正的权限校验在 API 层

**为什么这么做（来自 HANDOFF.md 的教训）**：
> 早期文章列表用客户端 supabase 直查，RLS 没真关掉导致看不到数据。
> 列表/详情都改走服务端 API + service_role 是稳的。RLS 调试困难，前端遇到 0 数据无报错。

---

## 6. 关键代码片段

### 6.1 浏览器端 Supabase 客户端（`src/lib/supabase.ts`）

```ts
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";

// 使用 @supabase/ssr 的浏览器客户端：同时把 session 写入 cookie，
// 让服务端 requireAdmin 能通过 cookie 读到登录用户。
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// 角色中文映射
export const roleLabels: Record<string, string> = {
  admin: "系统管理员",
  manager: "管理层",
  ecommerce_op: "电商运营",
  kol_manager: "达人商务",
  content_op: "内容运营",
  channel_manager: "渠道经理",
  service: "客服",
  finance: "财务",
  viewer: "只读访客",
};

export const platformLabels: Record<string, string> = {
  tianmao: "天猫", jingdong: "京东", douyin: "抖音", pinduoduo: "拼多多", other: "其他",
};

export const priorityLabels: Record<string, string> = {
  high: "高", medium: "中", low: "低",
};

export const taskStatusLabels: Record<string, string> = {
  pending: "待开始", in_progress: "进行中", review: "待审核",
  completed: "已完成", overdue: "已逾期",
};
```

### 6.2 服务端 service_role 客户端（`src/lib/supabaseAdmin.ts`）

```ts
// 服务端专用 Supabase 客户端 —— 用 service_role key，绕过 RLS
// 只能在 API Route / Server Component 中使用，禁止引入到客户端代码

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getAdminClient() {
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 环境变量未配置 —— 管理员操作不可用");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

### 6.3 用户级 API 守卫（`src/lib/requireUser.ts`）

```ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getAdminClient } from "./supabaseAdmin";

type GuardOk = { ok: true; userId: string };
type GuardFail = { ok: false; response: Response };

export async function requireUser(): Promise<GuardOk | GuardFail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, response: Response.json({ error: "服务端未配置 Supabase" }, { status: 500 }) };
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => { /* noop */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: Response.json({ error: "未登录" }, { status: 401 }) };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles").select("is_active").eq("id", user.id).maybeSingle();
  if (!profile || profile.is_active === false) {
    return { ok: false, response: Response.json({ error: "账号未启用" }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}
```

### 6.4 管理员级 API 守卫（`src/lib/requireAdmin.ts`）

```ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getAdminClient } from "./supabaseAdmin";

export async function requireAdmin(): Promise<GuardOk | GuardFail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, response: Response.json({ error: "服务端未配置 Supabase" }, { status: 500 }) };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: Response.json({ error: "未登录" }, { status: 401 }) };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();

  if (!profile || profile.is_active === false) {
    return { ok: false, response: Response.json({ error: "账号未启用" }, { status: 403 }) };
  }
  if (profile.role !== "admin") {
    return { ok: false, response: Response.json({ error: "仅系统管理员可操作" }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}
```

### 6.5 客户端 admin 判断 hook（仅 UI 用）

```ts
// src/lib/useIsAdmin.ts —— 仅用于 UI 入口显示/隐藏
"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setIsAdmin(false); return; }
      const { data } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!cancelled) setIsAdmin(data?.role === "admin");
    }
    check();
    return () => { cancelled = true; };
  }, []);
  return isAdmin;
}
```

### 6.6 统一 LLM 调用层（`src/lib/aiClient.ts`）

```ts
// 自动读取 ai_model_configs 激活配置；支持 Claude / Qwen / OpenAI 兼容
import Anthropic from "@anthropic-ai/sdk";
import { getAdminClient } from "./supabaseAdmin";
import { decryptKey } from "./aiCrypto";

export interface AIConfig {
  provider: "claude" | "qwen" | "openai_compat";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export const PROVIDER_DEFAULTS: Record<AIConfig["provider"], { model: string; baseUrl: string }> = {
  claude: { model: "claude-opus-4-6", baseUrl: "" },
  qwen: { model: "qwen3.6-plus", baseUrl: "https://coding.dashscope.aliyuncs.com/v1" },
  openai_compat: { model: "", baseUrl: "" },
};

// 回退链：scope 专属 → global → 环境变量（Claude 官方 key）
export async function loadActiveAIConfig(scope: string = "global"): Promise<AIConfig> {
  const admin = getAdminClient();

  async function tryLoad(s: string) {
    const { data } = await admin
      .from("ai_model_configs")
      .select("provider,model,base_url,api_key_encrypted")
      .eq("scope", s).eq("is_active", true).maybeSingle();
    return data;
  }

  try {
    let data = await tryLoad(scope);
    if (!data && scope !== "global") data = await tryLoad("global");
    if (data) {
      return {
        provider: data.provider as AIConfig["provider"],
        model: data.model,
        apiKey: decryptKey(data.api_key_encrypted),
        baseUrl: data.base_url || undefined,
      };
    }
  } catch { /* 回退到环境变量 */ }

  const fallback = process.env.ANTHROPIC_API_KEY;
  if (!fallback) throw new Error("未配置激活的 AI 模型，且环境变量 ANTHROPIC_API_KEY 也缺失");
  return { provider: "claude", model: "claude-opus-4-6", apiKey: fallback };
}

// 统一生成接口：接收 system + user，返回文本
export async function generateText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  config?: AIConfig;
  scope?: string;
}): Promise<string> {
  const cfg = opts.config ?? (await loadActiveAIConfig(opts.scope ?? "global"));

  if (cfg.provider === "claude") {
    const client = new Anthropic({ apiKey: cfg.apiKey });
    const resp = await client.messages.create({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    const tb = resp.content.find((b) => b.type === "text");
    return tb && tb.type === "text" ? tb.text : "";
  }

  // qwen / openai_compat —— OpenAI 兼容 chat/completions
  const baseUrl = (cfg.baseUrl || PROVIDER_DEFAULTS[cfg.provider].baseUrl).replace(/\/$/, "");
  if (!baseUrl) throw new Error("OpenAI 兼容厂商需要配置接口地址 baseUrl");
  const endpoint = `${baseUrl}/chat/completions`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 2048,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`模型调用失败 ${resp.status}: ${text.slice(0, 300)}`);
  }
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

export async function testConfig(cfg: AIConfig) {
  const t0 = Date.now();
  try {
    const out = await generateText({
      system: "你是一个连通性测试探针，只回复一个字：「可」",
      user: "ping", maxTokens: 32, config: cfg,
    });
    return { ok: true, latencyMs: Date.now() - t0, sample: (out || "").slice(0, 50) };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}
```

### 6.7 AES-256-GCM 密钥加解密（`src/lib/aiCrypto.ts`）

```ts
// 需要环境变量 AI_CONFIG_SECRET（64 位 hex = 32 字节）
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const hex = process.env.AI_CONFIG_SECRET;
  if (!hex) throw new Error("AI_CONFIG_SECRET 环境变量未配置");
  if (hex.length !== 64) throw new Error("AI_CONFIG_SECRET 必须是 64 位 hex（32 字节）");
  return Buffer.from(hex, "hex");
}

// 加密：返回 base64(iv(12) | tag(16) | ciphertext)
export function encryptKey(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptKey(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function maskKey(plaintext: string): string {
  if (plaintext.length < 8) return "****";
  return plaintext.slice(-4);
}
```

### 6.8 Sidebar 导航（`src/components/layout/Sidebar.tsx`）

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase, roleLabels } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Users, FileVideo, Store,
  Headphones, BrainCircuit, CheckSquare, Swords, BarChart3,
  Settings, LogOut, Music2, PenLine,
} from "lucide-react";

const navGroups = [
  {
    label: "核心业务",
    items: [
      { href: "/dashboard/home",     label: "工作笔记", icon: LayoutDashboard },
      { href: "/dashboard/tasks",    label: "任务中心", icon: CheckSquare, badge: "今日" },
      { href: "/dashboard/sales",    label: "电商销售", icon: ShoppingCart },
      { href: "/dashboard/kol",      label: "达人营销", icon: Users },
      { href: "/dashboard/content",  label: "内容运营", icon: FileVideo },
      { href: "/dashboard/articles", label: "文字内容", icon: PenLine },
      { href: "/dashboard/channel",  label: "渠道分销", icon: Store },
      { href: "/dashboard/service",  label: "客服中心", icon: Headphones },
    ],
  },
  {
    label: "数据 & 智能",
    items: [
      { href: "/dashboard/competitor", label: "竞品情报",   icon: Swords },
      { href: "/dashboard/data",       label: "数据中心",   icon: BarChart3 },
      { href: "/dashboard/review",     label: "AI复盘中心", icon: BrainCircuit, badge: "AI" },
    ],
  },
  {
    label: "设置",
    items: [
      { href: "/dashboard/settings",  label: "系统设置", icon: Settings },
    ],
  },
];

interface UserProfile { full_name: string | null; role: string | null; }

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles").select("full_name, role").eq("id", user.id).single();
      if (data) setProfile(data);
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const displayName = profile?.full_name || "用户";
  const displayRole = roleLabels[profile?.role || ""] || profile?.role || "成员";
  const avatarChar  = displayName[0]?.toUpperCase() || "U";

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-[#1e1b4b] text-white flex flex-col z-40 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
            <Music2 size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">音乐密码</div>
            <div className="text-[10px] text-violet-300 leading-tight">管理后台 v0.1</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-4 mb-1 text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
              {group.label}
            </div>
            {group.items.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={cn(
                    "flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    active ? "bg-violet-600 text-white"
                           : "text-violet-200 hover:bg-white/10 hover:text-white"
                  )}>
                  <Icon size={16} className="shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {badge && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                      badge === "AI" ? "bg-violet-400 text-white"
                                     : "bg-violet-500/50 text-violet-200"
                    )}>{badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 用户信息 + 退出 */}
      <div className="border-t border-white/10 p-3 shrink-0">
        <button onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-violet-300 hover:bg-white/10 hover:text-white transition-colors group">
          <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-xs font-bold shrink-0">
            {avatarChar}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-xs font-semibold text-white truncate">{displayName}</div>
            <div className="text-[10px] text-violet-400 truncate">{displayRole}</div>
          </div>
          <LogOut size={13} className="shrink-0 opacity-60 group-hover:opacity-100" />
        </button>
      </div>
    </aside>
  );
}
```

### 6.9 Dashboard Layout（`src/app/dashboard/layout.tsx`）

```tsx
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: { children: React.ReactNode; }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* ml-56 为固定侧边栏留出空间 */}
      <main className="flex-1 ml-56 overflow-auto min-h-screen">{children}</main>
    </div>
  );
}
```

### 6.10 登录页（`src/app/login/page.tsx`）

```tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Music2, Loader2, Eye, EyeOff } from "lucide-react";

const REMEMBER_KEY = "music_ops_remember";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const { email: e, password: p } = JSON.parse(saved);
        setEmail(e || ""); setPassword(p || ""); setRemember(true);
      }
    } catch {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");

    if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password }));
    else localStorage.removeItem(REMEMBER_KEY);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("账号或密码错误，请重试");
    else router.push("/dashboard/home");
    setLoading(false);
  };
  // ...（UI 略，紫色渐变 + 玻璃态卡片，Music2 图标）
}
```

### 6.11 文章 CRUD API（`src/app/api/articles/route.ts`）

```ts
// 文章 CRUD —— 列表（GET）+ 创建草稿（POST）
// GET 用 service role 绕过 RLS，避免列表为空诡异 bug
import { getAdminClient } from "@/lib/supabaseAdmin";

export async function GET() {
  const admin = getAdminClient();
  const cols = "id,title,digest,status,current_step,source_topic,ai_topic_input,cover_image_url,word_count,scheduled_at,published_at,created_at,updated_at";
  const minCols = "id,title,digest,status,current_step,source_topic,cover_image_url,word_count,scheduled_at,published_at,created_at,updated_at";
  const first = await admin.from("wx_articles").select(cols).order("updated_at", { ascending: false }).limit(200);

  let articles: Record<string, unknown>[] = [];
  let degraded = false;
  if (first.error) {
    const r = await admin.from("wx_articles").select(minCols).order("updated_at", { ascending: false }).limit(200);
    if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
    articles = r.data ?? []; degraded = true;
  } else {
    articles = first.data ?? [];
  }

  // 兜底封面：从 wx_article_images 找一张已生成的（优先 position='cover'）
  if (articles.length > 0) {
    const ids = articles.map((a) => a.id as string);
    const { data: imgs } = await admin
      .from("wx_article_images")
      .select("article_id, position, image_url, status, created_at")
      .in("article_id", ids).eq("status", "done")
      .order("created_at", { ascending: true });
    const coverByArticle = new Map<string, { url: string; isCover: boolean }>();
    for (const img of imgs ?? []) {
      const url = img.image_url as string;
      if (!url) continue;
      const articleId = img.article_id as string;
      const isCover = img.position === "cover";
      const existing = coverByArticle.get(articleId);
      if (!existing || (isCover && !existing.isCover)) {
        coverByArticle.set(articleId, { url, isCover });
      }
    }
    articles = articles.map((a) => ({
      ...a,
      cover_fallback_url: coverByArticle.get(a.id as string)?.url || "",
    }));
  }

  return Response.json({ articles, degraded });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("wx_articles")
    .insert({
      status: "draft", current_step: 1,
      ai_topic_input: body.ai_topic_input || "",
      title: body.title || "",
      created_by: body.created_by || null,
    })
    .select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}
```

### 6.12 AI 配置 API（`src/app/api/ai-config/route.ts`）

```ts
// AI 模型配置：列表 / 新增。只返回 last4，永不回传密文。
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { encryptKey, maskKey } from "@/lib/aiCrypto";
import { requireAdmin } from "@/lib/requireAdmin";

const ALLOWED_SCOPES = ["global", "content"] as const;
type Scope = typeof ALLOWED_SCOPES[number];

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const admin = getAdminClient();
  let q = admin
    .from("ai_model_configs")
    .select("id,provider,label,model,base_url,api_key_last4,is_active,scope,created_by,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (scope) q = q.eq("scope", scope);
  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = await req.json();
  const provider = body.provider as "claude" | "qwen" | "openai_compat";
  const label = String(body.label ?? "").slice(0, 64);
  const model = String(body.model ?? "").trim();
  const baseUrl = String(body.base_url ?? "").trim();
  const apiKey = String(body.api_key ?? "").trim();
  const activate = Boolean(body.activate);
  const scope = (String(body.scope ?? "global") as Scope);

  if (!["claude", "qwen", "openai_compat"].includes(provider))
    return Response.json({ error: "provider 非法" }, { status: 400 });
  if (!ALLOWED_SCOPES.includes(scope))
    return Response.json({ error: "scope 非法" }, { status: 400 });
  if (!model) return Response.json({ error: "请填写模型名" }, { status: 400 });
  if (!apiKey) return Response.json({ error: "请填写 API Key" }, { status: 400 });
  if (provider !== "claude" && !baseUrl)
    return Response.json({ error: "该厂商需要 base_url" }, { status: 400 });

  const admin = getAdminClient();
  const encrypted = encryptKey(apiKey);
  const last4 = maskKey(apiKey);

  // 激活时：只反激活同 scope 的其它配置（唯一激活约束按 scope 粒度）
  if (activate) {
    await admin.from("ai_model_configs")
      .update({ is_active: false }).eq("scope", scope).eq("is_active", true);
  }

  const { data, error } = await admin
    .from("ai_model_configs")
    .insert({
      provider, label, model, base_url: baseUrl,
      api_key_encrypted: encrypted, api_key_last4: last4,
      is_active: activate, scope, created_by: guard.userId,
    })
    .select("id,provider,label,model,base_url,api_key_last4,is_active,scope,created_by,created_at,updated_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ item: data });
}
```

### 6.13 微信公众号 API 封装（`src/lib/wxApiClient.ts`）

```ts
// 接口文档：https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html
// 重要：access_token 7200s 有效，每日限调 2000 次，必须 DB 缓存
// 重要：调用方 IP 需要在公众号后台 IP 白名单里（Vercel 动态 IP 老大难）

import { getAdminClient } from "./supabaseAdmin";
import { decryptKey } from "./aiCrypto";

const WX_BASE = "https://api.weixin.qq.com/cgi-bin";

export class WxApiError extends Error {
  errcode?: number; raw?: unknown;
  constructor(msg: string, errcode?: number, raw?: unknown) {
    super(msg); this.errcode = errcode; this.raw = raw;
  }
}

// 取/刷新 access_token（提前 60s 续期）
export async function getAccessToken(configId: string): Promise<string> {
  const admin = getAdminClient();
  const { data: cfg, error } = await admin
    .from("wx_publish_configs")
    .select("id, app_id, app_secret_enc, access_token, token_expires_at")
    .eq("id", configId).single();
  if (error || !cfg) throw new WxApiError("公众号配置不存在");

  if (cfg.access_token && cfg.token_expires_at) {
    const exp = new Date(cfg.token_expires_at).getTime();
    if (exp - Date.now() > 60 * 1000) return cfg.access_token;
  }

  const secret = decryptKey(cfg.app_secret_enc);
  const url = `${WX_BASE}/token?grant_type=client_credential&appid=${encodeURIComponent(cfg.app_id)}&secret=${encodeURIComponent(secret)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new WxApiError(`获取 access_token 失败 ${r.status}`);
  const j = await r.json();
  if (j.errcode) throw new WxApiError(wxErrorMessage(j.errcode, j.errmsg), j.errcode, j);

  const token = j.access_token as string;
  const expiresIn = (j.expires_in as number) || 7200;
  await admin.from("wx_publish_configs").update({
    access_token: token,
    token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", configId);
  return token;
}

// 上传正文图片，返回微信 url（直接嵌 HTML，不占素材库）
export async function uploadContentImage(configId: string, imageUrl: string): Promise<{ url: string }> {
  const r = await fetch(imageUrl);
  if (!r.ok) throw new WxApiError("下载图片失败 " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = guessExt(imageUrl, r.headers.get("content-type"));
  const ct = r.headers.get("content-type") || `image/${ext === "jpg" ? "jpeg" : ext}`;
  const token = await getAccessToken(configId);
  const fd = new FormData();
  fd.append("media", new Blob([new Uint8Array(buf)], { type: ct }), `image.${ext}`);
  const up = await fetch(`${WX_BASE}/media/uploadimg?access_token=${token}`, { method: "POST", body: fd });
  const j = await up.json();
  if (j.errcode) throw new WxApiError(wxErrorMessage(j.errcode, j.errmsg), j.errcode, j);
  if (!j.url) throw new WxApiError("微信未返回 url: " + JSON.stringify(j));
  return { url: j.url as string };
}

// 上传永久封面素材，返回 media_id（draft.thumb_media_id 用）
export async function uploadCoverMaterial(configId: string, imageUrl: string)
  : Promise<{ media_id: string; url: string }> {
  // ... 同上，端点改 /material/add_material?access_token=&type=image
}

export interface DraftArticle {
  title: string; author?: string; digest?: string;
  content: string;          // HTML
  content_source_url?: string;
  thumb_media_id: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
}

export async function addDraft(configId: string, article: DraftArticle): Promise<{ media_id: string }> {
  const token = await getAccessToken(configId);
  const body = { articles: [{ ...article, need_open_comment: article.need_open_comment ?? 1, only_fans_can_comment: article.only_fans_can_comment ?? 0 }] };
  const r = await fetch(`${WX_BASE}/draft/add?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.errcode) throw new WxApiError(wxErrorMessage(j.errcode, j.errmsg), j.errcode, j);
  return { media_id: j.media_id as string };
}

function wxErrorMessage(code: number, msg: string): string {
  const friendly: Record<number, string> = {
    40001: "AppSecret 错误或 access_token 失效",
    40013: "AppID 不合法",
    40164: "调用方 IP 不在白名单 — 公众号后台「设置 → 公众号设置 → IP 白名单」需加上 Vercel 出口 IP",
    45009: "接口调用超频",
    45064: "草稿超过上限",
    48001: "API 功能未授权 — 服务号需通过认证",
    61007: "频次超限",
  };
  return `微信 API 错误 ${code}: ${friendly[code] || msg}`;
}
```

### 6.14 阿里云 OCR + Qwen 截图识别 SKU（`src/app/api/competitors/parse-sku-ocr/route.ts`）

```ts
// 截图识别 SKU —— 阿里云 OCR 高精版 + Qwen 结构化
// 流程：图片先传 Supabase CDN → URL 传阿里云 OCR → 文字传 Qwen → 结构化 JSON

import OCRClient, { RecognizeGeneralRequest } from "@alicloud/ocr-api20210707";
import OpenApiClient, { Config } from "@alicloud/openapi-client";
import { RuntimeOptions } from "@alicloud/tea-util";
import { loadActiveAIConfig } from "@/lib/aiClient";
import { createClient } from "@supabase/supabase-js";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const OCR_ENDPOINT = "ocr-api.cn-hangzhou.aliyuncs.com";
const OCR_BUCKET = "wx-article-images";

interface ParsedSku {
  name: string | null;
  current_price: number | null; original_price: number | null;
  current_sales: number | null; monthly_sales: number | null;
  rating: number | null; review_count: number | null;
  category: string | null; platform: string | null;
  is_hot: boolean | null;
  confidence: "high" | "medium" | "low";
  notes: string;
}

function buildOcrClient() {
  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret)
    throw new Error("缺少环境变量 ALIYUN_OCR_ACCESS_KEY_ID / ALIYUN_OCR_ACCESS_KEY_SECRET");
  const config = new Config({ accessKeyId, accessKeySecret, endpoint: OCR_ENDPOINT });
  return new OCRClient(config);
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return Response.json({ error: "缺少 image 字段" }, { status: 400 });
  if (file.size > MAX_SIZE) return Response.json({ error: "图片超过 8MB" }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "只支持图片" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.type.split("/")[1] || "png").toLowerCase().replace("jpeg", "jpg");

  // Step 1：上传到 Supabase Storage，获取公开 URL
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const tempPath = `ocr-temp/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await supabase.storage.from(OCR_BUCKET).upload(tempPath, buf, { contentType: file.type, upsert: true });
  const { data: urlData } = supabase.storage.from(OCR_BUCKET).getPublicUrl(tempPath);
  const publicUrl = urlData.publicUrl;

  // Step 2：阿里云 OCR 通过 URL 识别（避免二进制跨洋传输）
  let ocrText: string;
  try {
    const client = buildOcrClient();
    const request = new RecognizeGeneralRequest({ url: publicUrl });
    const runtime = new RuntimeOptions({ readTimeout: 20000, connectTimeout: 10000 });
    const response = await client.recognizeGeneralWithOptions(request, runtime);
    const data = response?.body?.data;
    const parsed = typeof data === "string" ? JSON.parse(data) : data as Record<string, unknown>;
    const blocks = (parsed as { prism_wordsInfo?: { word?: string }[] })?.prism_wordsInfo ?? [];
    const lines = blocks.map((b) => b.word?.trim()).filter(Boolean) as string[];
    ocrText = lines.join("\n");
    if (!ocrText.trim()) throw new Error("OCR 未识别到任何文字");
  } finally {
    supabase.storage.from(OCR_BUCKET).remove([tempPath]).catch(() => {});
  }

  // Step 3：Qwen 文本模型结构化
  const cfg = await loadActiveAIConfig("content");
  if (cfg.provider !== "qwen") return Response.json({ error: "需要在系统设置把内容 scope 配为 Qwen" }, { status: 400 });

  const prompt = `以下是从电商商品页面截图中通过 OCR 提取的文字...
<ocr_text>
${ocrText}
</ocr_text>
请提取：name / current_price / original_price / current_sales / monthly_sales / rating / review_count / category / platform / is_hot / confidence / notes
严格 JSON 返回，没识别到的字段填 null。`;

  const qwenResp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: prompt }], max_tokens: 1000 }),
  });
  const j = await qwenResp.json();
  const text: string = j?.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return Response.json({ error: "AI 返回格式异常", raw: text.slice(0, 500) }, { status: 500 });
  const parsedSku = JSON.parse(m[0]) as ParsedSku;
  return Response.json({ data: parsedSku, model: `阿里云OCR + ${cfg.model}` });
}
```

### 6.15 会议纪要 → 任务批量解析（`src/app/api/tasks/parse-minutes/route.ts`）

```ts
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODULE_OPTIONS = ["ecommerce","kol","content","channel","service","competitor","finance","management","other"];
const MODULE_LABELS: Record<string, string> = {
  ecommerce: "电商销售", kol: "达人营销", content: "内容运营",
  channel: "渠道分销", service: "客服", competitor: "竞品情报",
  finance: "财务", management: "管理", other: "其他",
};

export async function POST(req: Request) {
  const { text, members } = await req.json();
  if (!text?.trim()) return Response.json({ error: "请输入会议纪要内容" }, { status: 400 });

  const memberList = (members || [])
    .map((m: { id: string; full_name: string | null; email: string }) =>
      `- ${m.full_name || m.email}（id: ${m.id}）`
    ).join("\n");

  const prompt = `你是一个任务管理助手。请从以下会议纪要中提取所有待办任务、行动项、分工安排。
会议纪要内容：
"""
${text}
"""
当前团队成员：
${memberList || "（未提供成员列表）"}
请严格返回 JSON 格式：
{
  "tasks": [
    { "title": "...", "description": "...", "assigned_to_name": "...",
      "assigned_to_id": "...", "priority": "high/medium/low",
      "module": "...", "due_date": "YYYY-MM-DD" }
  ],
  "summary": "..."
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  let jsonText = "";
  for (const block of response.content) if (block.type === "text") { jsonText = block.text; break; }
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return Response.json({ error: "AI 解析格式异常，请重试" }, { status: 500 });
  const result = JSON.parse(jsonMatch[0]);

  const tasks = (result.tasks || []).map((t: Record<string, string | null>) => ({
    ...t,
    module: MODULE_OPTIONS.includes(t.module as string) ? t.module : "other",
    module_label: MODULE_LABELS[t.module as string] || "其他",
    priority: ["high", "medium", "low"].includes(t.priority as string) ? t.priority : "medium",
  }));
  return Response.json({ tasks, summary: result.summary || "", total: tasks.length });
}
```

### 6.16 文章列表页类型定义（`src/app/dashboard/articles/page.tsx` 节选）

```tsx
type ArticleStatus = "draft" | "ai_writing" | "ready" | "scheduled" | "published" | "failed";

interface Article {
  id: string;
  title: string;
  digest: string;
  status: ArticleStatus;
  current_step: number;            // 8 步流程（1-8）
  source_topic: string;
  ai_topic_input: string;
  cover_image_url: string;
  cover_fallback_url?: string;     // 服务端兜底拼出来的
  word_count: number;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusMeta: Record<ArticleStatus, { label: string; color: string; icon: typeof FileText }> = {
  draft:       { label: "起草中",   color: "bg-gray-100 text-gray-700 border-gray-200",       icon: FileText },
  ai_writing:  { label: "AI写作中", color: "bg-violet-100 text-violet-700 border-violet-200", icon: Loader2 },
  ready:       { label: "待发布",   color: "bg-amber-100 text-amber-700 border-amber-200",    icon: Clock },
  scheduled:   { label: "已定时",   color: "bg-blue-100 text-blue-700 border-blue-200",       icon: Calendar },
  published:   { label: "已发布",   color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle2 },
  failed:      { label: "失败",     color: "bg-rose-100 text-rose-700 border-rose-200",       icon: AlertCircle },
};
```

---

## 7. 数据模型

### 7.1 实体表关系总览

```
auth.users
   └── profiles (id PK = auth.users.id)
         ├── tasks (assignee_id, creator_id)
         ├── sales_data (created_by)
         ├── kols (created_by)
         │     └── kol_cooperations (kol_id)
         ├── content_topics (assignee_id, created_by)
         │     └── content_trends → content_hit_factors (trend_id)
         ├── channels (created_by)
         ├── service_tickets (assignee_id, created_by)
         ├── competitors (created_by)
         │     ├── competitor_skus (competitor_id)
         │     │     └── competitor_sku_snapshots (sku_id)
         │     └── competitor_events (competitor_id, related_sku_id)
         ├── competitor_reports (owner_id, competitor_ids[])
         ├── personal_notes (owner_id)
         │     └── personal_notes_categories
         ├── ai_model_configs (created_by)
         └── wx_articles (created_by)
               ├── wx_article_images (article_id)
               └── wx_publish_configs (publish_config_id)
```

### 7.2 关键表字段（schema.sql 节选）

```sql
-- 用户档案（扩展 Supabase auth.users）
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin','manager','ecommerce_op','kol_manager','content_op','channel_manager','service','finance','viewer')),
  department TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 任务
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  module TEXT DEFAULT '',
  assignee_id UUID REFERENCES profiles(id),
  creator_id UUID REFERENCES profiles(id),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','review','completed','overdue')),
  due_date DATE,
  result TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 销售数据
CREATE TABLE sales_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('tianmao','jingdong','douyin','pinduoduo','other')),
  date DATE NOT NULL,
  gmv NUMERIC DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  refund_amount NUMERIC DEFAULT 0,
  ad_spend NUMERIC DEFAULT 0,
  visitor_count INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 达人 / 合作记录
CREATE TABLE kols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('douyin','xiaohongshu','bilibili','weibo','kuaishou','other','')),
  followers_count INTEGER DEFAULT 0,
  category TEXT DEFAULT '', contact TEXT DEFAULT '', wechat TEXT DEFAULT '',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','contacted','negotiating','cooperating','published','reviewed','blacklist')),
  fee NUMERIC DEFAULT 0, cooperation_count INTEGER DEFAULT 0, avg_roi NUMERIC DEFAULT 0,
  /* + notes / created_by / 时间戳 */
);
CREATE TABLE kol_cooperations (
  id UUID PRIMARY KEY,
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  product TEXT, fee NUMERIC, send_sample BOOLEAN, publish_date DATE,
  publish_url TEXT, views INTEGER, likes INTEGER, gmv NUMERIC, roi NUMERIC,
  status TEXT CHECK (status IN ('pending','sent','published','reviewed')),
  /* ... */
);
```

### 7.3 公众号文章表（`wx_articles.sql`）

```sql
-- 公众号配置
CREATE TABLE wx_publish_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  app_id TEXT NOT NULL,
  app_secret_enc TEXT NOT NULL,                       -- AES-256-GCM 加密
  account_type TEXT NOT NULL DEFAULT 'service',       -- service / subscription
  default_author TEXT DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT DEFAULT '',
  -- p4: access_token 缓存（弃用每次都拉，避免 2000 次/日上限）
  access_token TEXT, token_expires_at TIMESTAMPTZ,
  created_at/updated_at TIMESTAMPTZ
);

-- 文章主表
CREATE TABLE wx_articles (
  id UUID PRIMARY KEY,
  publish_config_id UUID REFERENCES wx_publish_configs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
    -- draft / ai_writing / ready / scheduled / published / failed
  current_step SMALLINT DEFAULT 1,                   -- 1-8

  -- 选题
  ai_topic_input TEXT, source_trend_id UUID, source_topic TEXT, source_angle TEXT,
  -- 大纲与正文
  ai_outline JSONB,           -- {intro, sections:[{heading,keypoint,examples}], conclusion}
  content_md TEXT, content_html TEXT,
  -- 标题/摘要
  title TEXT, ai_title_options JSONB, digest TEXT, author TEXT,
  -- 封面
  cover_image_url TEXT, thumb_media_id TEXT,
  -- 发布
  wx_draft_media_id TEXT, wx_article_url TEXT,
  scheduled_at/published_at TIMESTAMPTZ,
  publish_error TEXT,
  -- 统计
  word_count INTEGER, reading_time_min INTEGER,
  -- 元数据
  created_by UUID, created_at/updated_at TIMESTAMPTZ
);

-- 配图
CREATE TABLE wx_article_images (
  id UUID PRIMARY KEY,
  article_id UUID REFERENCES wx_articles(id) ON DELETE CASCADE,
  position TEXT NOT NULL,                            -- cover / body_1 / body_2 / body_3
  prompt_zh TEXT, prompt_en TEXT,
  aspect TEXT DEFAULT '16:9',                        -- 16:9 / 1:1 / 3:4
  image_url TEXT, wx_media_id TEXT,
  status TEXT DEFAULT 'pending',                     -- pending / generating / done / failed
  error TEXT
);
```

### 7.4 竞品情报表（`competitor_intelligence.sql`）

```sql
-- competitors 表扩展字段
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS category         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_position   TEXT DEFAULT '',     -- 高端/中端/性价比
  ADD COLUMN IF NOT EXISTS followers        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority         SMALLINT DEFAULT 3,  -- 1-5
  ADD COLUMN IF NOT EXISTS is_self          BOOLEAN DEFAULT false, -- 我们品牌 vs 竞品
  ADD COLUMN IF NOT EXISTS is_archived      BOOLEAN DEFAULT false;

-- 竞品 SKU
CREATE TABLE competitor_skus (
  id UUID PRIMARY KEY,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  name TEXT NOT NULL, product_url TEXT, category TEXT,
  current_price NUMERIC(10,2), original_price NUMERIC(10,2),
  current_sales INTEGER, monthly_sales INTEGER,
  rating NUMERIC(3,2), review_count INTEGER,
  status TEXT DEFAULT 'active',                       -- active / discontinued / new
  is_hot BOOLEAN DEFAULT false,
  /* + notes / created_at / updated_at */
);

-- 数据快照（趋势图核心）
CREATE TABLE competitor_sku_snapshots (
  id UUID PRIMARY KEY,
  sku_id UUID REFERENCES competitor_skus(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  price NUMERIC(10,2), sales INTEGER, monthly_sales INTEGER,
  rating NUMERIC(3,2), review_count INTEGER, in_stock BOOLEAN,
  recorded_by UUID REFERENCES profiles(id)
);

-- 重要事件
CREATE TABLE competitor_events (
  id UUID PRIMARY KEY,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  related_sku_id UUID REFERENCES competitor_skus(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,    -- new_product / price_change / promotion / livestream / collab / other
  title TEXT NOT NULL, description TEXT,
  event_date DATE NOT NULL,
  impact_level TEXT DEFAULT 'medium',  -- high / medium / low
  recorded_by UUID
);

-- AI 周/月报存档
CREATE TABLE competitor_reports (
  id UUID PRIMARY KEY,
  owner_id UUID,
  report_type TEXT NOT NULL DEFAULT 'weekly',  -- weekly / monthly / on_demand
  period_start DATE, period_end DATE,
  content_md TEXT NOT NULL DEFAULT '',
  highlights JSONB,
  competitor_ids UUID[]
);
```

### 7.5 个人笔记 / 板块（`personal_notes*.sql`）

```sql
CREATE TABLE personal_notes (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL DEFAULT '速记',
  content_md TEXT DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_archived BOOLEAN DEFAULT false,
  -- AI dedup
  last_detect_len INTEGER DEFAULT 0,
  last_detect_at TIMESTAMPTZ,
  created_at/updated_at TIMESTAMPTZ
);
-- 5 个默认板块（电商运营/达人营销/内容运营/渠道分销/客服中心）
CREATE TABLE personal_notes_categories (
  id UUID PRIMARY KEY,
  owner_id UUID, name TEXT, emoji TEXT, sort_order INT, ...
);
```

### 7.6 AI 模型配置（`ai_model_configs_v2.sql`）

```sql
CREATE TABLE ai_model_configs (
  id UUID PRIMARY KEY,
  provider TEXT CHECK (provider IN ('claude','qwen','openai_compat')),
  label TEXT, model TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  api_key_encrypted TEXT NOT NULL,    -- AES-256-GCM
  api_key_last4 TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  scope TEXT NOT NULL DEFAULT 'global',  -- 'global' / 'content'（ALLOWED_SCOPES 见 §6.12）
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at/updated_at TIMESTAMPTZ
);
-- 唯一约束：每个 scope 最多一条 is_active = true
CREATE UNIQUE INDEX uniq_ai_config_active_per_scope
  ON ai_model_configs (scope, is_active) WHERE is_active = true;

-- RLS：拒绝 anon，只允许 service_role
ALTER TABLE ai_model_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon_all" ON ai_model_configs
  FOR ALL TO anon USING (false) WITH CHECK (false);
```

### 7.7 关键 TypeScript 类型

```ts
// AI
export interface AIConfig {
  provider: "claude" | "qwen" | "openai_compat";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

// 文章
type ArticleStatus = "draft" | "ai_writing" | "ready" | "scheduled" | "published" | "failed";
interface Article {
  id: string; title: string; digest: string;
  status: ArticleStatus; current_step: number;
  source_topic: string; ai_topic_input: string;
  cover_image_url: string; cover_fallback_url?: string;
  word_count: number;
  scheduled_at: string | null; published_at: string | null;
  created_at: string; updated_at: string;
}

// 竞品 OCR 结构化
interface ParsedSku {
  name: string | null;
  current_price: number | null; original_price: number | null;
  current_sales: number | null; monthly_sales: number | null;
  rating: number | null; review_count: number | null;
  category: string | null; platform: string | null;
  is_hot: boolean | null;
  confidence: "high" | "medium" | "low";
  notes: string;
}

// 公众号草稿
export interface DraftArticle {
  title: string; author?: string; digest?: string;
  content: string;          // HTML
  content_source_url?: string;
  thumb_media_id: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
}

// API 守卫
type GuardOk = { ok: true; userId: string };
type GuardFail = { ok: false; response: Response };
```

---

## 8. 已知问题 / TODO / 特殊约定

### 8.1 代码内 TODO/FIXME

代码里没有 `TODO/FIXME/HACK` 标记（grep 全仓只命中一处工作笔记中的标签解析 `@(?:TODO|FOLLOW|IDEA)`，是业务功能，不是技术 TODO）。

### 8.2 待开发 / 进行中（来自 HANDOFF.md）

1. **OCR 替换 Qwen-VL 已完成**（当前 commit `955c937` 之后的状态：`/api/competitors/parse-sku-ocr` 已用阿里云高精版 OCR + Qwen 文本结构化重写）。
2. **电商销售模块（旺店通对接）** — 用户已确认要做：
   - Phase A：手工上传 Excel → 解析入库 → 看板（GMV/订单/退款/ROI）
   - Phase B：旺店通 API 自动同步
   - 推广费可能要手动录入
3. **学员真实问题模块**（选题强化 Phase 4）— 未排期
4. **Chrome 插件**（用户问过但放弃，先用 OCR + 截图方案）

### 8.3 项目特有约定（重要）

| # | 约定 | 原因 |
|---|---|---|
| 1 | **新表一律 `DISABLE ROW LEVEL SECURITY`，权限走 API 层** | RLS 调试困难，前端遇到 0 数据无报错；service_role 反正能 bypass |
| 2 | **列表/详情走服务端 API + service_role**，不要客户端 supabase 直查 | 早期文章列表客户端直查导致空列表 bug |
| 3 | **AI 调用统一走 `generateText({ scope: 'content' })`**，不要直接 fetch | 才能享受配置中心、激活切换、密钥加密 |
| 4 | **AI 配置 scope 仅允许 `'global'` 或 `'content'`** | 见 `/api/ai-config/route.ts:ALLOWED_SCOPES`；新模块也共用 `content`，不要单独建 scope |
| 5 | **AI 按钮 UI 必须显示模型名**（如 `Qwen · 筛选选题`） | 通过 `/api/ai-config/current` + `<AIButton>` 统一处理 |
| 6 | **完成阶段后自动 `git commit + push`**（触发 Vercel 部署） | 用户偏好，不要让用户手动 push |
| 7 | **响应要简短直接** | 用户偏好快节奏，无编程基础 |
| 8 | **建表 SQL 用 `IF NOT EXISTS` 等幂等语句**，可重复执行 | 方便换电脑 / 重建 Supabase |
| 9 | **改 SQL 模式时新建独立 migration 文件**（`xxx_add_yyy.sql`），不要改 `schema.sql` | 历史可追溯 |
| 10 | **每个新功能加完路由后必跑 `npx next build`** | 避免推个挂掉的部署上去 |
| 11 | **Vercel Functions 超时 10s（Hobby）/ 60s（Pro）**：长操作必须**异步任务 + 前端轮询** | 参考 `wxImageGen.ts`、`wx_article_images.status` 字段 |
| 12 | **微信公众号 IP 白名单**：Vercel 出口 IP 动态，每次 40164 报错都要复制 IP 加到公众号后台 | 没有根治办法 |
| 13 | **Next 16 动态路由 `params` 是 Promise**，必须 `await` | breaking change，AGENTS.md 强调 |
| 14 | **API Route 文件命名约定**：`/api/<resource>/route.ts` + `/api/<resource>/[id]/route.ts` | 遵循 Next 16 App Router |
| 15 | **`@/` 路径别名**指向 `./src/`（见 tsconfig.json） | — |

### 8.4 DashScope 端点选择（同一 API key 通常都能用）

| 用途 | 端点 |
|---|---|
| 聊天（OpenAI 兼容） | 用户配置的 baseUrl，如 `https://coding.dashscope.aliyuncs.com/v1` 或 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 图像生成（通义万相） | `https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis`（异步） |
| 视觉理解（Qwen-VL，已弃用） | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |

### 8.5 微信 API 错误码友好映射

```
40001  AppSecret 错误或 access_token 失效
40013  AppID 不合法
40164  调用方 IP 不在白名单 — 公众号后台「设置 → 公众号设置 → IP 白名单」需加上 Vercel 出口 IP
45009  接口调用超频
45064  草稿超过上限
48001  API 功能未授权 — 服务号需通过认证
61007  频次超限
```

---

## 9. 配置文件

### 9.1 `next.config.ts`（几乎为空）

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  /* config options here */
};
export default nextConfig;
```

### 9.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts", "**/*.ts", "**/*.tsx",
    ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

### 9.3 `eslint.config.mjs`

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**", "out/**", "build/**", "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

### 9.4 `postcss.config.mjs`

```js
const config = {
  plugins: ["@tailwindcss/postcss"],
};
export default config;
```

### 9.5 `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",         // Next 16 默认用 turbopack
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

### 9.6 环境变量（`.env.local` 模板）

> ⚠️ 真实密钥不要写进文档/仓库。下面是占位示例。

```bash
# ── 必填 ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...        # bypass RLS
AI_CONFIG_SECRET=<64位hex（32字节，AES-256 加密 AI key 用）>

# ── 备用 / 兜底 ─────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-xxx                       # Claude 兜底（DashScope 失败/未配置时）

# ── 阿里云 OCR（竞品截图识别用）─────────────────────────
ALIYUN_OCR_ACCESS_KEY_ID=LTAI5t...
ALIYUN_OCR_ACCESS_KEY_SECRET=xxxxxxxx
# 区域硬编码在 src/app/api/competitors/parse-sku-ocr/route.ts:OCR_ENDPOINT
# = 'ocr-api.cn-hangzhou.aliyuncs.com'
```

### 9.7 Supabase Storage Bucket

| Bucket | 用途 |
|---|---|
| `wx-article-images` | 公众号文章配图（通义万相生成） + 临时 OCR 截图（`ocr-temp/*`，识别完即删） |

### 9.8 部署流程

```bash
npm run dev          # 本地开发（Next 16 默认 turbopack）
npx next build       # 提交前必跑（确保不会推个挂掉的版本）
git push origin main # 自动触发 Vercel 部署
```

---

## 10. 给下一个 AI / 开发者的提示（来自 HANDOFF.md）

1. **永远优先用现有的 hooks/utils**，不要重造轮子（如 `requireUser` / `getAdminClient` / `generateText` / `cn`）
2. **新建表 SQL 必带 RLS DISABLE**，靠 API 层鉴权
3. **AI 调用走 `generateText({ scope: 'content' })`**，不要直接调 fetch，除非是图像/OCR 等特殊端点
4. **文件命名约定**：`/api/<resource>/route.ts` + `/api/<resource>/[id]/route.ts`，遵循 Next 16 App Router
5. **每完成一个阶段就 commit + push**，让 Vercel 部署，让用户能立刻看到效果
6. **回答用户偏好简短**，不要长篇大论；他无编程基础但会问犀利问题
7. **改 SQL 模式时，新建独立 migration 文件**（`xxx_add_yyy.sql`），不要改 `schema.sql`
8. **每个新功能加完路由后必跑 `npx next build`**，避免推个挂掉的部署上去
9. **Next 16 动态路由 `params` 必须 `await`** —— 这是最容易踩的坑
10. **永远不要把 `service_role` key 引入到客户端代码**（`src/lib/supabaseAdmin.ts` 仅供 API/Server Component 使用）

---

**生成自：** `/Users/Admin/管理后台/brand-ops-platform`
**核心文档来源：** `HANDOFF.md`、`AGENTS.md`、`package.json`、`src/lib/*`、`src/app/**`、`supabase/*.sql`
**最近一次代码盘点（基于 commit `955c937` 之后的工作树）：** 截图识别已切到阿里云 OCR；电商销售模块尚未开工。
