<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# JoyMaaS 视觉规范（必须遵守）

修改本站任何页面、布局、组件或样式前，必须先完整阅读同目录的 `DESIGN_TOKENS.md`。该文件是 JoyMaaS 开发者文档的视觉设计依据，代码实现与规范发生冲突时，应同步修正二者，禁止只改其中一处。

视觉实现必须遵守以下底线：

- 品牌色和通用交互色使用纯色紫 `#7257E8`，深色模式使用 `#A78BFA`。
- 禁止在线性渐变、径向渐变或多色渐变中使用品牌色；Logo、按钮、选中线和背景均不使用渐变。
- 不使用蓝色作为装饰色或第二套交互主色。橙、红、绿只用于提醒、错误、成功等明确语义状态。
- 页面以白色内容面板、冷灰画布、细边框和留白建立层级，避免大面积彩色背景、重阴影和过度圆角。
- Callout 保持紧凑，不使用左侧色条；用浅色背景、细边框和小图标表达语义。
- 所有新组件优先复用 `globals.css` 中的 Token，禁止散落新增相近但不一致的品牌色值。

完成视觉修改后，至少检查首页、普通文档页和 API 文档页，并运行 `pnpm lint`、`pnpm test` 与生产构建。
