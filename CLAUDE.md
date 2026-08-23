# 给 Claude Code 的开工指令

你是这个项目的工程实现方。产品方（Leah）已经把 P0 的全部规划钉死，你直接按计划执行。

## 开工前必读（顺序）

1. `README.md` —— 项目全景
2. `docs/P0落地规划.md` —— **这是你的主线，Week 1-10 全部细节在这里**
3. `docs/产品构想.md` —— 理解"为什么做"（老板视角，你需要知道，避免走偏）
4. `docs/后台详细设计.md` —— 参考。P0 只做主链路子集，不要照抄
5. `docs/MVP与落地方案.md` —— 参考

## 执行原则

严格遵守 `docs/P0落地规划.md` §14 的 10 条执行守则。核心是：

1. **不要问"要不要顺便做 X"** —— 范围钉死在规划 §2
2. **不要写占位代码** —— 每次提交端到端能跑
3. **不要造名词** —— 定位、组件名、文案照抄规划文档
4. **每周交付一份 `weekly-<n>.md`** 到 `docs/weekly/` 目录（含完成项 / 未完成 / 阻塞项）
5. **`mdx-to-md.ts` 和 `openapi-to-mdx.ts` 必须写单元测试**（>80% 覆盖）
6. **后台改造增量做，不重写**（参考 `/Users/liangyuanwen.1/WorkBuddy/doc/joymaas-doc-admin/`）

## 特殊说明：京东内网 Coding

本仓库托管在京东内网 Coding（`coding.jd.com`），不是 GitHub。

- Coding 平台大概率兼容 GitLab 协议（webhook 事件叫 `merge_request` 不叫 `pull_request`）
- **Week 3 开始前你必须先做 15 分钟兼容性调研**，产出 `docs/coding-integration.md`，说明：
  - 平台的 webhook 事件名和 payload 结构
  - 平台的 REST API 是否兼容 GitHub / GitLab
  - `simple-git` 和 `octokit` 是否需要换成其他库
- 如果 Coding 不支持 webhook 或 API 差异过大，立刻升级 Leah 决策

## 阻塞项处理

任何以下情况**立刻停下**，写到 `docs/blockers.md` 并告诉 Leah：

- Coding 平台不支持 P0 依赖的能力（webhook / PR API / merge API）
- P0 范围需要扩（哪怕你觉得"顺便做了更好"）
- 需要新的账号 / 密钥 / 权限
- Leah 之前的判断和实际实现有冲突

## Week 1 开工任务

对照 `docs/P0落地规划.md` §12 Week 1 清单：

- [ ] `apps/site/` 初始化 Next.js 14 App Router + pnpm
- [ ] 装 contentlayer2 + Tailwind + shadcn/ui + lucide-react + shiki + pagefind
- [ ] 5 个白名单组件的 Web 渲染（`components/mdx/`）
- [ ] `content-repo/content/` 下写 3 篇样板：
  - `quickstart/index.mdx`
  - `api/chat-completions.mdx`（先手写，Week 6 会被自动生成替换）
  - `troubleshooting/errors.mdx`
- [ ] 深浅色 + 布局 + 顶部导航

**Week 1 验收**：`pnpm dev` 起前台，3 篇文档能访问，5 个组件展示正常。截图 + 视频放到 `docs/weekly/weekly-1.md`。
