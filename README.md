# JoyMaaS 文档系统

> JoyMaaS 官方文档站 + 后台管理 + Agent 可读输出的完整实现。

## 这是什么

一个让 JoyMaaS 文档同时满足三件事的系统：

1. **人能读顺** —— 现代文档站（Next.js + MDX + 白名单组件）
2. **AI 能读对** —— 每页 `.md` + 站点 `llms.txt` + Copy as Markdown
3. **两种人都能写** —— PM/运营用 Web 编辑器，工程师用 Git/IDE，两条通道写同一个 Git 仓库

## 目录

```
.
├── apps/
│   ├── site/         # 前台文档站(Next.js)
│   ├── admin/        # 后台管理(Vue)
│   └── backend/      # 后端 API(Fastify + simple-git + octokit)
├── content-repo/     # 文档内容源(独立目录,MDX + OpenAPI spec)
├── docs/             # 项目自身文档(规划、设计)
└── README.md
```

## 快速开始

**本仓库目前是骨架，Claude Code 会按 `docs/P0落地规划.md` 逐周填充实现。**

启动前置条件：
- Node.js 20+
- pnpm 9+

启动方式（Week 1 交付后补充）：
```bash
pnpm install
pnpm dev
```

## 关键文档

- [P0 落地规划（双通道版）](docs/P0落地规划.md) —— 交付主线
- [产品构想](docs/产品构想.md)
- [后台功能详细设计](docs/后台详细设计.md)

## 里程碑

| 周 | 目标 |
|---|---|
| W1 | 仓库 + 前台骨架 + 5 组件 Web 渲染 + 3 篇样板 |
| W2 | Agent 三件套（`.md` + `llms.txt` + Copy） |
| W3 | 后端 API + Git 读写 + 冲突检测 |
| W4 | 后台编辑器改造 |
| W5 | Coding webhook + 审核队列（双入口） |
| W6 | OpenAPI 自动生成 + 发布触发 |
| W7 | AI 嵌入编辑器 |
| W8 | 埋点 + 内外双视角 |
| W9 | 10 篇真实内容 + 端到端测试 |
| W10 | 部署 + 演示 |

## Owner

Leah（PM）+ Claude Code（工程实现）
