---
date: 2026-08-23
week: 3
owner: Leah
status: 完成
---

# Week 3 周报：后端 API + Git 读写

## 完成项（对照 P0 落地规划 §12 Week 3 + §7）

- [x] `apps/backend/` 初始化（Fastify + simple-git + @gitbeaker/rest + better-sqlite3）
- [x] SQLite + review_tasks / edit_sessions 表
- [x] `POST /api/docs/open`（git pull + 读 mdx + 记 base_commit）
- [x] `POST /api/docs/save`（冲突检测 + draft 分支 + commit + push）
- [x] `POST /api/docs/submit-review`（gitbeaker 创建 MR）
- [x] **gitbeaker 兼容性验证**（Leah 硬要求，已跑通 createMR）

**验收结果**：三个端点全链路跑通——open 读 quickstart 返回 markdown+base_commit；save 生成 commit + draft 分支 + push；submit-review 创建 MR（iid=2，coding.jd.com/liangyuanwen.1/doc/merges/2）；冲突检测 409 正确触发。

## 前置：存档 Week 1-2 + Coding 调研

- **存档**：Week 1-2 成果（apps/site + 3 篇 mdx + docs + DESIGN_TOKENS）commit 到 doc 仓库 main，push 到京东 Coding（9db41cf→a3ee657）。工作区干净后才动后端 Git 操作（避免 save 误提交 site 代码）。
- **架构变更**：规划假设 content-repo 独立仓库，实际它是 doc 仓库子目录。后端直接操作 doc 仓库，draft 分支只 `git add content-repo/content/<file>`（限定路径，绝不 `git add .`）。
- **Coding 调研**（docs/coding-integration.md）：京东 Coding 底层 GitLab，API 兼容 `/api/v4/*`，用 gitbeaker 替代 octokit。PAT 已由 Leah 提供（服务账号 `joymaas-doc-backend`，scope=api）。

## gitbeaker 兼容性验证（关键）

用 `scripts/verify-gitbeaker.ts` 验证：
1. ✅ 读取项目（liangyuanwen.1/doc, ID 968403）
2. ✅ 列分支
3. ✅ **创建 MR**：先用 simple-git 建测试分支 + 空 commit（让分支领先 main），再 gitbeaker createMR 成功，返回 iid + web_url。

**踩坑**：直接 `main→main` 或无 diff 的分支 createMR 报 `OPERATION_NOT_SUPPORTED`——不是兼容性问题，是 GitLab 不允许无 diff 的 MR。正式 save 流程的 draft 分支有 diff，正常。验证完清理了测试 MR 和分支。

## 三个端点实现

### POST /api/docs/open `{slug, user}`
1. git pull main
2. slug→路径解析（`<slug>.mdx` 或 `<slug>/index.mdx`）读文件
3. 记 HEAD commit hash 到 edit_sessions
4. 解析 frontmatter 返回 `{markdown, frontmatter, base_commit}`

### POST /api/docs/save `{slug, markdown, base_commit, user}`
1. git fetch
2. **冲突检测**：`git log base..origin/main --oneline -- <file>` 有输出→409 + 返回远端最新内容（`git show origin/main:<file>`）
3. 无冲突→切 `draft/<slug>-<ts>` 分支→写文件→`git add <file>`（限定路径）→`git commit --author="Name <email>"`→push→回 main
4. 返回 `{commit_hash, branch}`

### POST /api/docs/submit-review `{slug, branch, submitter, title}`
1. gitbeaker `MergeRequests.create(projectId, branch, 'main', title)` → `{iid, web_url}`
2. 写 review_tasks（source='web', mr_iid, status='pending'）
3. 返回 `{mr_iid, mr_url}`

## 关键设计

- **draft 分支只 commit content 文件**：`git add content-repo/content/<file>`，绝不 `git add .`（site 代码不进 draft）。验证确认 main 上 quickstart 未被误改。
- **author = 登录用户**：simple-git `commit --author="Name <email>"`，committer 用仓库默认 config（liangyuanwen.1）。符合规划"作者=登录用户，非 bot"。
- **冲突检测**：用 `git.raw(['log', base..origin/main, '--oneline', '--', file])`（simple-git 的 log() API 对 `--` 传参不支持，踩坑后改 raw）。
- **slug→路径**：先试 `<slug>.mdx`（api/chat-completions），再试 `<slug>/index.mdx`（quickstart）。

## 踩坑记录

1. **simple-git `branchCurrent()` 不存在**：3.x API 变了，获取当前分支改用 `git.revparse(['--abbrev-ref','HEAD'])`。
2. **simple-git `log()` 的 `--` + filePaths 传参报错**：`{'--': null, filePaths: [...]}` 被当成 `--=value`。改用 `git.raw(['log', ...])` 直接跑原生命令。
3. **createMR 无 diff 报 OPERATION_NOT_SUPPORTED**：测试分支要先有领先 main 的 commit。
4. **端口污染**：shell 环境 `PORT=50528`（site 的）污染后端，启动用 `env -u PORT` 清掉。
5. **pnpm build scripts**：better-sqlite3 原生编译，pnpm-workspace.yaml 配 `allowBuilds: better-sqlite3: true`。

## 启动方式

```bash
cd /Users/liangyuanwen.1/joymaas-docs-system/doc/apps/backend
pnpm install
env -u PORT pnpm dev          # 干净 shell，:3001
pnpm verify-gitbeaker         # 验证 gitbeaker 兼容性
```

.env 含：CODING_TOKEN（PAT）/ CODING_HOST / CODING_PROJECT_ID=968403 / CONTENT_REPO_PATH（doc 仓库根）/ PORT=3001 / DB_PATH。

## 未完成项 / 已知问题

- **webhook + 审核队列 UI**：Week 5（review_tasks 表已就绪，Week 5 接 webhook + 后台 UI）。
- **冲突弹窗前端**：save 返回 409 + remote_markdown，前端弹窗是 Week 4 后台编辑器做。
- **draft 分支清理**：驳回的 MR 对应 draft 分支没自动删（Week 5 审核驳回时加 closeMR + 删分支）。
- **并发锁定**：两人同时 save 同一篇，靠 base_commit 冲突检测兜底，无显式锁。P0 够用。

## 下周计划（Week 4：后台编辑器改造）

- [ ] 现有 Vue 后台（`/Users/liangyuanwen.1/WorkBuddy/doc/joymaas-doc-admin/`）砍模块到 5 个
- [ ] CodeMirror 6 集成（Markdown 模式）
- [ ] 双栏编辑：左 Markdown 右预览（复用前台 MDX 组件）
- [ ] 6 个组件插入工具栏
- [ ] Frontmatter 表单
- [ ] 冲突弹窗（接 save 的 409）
- [ ] 提交审核 → 弹出 MR URL（接 submit-review）
- [ ] 接后端 :3001 的 open/save/submit-review

## 阻塞项

无。Week 3 所有阻塞已解决。

需 Leah 留意：
1. **PAT 已用**：服务账号 `joymaas-doc-backend` 的 token（scope=api）已填 backend/.env，能建 MR/读项目/push。push 用 SSH key（git@coding.jd.com），PAT 用于 GitLab API（建 MR）。两者都通。
2. **后端部署地址**：规划 Week 5 webhook 要打到 116.196.90.213。Week 3 本地跑通，部署到该机器在 Week 5 前。
3. **draft 分支会越积越多**：每次 save 建一个 draft 分支，Week 5 审核流程闭环后（驳回删分支、合并后分支自动删）会清理。当前测试已清理干净。
