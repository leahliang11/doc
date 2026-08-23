---
date: 2026-08-23
week: 2
owner: Leah
status: 完成
---

# Week 2 周报：Agent 三件套（AI 能读对）

## 完成项（对照 P0 落地规划 §12 Week 2 + §8）

- [x] `mdx-to-md` 转换器（`src/lib/mdx-to-md/`）+ 单元测试（29 个全过，覆盖率 >80%）
- [x] `.md` 路由：`/docs/<slug>.md` 返回纯 Markdown（external 受众过滤 InternalOnly）
- [x] `/llms.txt` 路由：全站索引，符合 llmstxt.org 规范
- [x] Copy as Markdown 按钮：文档页标题区，点击复制纯 Markdown

**验收结果**：curl 拉 `.md` 返回纯 Markdown，InternalOnly 块被过滤；`llms.txt` 含 3 篇公开文档索引；Copy 按钮在页面渲染；29 个单元测试全过。

## 视觉风格切换（本周穿插）

Week 1 用的 Stripe 风格被推翻，换成 **Vercel Docs 基线**：
- `STYLE_GUIDE.md` → 改名 `DESIGN_TOKENS.md`，按 Vercel 重写（neutral 灰阶 + 单一主色 #0070f3 + 400/500/600 字重）
- Callout/InternalOnly/NextSteps 三个组件重做：去彩色底、白/neutral-950 底、极细边 #eaeaea、常态无阴影、hover 边框加深
- globals.css 全量换 neutral 变量、body 字重 300→400、prose-doc 正文 14px/行高 1.6
- 顺带把 NextSteps 加进白名单（5→6 个组件），转换器同步支持

## 转换器实现要点

### 解析策略：unified + remark-parse + remark-mdx（路线 B）
用 `unified().use(remarkParse).use(remarkMdx).parse(raw)` 把 MDX 解析成 mdast AST。JSX 标签成 `mdxJsxFlowElement`/`mdxJsxTextElement` 节点，props 表达式经 acorn 解析成 ESTree。都是 contentlayer2 的传递依赖，零新外部依赖（只额外装了 acorn 显式声明）。

### 关键 bug 与修复（踩坑记录）
1. **expression props 是源码字符串不是 AST**：remark-mdx 此版本把 `items={[...]}` 的 value 存为 JS 源码字符串，不是已解析 ESTree。改用 acorn 解析字符串→ESTree→受限求值器（只处理 ArrayExpression/ObjectExpression/Literal）。
2. **嵌套组件的 mdxJsxTextElement**：Callout 内嵌 Steps 时，Steps 是行内 JSX（mdxJsxTextElement），序列化报 unknown node。修复：transform 递归处理 children 子树（先转换内层再序列化外层）。
3. **非白名单 JSX 节点（如 `<div>`）**：Steps 的 children 里 `<div>` 也是 mdxJsxTextElement，序列化崩。修复：非白名单 JSX 节点解包（用 children 文本替换，去掉标签外壳）。
4. **ESM import 扩展名**：Node --test 跑 TS 需 ESM，相对 import 要带 `.ts` 扩展名（转换器内部全部加了）。
5. **acorn ESM 导出**：`import acorn from 'acorn'` 不行（无 default export），改 `import { parse } from 'acorn'`。
6. **无序列表标记**：mdast-util-to-markdown 默认用 `*`，配置 `bullet: '-'` 统一成横杠。
7. **.md 路由含斜杠 404**：rewrite `:slug.md` 不匹配多段（`api/chat-completions`），改 `:path*.md`。

### toMarkdown 逻辑归属
独立成纯函数模块 `converters.ts`，**不 import React 组件**（避免 React 运行时污染 Node 端）。Week 1 组件上的 `toMarkdown` 仍是占位（转换器直接调 converters 纯函数）。

## 6 个组件的 Markdown 导出

| 组件 | Markdown 输出 |
|---|---|
| Callout | GFM alert `> [!WARNING] title`（info→NOTE, warning→WARNING, danger→CAUTION, success→TIP） |
| Steps | 有序列表 `1.` `2.`（children 块拆步） |
| CodeTabs | 全部语言展开 `#### label` + ```代码块``` |
| Params | 标准 Markdown 表格 |
| InternalOnly | external→空串过滤；internal→原文 |
| NextSteps | 链接列表 `- [标题](href): 描述` |

## 测试覆盖（node:test，零依赖）

29 个测试全过。覆盖率（行/分支/函数）：
- converters.ts 99% / 87% / 100%
- index.ts 100% / 100% / 100%
- parse.ts 100% / 100% / 100%
- props-evaluator.ts 96% / 73% / 100%
- transform.ts 94% / 80% / 100%

整体行覆盖远超 80% 要求。覆盖：6 组件各 2-5 case + 边界（嵌套、空 props、普通 Markdown 保留、代码块内 `<Callout>` 不误解析、InternalOnly 两受众）。

## .md 路由 & llms.txt

- `.md` 路由：`/docs/:path*.md` rewrite 到 `/docs-md/:path*` route handler，返回 `text/markdown`，external 过滤 InternalOnly
- `llms.txt`：`/llms.txt` route，扫 allDocs 过滤已发布+公开+ai_readable，按分类分组，每篇 `- [标题](url.md): 描述`
- Copy as Markdown：客户端组件，点击 fetch `.md` 路由拿现成 Markdown 复制（复用 .md 路由，零客户端转换负担）

## 启动方式（不变）

```bash
cd /Users/liangyuanwen.1/joymaas-docs-system/doc/apps/site
pnpm test              # 29 个测试
pnpm dev               # 干净 shell（env -u TURBOPACK -u __NEXT_PRIVATE_STANDALONE_CONFIG）
curl localhost:50528/docs/quickstart.md
curl localhost:50528/llms.txt
```

## 未完成项 / 已知问题

- **Steps 转换质量**：`<div>**标题**\n\n说明</div>` 里标题和说明被空行拆成两个列表项（应合为一步）。转换器把 div 内的段落按空行 split，导致一步变两步。不阻塞 Agent 阅读（信息都在），但序号偏多。Week 3+ 优化。
- **Copy 按钮无加载态**：fetch 期间无反馈，网络慢时体验一般。Week 8 埋点时一起加。
- **Next 16 rewrites 在 Turbopack 下的兼容**：`:path*.md` 语法能跑通，但属"踩出来的路"。

## 下周计划（Week 3：后端 API + Git 读写）

- [ ] `apps/backend/` 初始化（Fastify + simple-git）
- [ ] `POST /api/docs/open`（git pull + 读 mdx + 记 base_commit）
- [ ] `POST /api/docs/save`（冲突检测 + draft 分支 + commit + push）
- [ ] `POST /api/docs/submit-review`（octokit 创建 PR）
- [ ] SQLite + review_tasks / edit_sessions 表
- [ ] 验收：curl 打开/保存/提交审核跑通，冲突场景手动测

## 阻塞项

无。Week 2 所有阻塞已解决。

需 Leah 留意：
1. **Week 3 前的 Coding 兼容性调研**（CLAUDE.md 要求）：Week 3 开始前需做 15 分钟京东 Coding webhook/API 兼容性调研，产出 `docs/coding-integration.md`。Coding 用 GitLab 协议（merge_request 非 pull_request），`octokit` 可能要换 `@gitbeaker/rest`。
2. **contentlayer2 风险延续**：Week 1 记的风险（Next 16 + contentlayer2 踩路）仍在，P0 不动。
