---
date: 2026-08-23
week: 1
owner: Leah
status: 完成
---

# Week 1 周报：前台文档站骨架

## 完成项（对照 P0 落地规划 §12 Week 1）

- [x] `apps/site/` 初始化 Next.js App Router + pnpm
- [x] 装 contentlayer2 + Tailwind + shadcn/ui + lucide-react + shiki + next-themes（pagefind 装但未接线，搜索推后）
- [x] 5 个白名单组件 Web 渲染（`src/components/mdx/`）：Callout / Steps / CodeTabs / Params / InternalOnly
- [x] 3 篇样板 MDX：quickstart/index.mdx、api/chat-completions.mdx、troubleshooting/errors.mdx
- [x] 深浅色 + 布局 + 顶部导航 + 侧边栏
- [x] Stripe 设计风格落地（覆盖 shadcn 默认主题）

**验收结果**：`pnpm dev` 起前台，首页 + 3 篇文档全部 HTTP 200，5 个组件渲染正常（curl 逐项校验通过）。

## 关键技术决策与偏差

### 1. 技术栈版本：实际用了 Next 16 + Tailwind 4（比规划的 14+TW3 新）

create-next-app@latest 装的是 Next.js 16.3.2 + React 19 + Tailwind CSS 4。规划写"Next.js 14+"，16 满足"+"，保留。Tailwind 4 配置方式改为 CSS-first（`@theme` 指令，无 tailwind.config.ts），已适配。

### 2. contentlayer2 + Next 16 + Tailwind 4 的三方兼容（本周最大工程难点）

踩了三个坑，逐个解决：

| 坑 | 现象 | 根因 | 解法 |
|---|---|---|---|
| Turbopack 报 `Missing field turbopackMemoryEviction` | dev server 启动即崩 | 当前 shell 环境被另一个 Next 项目污染（`__NEXT_PRIVATE_STANDALONE_CONFIG` 指向别的项目） | 启动时 `env -u TURBOPACK -u __NEXT_PRIVATE_STANDALONE_CONFIG` 清掉污染变量 |
| webpack 模式下 Tailwind 4 的 `@import "tailwindcss"` 解析失败 | 全站 500，`next-flight-css-loader` 不认 `@` | Tailwind 4 为 Turbopack 设计，webpack 的 CSS loader 不支持其新语法 | 必须用 Turbopack，不能退回 webpack |
| contentlayer2 注入 webpack 配置，与 Turbopack 冲突 | Turbopack 报"webpack config with no turbopack config" | contentlayer2 的 `withContentlayer` 内部挂 webpack 钩子 | next.config 加空 `turbopack: {}`（contentlayer 在构建期跑，不依赖运行时 bundler） |

**最终方案**：Next 16 Turbopack（默认）+ contentlayer2 + 空 `turbopack: {}`。dev/build 启动前需在干净 shell 跑（不要带其他 Next 项目的环境变量）。

### 3. 路由结构：`(docs)` 路由组改成 `docs` 真实段

最初用 `src/app/(docs)/[...slug]/`（路由组），结果 `[...slug]` 把 URL 里的 `docs` 也吃掉，slug 变成 `docs/quickstart` 导致 404。改成 `src/app/docs/[...slug]/`（真实 `docs` 路由段）后正常。

### 4. contentlayer2 读取外部目录：方案验证通过

`content-repo/content` 是独立 git 仓库，`contentlayer.config.ts` 用 `contentDirPath: path.resolve(process.cwd(), '../../content-repo/content')` 成功读取，生成 3 篇文档。风险点 1 验证通过，无需 symlink 兜底。

## 5 个组件实现情况

每个组件 Web 渲染完成，并导出 `toMarkdown` 签名（Week 1 只 throw，Week 2 的 `mdx-to-md.ts` 实现导出逻辑）：

| 组件 | Web 渲染 | toMarkdown 接口 |
|---|---|---|
| Callout | ✓ 四色变体（info/warning/danger/success），lucide 图标 + 浅色底 + 细边框，圆角 8px | `(props) => string`，Week 2 转 `> [!WARNING]` |
| Steps | ✓ 垂直步骤条，品牌紫圆形序号（weight 300）+ 内容 | `(props) => string`，Week 2 转有序列表 |
| CodeTabs | ✓ Tabs 切换 + 深色底代码块 + 复制按钮（客户端组件） | `(props) => string`，Week 2 全部语言展开 |
| Params | ✓ shadcn Table，参数名 mono+紫、必填红色「是」 | `(props) => string`，Week 2 转 Markdown 表格 |
| InternalOnly | ✓ 虚线琥珀边框 + 锁图标 + 「仅内部可见」 | `(props, audience) => string`，Week 2 external 过滤 |

CodeTabs 内代码 Week 1 不做语法高亮（rehype-pretty-code 只处理 MDX 代码块，不处理 props 字符串），用固定深色底白字，Week 6 接运行时 shiki。

## Stripe 风格落地

- `globals.css` 覆盖 shadcn 默认 oklch 值为 Stripe hex：标题 `#061b31`、品牌紫 `#533afd`（深色 `#7c5cff`）、正文灰 `#64748d`、边框 `#e5edf5`、深色区 `#1c1e54`
- body 全局 `font-weight: 300` + `font-feature-settings: "ss01"`；标题 weight 300；财务数字 `.tabular-nums` 用 `"tnum"`
- 圆角 6px（`--radius: 0.375rem`）；蓝色调阴影 `--shadow-stripe: 0 4px 24px rgba(50,50,93,0.25)`
- 字体：Inter（weight 300/400/500），sohne-var 回退（付费字体未引入）
- shiki 代码高亮深浅色切换 CSS 已配

## 启动方式

```bash
cd /Users/liangyuanwen.1/joymaas-docs-system/doc/apps/site
pnpm install
# 注意：在干净 shell 跑（不要带其他 Next 项目的环境变量）
pnpm dev
# 访问 http://localhost:3000/docs/quickstart（或日志里的端口）
```

## 未完成项

- **pagefind 搜索**：装包未接线（规划 Week 1 验收未要求搜索，推后）
- **视觉截图**：内置浏览器后台标签截图返回空，已用面板打开页面人工确认；自动化截图待环境支持后补
- **CodeTabs 语法高亮**：Week 6 接运行时 shiki

## 下周计划（Week 2：Agent 三件套）

- [ ] `apps/site/lib/mdx-to-md.ts` + 单元测试（覆盖 5 个组件的 Markdown 导出，实现本周留的 `toMarkdown`）
- [ ] `.md` 路由：`app/docs/[...slug]/page.md.ts`（或 route handler）
- [ ] `/llms.txt` 路由：扫 contentlayer 数据生成
- [ ] Copy as Markdown 按钮：`components/CopyAsMarkdown.tsx`
- [ ] 验收：curl 拉 `.md` 喂 Claude 能正确回答；`llms.txt` 符合规范

## 阻塞项

无。本周所有阻塞都已解决。

需 Leah 留意：
1. **启动 dev 要用干净 shell**——当前机器 shell 环境被另一个 Next 项目污染（`TURBOPACK=1` + `__NEXT_PRIVATE_STANDALONE_CONFIG`），带这些变量启动 `pnpm dev` 会崩。建议排查 `~/.zshrc` 或 shell 启动逻辑里是否有全局注入。
2. **contentlayer2 维护活跃度低**——它是原版 contentlayer 的社区 fork，Next 16 这套组合能跑通但属于"踩出来的路"。后续 Next 升级或 contentlayer2 失维护时，可能要评估换方案（如直接用 MDX + 自建数据层）。Week 2 先不处理，记入风险。
