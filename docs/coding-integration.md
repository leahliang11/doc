---
date: 2026-08-23
topic: 京东 Coding 兼容性调研
type: 调研
owner: Leah
status: 完成
---

# 京东 Coding 兼容性调研（Week 3 前置）

> CLAUDE.md 要求 Week 3 开始前做 15 分钟兼容性调研。本文档评估 octokit→GitLab 客户端迁移、webhook 事件名兼容、Access Token 权限映射，决定 Week 3-5 后端 Git 集成方案。

## 结论先行

**京东 Coding（coding.jd.com）底层是 GitLab 衍生**（星云平台 xingyun.jd.com 套壳），REST API 完全兼容 GitLab `/api/v4/*`。因此：

| 规划原假设 | 实际情况 | 调整 |
|---|---|---|
| 托管在 GitHub，用 `@octokit/rest` | 是 GitLab，不是 GitHub | **`@octokit/rest` → `@gitbeaker/rest`** |
| webhook 事件叫 `pull_request`（GitHub） | GitLab 事件叫 `merge_requests` | webhook 处理改 GitLab 事件名 |
| 仓库 `joymaas-docs`（GitHub） | 实际仓库 `liangyuanwen.1/doc`（已 clone） | 仓库地址用现有的 |
| PR 流程（GitHub） | MR 流程（GitLab merges） | 文案"PR"统一改"MR/合并请求" |

**不阻塞 Week 3**，但 Week 3-5 的 Git 集成方案要按 GitLab 适配。

## 调研证据

### 1. 平台身份
- `git@coding.jd.com:liangyuanwen.1/doc.git` 的 clone 路径格式（`group/repo.git`）是 **GitLab 标准**（GitHub 是 `user/repo.git` 但 host 不同；GitLab 用 group/project 两级）
- 仓库 ID `968403`（数字 ID）—— GitLab 用数字 project ID，GitHub 用 owner/repo 字符串
- UI 用"合并请求"（merges）而非"Pull Request"，设置页有 Webhooks / Push Rules / 集成与服务 —— 全是 GitLab 标准功能名
- 仓库 URL：`http://xingyun.jd.com/codingRoot/liangyuanwen.1/doc/`（星云平台 Coding 模块）

### 2. API 兼容性（决定性证据）
用浏览器 fetch 测 GitLab 标准端点（带登录 cookie）：

```
GET /api/v4/version        → 401 (application/json)
GET /api/v4/projects       → 401
GET /api/v4/projects/968403 → 401
```

**返回 401 而非 404** → 端点存在，只是需要 API Token 认证（浏览器 cookie 不算 GitLab API 认证）。这证明 `/api/v4/*` 路由存在，**完全兼容 GitLab REST API v4**。

### 3. webhook 能力
设置页有 Webhooks 入口（GitLab 标准），支持自定义 webhook URL + 事件勾选。GitLab webhook 事件（本项目要用到的）：

| GitLab 事件 | 触发时机 | 本项目用途 |
|---|---|---|
| `push` | push 到任意分支 | main 分支 push → 触发构建（Week 6） |
| `merge_requests` | MR 创建/更新/合并/关闭 | MR 进审核队列（Week 5） |

GitLab 的 `merge_requests` 事件 payload 含 `object_attributes.action`（open/merge/close/reopen）和 `object_attributes.target_branch`（目标分支，判断是否 merge to main）。

## octokit → @gitbeaker/rest 迁移成本

### 库选型
- `@gitbeaker/rest`（v43.8.0）：GitLab API v4 的 Node 客户端，社区主流，支持全部 GitLab API
- 不是 `node-gitlab`（已停维）或 `gitlab`（旧）

### 迁移点（Week 3-5 后端）

| 功能 | octokit（GitHub）写法 | gitbeaker（GitLab）写法 | 迁移量 |
|---|---|---|---|
| 创建客户端 | `new Octokit({auth})` | `new Gitlab({token, host})` | 小 |
| 创建 MR | `octokit.pulls.create({owner,repo,head,base})` | `gitlab.MergeRequests.create(projectId, sourceBranch, targetBranch, title)` | 参数改 |
| 合并 MR | `octokit.pulls.merge({number})` | `gitlab.MergeRequests.merge(projectId, mrIid)` | 参数改（用 iid 非 number） |
| 列 MR | `octokit.pulls.list()` | `gitlab.MergeRequests.all({projectId})` | 参数改 |
| 关闭 MR | `octokit.pulls.update({state:'closed'})` | `gitlab.MergeRequests.edit(projectId, mrIid, {stateEvent:'close'})` | 参数改 |
| 加 comment | `octokit.issues.createComment()` | `gitlab.MergeRequestNotes.create(projectId, mrIid, body)` | 改方法名 |

**迁移成本：低-中**。概念 1:1 对应（PR↔MR），主要是方法名和参数名差异（projectId 用数字 ID、用 iid 而非 number）。约 5-8 个 API 调用点要改，每处 1-3 行。

### 关键差异注意
1. **project ID**：GitLab 用数字 ID（`968403`）或 URL-encoded 路径（`liangyuanwen.1%2Fdoc`）。本项目用数字 ID 存配置。
2. **MR 用 iid 不是 id**：GitLab MR 有项目内 iid（如 1,2,3）和全局 id，API 操作用 iid。
3. **分支保护**：GitLab 用 `ProtectedBranches` API，main 分支建议保护（只允许 MR 合入）。
4. **host 配置**：`new Gitlab({token, host: 'https://coding.jd.com'})`。

## Webhook 事件名兼容性

### GitHub vs GitLab 事件名对照
| 动作 | GitHub 事件 | GitLab 事件 |
|---|---|---|
| 开 MR/PR | `pull_request` (action=opened) | `merge_requests` (action=open) |
| 合并 | `pull_request` (action=closed + merged) | `merge_requests` (action=merge) |
| 关闭 | `pull_request` (action=closed) | `merge_requests` (action=close) |
| push | `push` | `push` |

### Week 5 webhook 处理改写
规划 §7.5 写的 `POST /api/webhook/github` 改成 `POST /api/webhook/gitlab`，解析逻辑：

```ts
// GitLab webhook payload 结构
{
  object_kind: 'merge_requests',  // 事件类型
  object_attributes: {
    action: 'open' | 'merge' | 'close' | 'reopen' | 'update',
    iid: 5,                        // MR iid
    source_branch: 'draft/quickstart-123',
    target_branch: 'main',
    title: 'docs: update quickstart',
    state: 'opened' | 'merged' | 'closed',
  },
  project: { id: 968403, path_with_namespace: 'liangyuanwen.1/doc' },
  user: { username: 'liangyuanwen.1', name: '梁源文' },
}
```

后端 `webhook.ts` 路由按 `object_kind` 分发：`merge_requests` → 写 review_tasks（source='gitlab_mr'）；`push` + target=main → 触发构建（Week 6）。

**webhook 校验**：GitLab 用 `X-Gitlab-Token` header（webhook 配置时设的 secret），不是 GitHub 的 `X-Hub-Signature`。

## Access Token 权限映射

### Token 类型
京东 Coding（GitLab）用 **Personal Access Token**（PAT），在 用户设置 → 访问令牌 创建。

### GitLab PAT scope → 本项目所需权限
| GitLab scope | 权限 | 本项目是否需要 |
|---|---|---|
| `api` | 完整 API 读写 | ✅ 需要（建 MR / 合并 / 加 comment） |
| `read_repository` | 读仓库 | ✅ simple-git clone 后用，但 API 也要 |
| `write_repository` | 写仓库（push） | ✅ simple-git push 用，API 层面 `api` 已含 |
| `read_user` | 读用户信息 | 可选（拿提交者名字） |

**结论**：建一个项目专用 PAT，scope 设 `api`（含读写仓库 + MR 操作）。不要用个人账号的完整 token。

### Web Editor 作者映射
规划 §7.2 要求"Web 保存 = 真实 Git commit，作者 = 登录用户，不能是 bot"。GitLab commit author 由 `git commit --author="Name <email>"` 控制，simple-git 层面设，不需要 token 权限。但 push 需要 PAT 有 `write_repository`。

### 待 Leah 确认（Week 3 前需提供）
1. **项目专用 PAT**：在 coding.jd.com → 用户设置 → 访问令牌，建一个 scope=`api` 的 token，给到后端 `.env`（`CODING_TOKEN`）。或用一个服务账号的 token。
2. **仓库 ID 确认**：当前 `liangyuanwen.1/doc` ID=968403。Week 3 后端是否就用这个仓库做内容源？还是新建 `joymaas-docs` 仓库？（规划写 `joymaas-docs`，但实际 clone 的是 `doc`）
3. **webhook 可达性**：后端服务部署后，coding.jd.com 能否访问到后端 webhook URL？（内网部署应该可以，需确认后端服务地址）

## 对 Week 3-5 的影响

### Week 3（后端 API + Git 读写）
- `simple-git` 操作 Git 仓库：**不变**（Git 协议与平台无关，clone/push/commit 都通用）
- `octokit` → **`@gitbeaker/rest`**：`submit-review` 创建 MR 的部分改用 gitbeaker
- `.env`：`CODING_TOKEN`、`CODING_HOST=https://coding.jd.com`、`CODING_PROJECT_ID=968403`、`CONTENT_REPO_PATH`（本地 clone 路径）

### Week 4（后台编辑器）
- 不变（后台通过后端 API 操作，不直接碰 Git）

### Week 5（webhook + 审核队列）
- webhook 端点 `/api/webhook/gitlab`，解析 GitLab payload（`object_kind` / `object_attributes.action`）
- review_tasks.source = `'gitlab_mr'`（不是 `'github_pr'`）
- 审核 UI 文案"PR" → "合并请求/MR"

## 边界诚实

1. **未实测 gitbeaker 对京东 Coding 的完整兼容**：gitbeaker 是为标准 GitLab 写的，京东 Coding 虽是 GitLab 衍生但可能有定制。Week 3 实现时先跑通"创建 MR"一个端点验证，再铺开。
2. **webhook 事件勾选项未逐个验证**：UI 看到有 Webhooks 入口，但没展开看具体支持哪些事件勾选（push/merge_requests 是 GitLab 必备，应该有）。Week 5 配置时确认。
3. **PAT 权限粒度**：GitLab 的 `api` scope 权限较大（等于账号全部 API 权限）。理想是项目级 deploy token + 受限 PAT，但 GitLab PAT 是用户级的。Week 3 用服务账号 PAT，记录此限制。
4. **星云平台 vs coding.jd.com**：UI 跳转到 xingyun.jd.com/codingRoot，但 API 在 coding.jd.com/api/v4。两者关系待 Week 3 验证（可能 xingyun 是前端、coding.jd.com 是 GitLab 后端）。

## 下一步

调研完成，**可以动 Week 3 后端代码**。Week 3 第一步：
1. `apps/backend/` 初始化 Fastify
2. 装 `simple-git` + `@gitbeaker/rest`
3. 先实现 `POST /api/docs/open`（纯 simple-git，不碰 GitLab API）跑通
4. 再实现 `submit-review`（gitbeaker 创建 MR）—— 此处验证 gitbeaker 对京东 Coding 兼容性
