---
date: 2026-08-23
week: 4
owner: Leah
status: 完成
---

# Week 4 周报：后台编辑器界面

## 完成项（对照 P0 落地规划 §12 Week 4 + §10）

- [x] `apps/admin/` Vite+Vue3+TS 工程初始化（复用原型 css 视觉）
- [x] 5 导航布局（工作台/文档/审核/发布/待办），文档页可点，其他占位
- [x] 文档列表页（接 `GET /api/docs`，后端补的端点）
- [x] CodeMirror 6 双栏编辑器（左编辑高亮 + 右 markdown-it 预览）+ 基础工具栏
- [x] 接 API：打开文档填编辑器+记 base_commit，保存调 /api/docs/save，提交审核调 /api/docs/submit-review
- [x] 冲突弹窗（接 409）

**验收结果（判断标准全部达成）**：打开 quickstart.mdx → CodeMirror 语法高亮（行号+内容）→ 右侧实时预览 → 保存（commit 145a7b55 + draft 分支）→ 提交审核 → **Coding 上出现 MR #3**（coding.jd.com/liangyuanwen.1/doc/merges/3）。链路通了。

## 技术决策

- **重搭 Vite+Vue 工程，不在 CDN 原型上改**（Leah 决定）：CDN + window 全局变量接 API 会越改越乱，后面 6 周被拖死。重搭底座换正经工程。
- **复用原型视觉**：copy 原型 css/style.css（585 行，含完整 CSS 变量 token：primary #4f46e5、bg #f8fafc、border #e2e8f0、radius 8px、sidebar 260px）+ remixicon CDN。后台用原型配色（和前台 Vercel 风格不同）。
- **CodeMirror 6 基础版**：只做语法高亮 + 双栏预览 + 基础工具栏（标题/粗体/斜体/链接/代码块/列表）。组件插入面板/AI/协同/vim 都不做。

## 实现要点

### CodeMirror 6 + Vue3 集成
CM6 是命令式 API，Vue 是声明式。Editor.vue 用 ref 拿 DOM，onMounted 初始化 EditorView（lineNumbers + history + lang-markdown + lineWrapping + updateListener），onUnmounted destroy。doc 变化驱动预览（updateListener 监听 docChanged → markdown-it 渲染）。不能用 v-model。

### 后端补 GET /api/docs
规划没列这个端点但前端列表需要。扫 content-repo/content 目录，解析每个 mdx frontmatter，返回 `[{slug, title, category, status, updated}]`。slug 从路径派生（quickstart/index.mdx→quickstart）。

### 链路编排（DocsView.vue）
- open：`POST /api/docs/open` → markdown 填 CodeMirror + 存 base_commit
- save：`POST /api/docs/save {slug, markdown, base_commit, user}` → 成功提示 commit+branch，更新 base_commit；409 → 弹冲突弹窗（用我的覆盖 / 放弃我的改动）
- submit：先 save 确保有 draft 分支 → `POST /api/docs/submit-review` → 弹 MR URL（可点开 Coding）

### 工具栏
6 个按钮：标题（insertLine `## `）、粗体（insert `**...**`）、斜体、链接、代码块、列表。用 CodeMirror dispatch 在光标处插入。

## 踩坑记录

1. **vite 代理 ECONNREFUSED**：vite.config proxy target 用 `http://localhost:3001` 连不上（localhost 解析到 IPv6 ::1，后端没监听 IPv6）。改 `http://127.0.0.1:3001` 解决。admin 日志看到 `http proxy error: /api/docs ECONNREFUSED` 定位。
2. **@codemirror/commands 没装**：defaultKeymap/history 从这个包来，单独装 `@codemirror/commands@6.11.0`。
3. **CDP eval 异步 fetch 超时**：调试时 async eval 卡住，因为代理没通 fetch 不返回。代理修好后正常。

## 启动方式

```bash
# 后端
cd apps/backend && env -u PORT pnpm dev   # :3001
# 前端
cd apps/admin && pnpm dev                  # :5173
# 浏览器开 http://localhost:5173 → 文档页
```

## 验证过程（真实走了一遍）

1. 打开 :5173 → 5 导航侧边栏 + 文档列表（3 篇文档，从 GET /api/docs 加载）
2. 点 quickstart → 编辑器加载：CodeMirror 行号 1-26 + markdown 内容高亮，右侧预览"5 分钟拿到 API Key…"
3. 点保存草稿 → toast"已保存：commit 145a7b55，分支 draft/quickstart-1787489388293"
4. 点提交审核 → 弹窗"合并请求 #3 已创建：https://coding.jd.com/liangyuanwen.1/doc/merges/3"
5. gitbeaker 确认 MR #3 在 Coding（iid=3, source=draft分支, target=main, title="docs: quickstart 待审核（by leah）"）
6. 清理：关闭 MR #3，删 draft 分支

## 未完成项 / 已知问题

- **预览不渲染 MDX 组件**：markdown-it 渲染普通 Markdown，`<Callout>` 等 MDX 组件标签原样显示为文本。Week 6 组件插入面板时再处理（或接前台 mdx-to-md 渲染）。
- **Frontmatter 只读**：open 返回 frontmatter 但编辑器没表单编辑（Week 5+）。当前编辑器只编辑 body，frontmatter 不变。
- **冲突弹窗"用我的覆盖"逻辑**：当前是重新 open 拿最新 base_commit 让用户再保存，不是真"覆盖"。P0 二选一够用（规划 §14 第 10 条），但交互可优化。
- **其他 4 导航占位**：工作台/审核/发布/待办显示"建设中"，Week 5 做审核队列。
- **无登录**：user 硬编码 leah，Week 8 埋点时做登录。

## 下周计划（Week 5：GitHub/Coding webhook + 审核队列）

- [ ] `POST /api/webhook/gitlab`（MR opened/closed/merged 事件，GitLab payload）
- [ ] 审核队列合并两来源（Web 提交 + GitLab MR）
- [ ] `GET /api/review-tasks`（Week 3 表已就绪）
- [ ] 审核 UI：查看 diff、通过（merge MR）、驳回（close MR）
- [ ] 后台审核队列页接真实数据（替换 Week 4 占位）

## 阻塞项

无。Week 4 所有阻塞已解决。

需 Leah 留意：
1. **后端部署到 116.196.90.213**：Week 5 webhook 要打到这个地址。本地跑通后部署。
2. **MR 会越积**：测试已清理（MR #3 关闭 + draft 分支删）。Week 5 审核闭环后自动清理。
3. **后台配色和前台不同**：后台用原型靛蓝 #4f46e5，前台用 Vercel 蓝 #0070f3。是有意的（后台 PM 工具、前台用户文档，视觉区分）。如要统一后续再说。

---

# Week 4 升级：后台编辑器重点化 + AI 辅助写作

Leah 试用基础版后判断「编辑器是重头戏」，把 AI 辅助写作从 P1/Week 7 前置进来一起做透。AI 4 能力全做（先 mock 后接）。

## 升级完成项

### 1. 预览升级为 MDX-aware 渲染
- **根因修复**：后端 open 返回的 markdown 是 MDX 源（含 `<Callout>` 标签原文），原 markdown-it 把 JSX 当裸 HTML 渲染，显示成空标签。
- **新建 `apps/admin/src/lib/parse-mdx.ts`**：把 MDX 源切成「普通 markdown 段」+「组件块」两种段。正则匹配 6 个白名单组件（Callout/Steps/CodeTabs/Params/InternalOnly/NextSteps），轻量解析 props（字符串/布尔/数组对象）。
- **新建 `apps/admin/src/components/preview/`**：MdxPreview.vue 入口 + 6 个 Vue 预览组件，镜像前台 React 组件的 Vercel neutral 视觉（同样的颜色/边框/间距/图标）。
- **新建 `apps/admin/src/styles/preview.css`**：复制前台 globals.css 的 Vercel 变量 + .prose-doc 节奏，scope 到 `.mdx-preview` 容器，不污染 admin 靛蓝外壳。含暗色变量（`.dark .mdx-preview`）。
- **容错**：解析失败的组件块降级显示「⚠️ 语法可能有误」+ 原文，不白屏。
- **不引入 Tailwind**（避免和靛蓝外壳冲突 + preflight 污染），用 scoped CSS 实现前台视觉。

### 2. 组件插入
- 工具栏第二区加 6 组件按钮。
- 简单组件（Callout/Steps/InternalOnly/NextSteps）：点按钮直接插标准模板 MDX 片段。
- 复杂组件（CodeTabs/Params）：`ComponentInsertDialog.vue` 轻量表单填参，实时预览生成的 MDX，确认后插入。
- 复用 Week 4 已有的 `view.dispatch({ changes: { from, insert } })` 模式。

### 3. AI 辅助写作（4 能力，mock 实现）
**后端**（API key 留服务端，后接真模型只改一个文件）：
- `apps/backend/src/services/ai.ts`：rewrite/complete/generate/audit 4 函数，mock 实现（setTimeout 模拟延迟 + 规则化响应）。rewrite 4 模式（精简/扩写/纠错/改语气）用正则做文本变换；audit 检查口语化/标点/链接/技术准确性/重复标题。
- `apps/backend/src/routes/ai.ts`：`aiRoutes(app)` 插件，4 个 POST 端点。server.ts 注册。

**前端 4 能力交互**：
- **选中改写**：选中文本浮菜单（精简/扩写/纠错/改语气）→ dispatch 替换选区。
- **续写补全**：工具栏按钮，取光标前 800 字上下文，返回文本在光标处插入并选中（可撤销）。不做 ghost text（避免装 autocomplete + 它是下拉补全非行内幽灵文本）。
- **从描述生成**：右侧抽屉，输入描述 → 生成 → 可编辑 → 插入光标处。
- **文档体检**：工具栏按钮，调 audit 全文，右侧面板列问题清单（分类标签），点击条目跳转编辑器对应位置。

### 4. 编辑交互
- **自动保存草稿**：防抖 3s 存 localStorage（`draft:<slug>`），刷新不丢。后端 save 仍手动（提交审核前必须正式 save）。不落库。
- **撤销重做**：工具栏按钮 + Cmd+Z/Cmd+Shift+Z。
- **查找替换**：装 `@codemirror/search`，Cmd+F/Cmd+H。
- **离开拦截**：脏状态 beforeunload + 切换文档确认。

### 5. 状态反馈 + 体验
- **状态条**：编辑器底部显示 `保存中…` / `已保存` / `未保存更改` / `冲突！` / `MR #iid 已创建 →链接` / `AI 处理中…`。
- **双栏拖拽调宽**：中间 divider 拖拽调编辑/预览比例，存 localStorage。
- **暗色切换**：App.vue 顶部日/月图标，切 `.dark` class 到 html，持久化 localStorage。预览区跟随暗色（preview.css 的 `.dark .mdx-preview` 变量）。

## 工具栏最终形态（21 按钮）

返回列表 | 撤销 重做 查找 | 标题 粗体 斜体 链接 代码块 列表 | Callout Steps CodeTabs Params InternalOnly NextSteps | AI续写 AI生成 文档体检 | 保存草稿 提交审核

## 验证结果（真实走了一遍）

1. 列表 → 点 quickstart → 编辑器加载，**右侧预览实时渲染 MDX 组件**：2 Callout + 3 Steps + 1 InternalOnly（不再裸标签）。
2. 点 Callout 按钮 → 插入模板 → 编辑器 26→30 行 + 预览 Callout 2→3 个（实时）。
3. 点文档体检 → 面板列 2 个标点问题（mock 规则命中）。
4. AI 续写/生成/改写后端端点全 200（curl 验证 4 端点 + 日志确认前端请求打过来）。
5. 保存 → commit 6742a9c4 + draft 分支 + 状态条"已保存" + toast 详情。
6. 暗色切换 → html.dark + 图标变太阳 + 预览区跟暗色。
7. 测试产物清理（draft 分支本地+远端删除）。

## 升级后的技术决策

- **预览不引入 Tailwind**：admin 无 Tailwind 且靛蓝外壳和前台 Vercel 冲突，用 scoped CSS 镜像前台视觉更干净。
- **6 组件用 Vue 重写而非复用**：前台是 React 不能直接 import；逻辑薄（5/6 纯渲染），移植成本低。
- **AI 放后端不放前端**：API key 留服务端，mock 后接真模型只改 `services/ai.ts` 一个文件，前端 4 函数不变。
- **续写不做 ghost text**：`@codemirror/autocomplete` 是下拉补全非行内幽灵文本，直接光标处插入+选中可撤销更顺，零新依赖。

## 升级后已知问题

- **Steps 内嵌 `<div>` 渲染**：quickstart 的 Steps 用 `<div>` 包裹步骤，markdown-it 把 `<div>` 当 HTML 块，里面 `**粗体**` 没渲染。是内容写法问题，非预览器 bug。可后续让 Steps 预览组件对 `<div>` 子节点再走一次 markdown-it。
- **AI 全是 mock**：rewrite 是正则规则，generate 是关键词套模板，audit 是固定规则。后接真模型换 `services/ai.ts` 实现即可。
- **无登录**：仍硬编码 leah（Week 8）。
