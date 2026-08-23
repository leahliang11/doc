---
date: 2026-08-23
week: 5
owner: Leah
status: 完成
---

# Week 5 周报：webhook + 审核队列（双通道汇合）

## 完成项（对照 P0 落地规划 §12 Week 5 + §7）

- [x] `POST /api/webhook/gitlab`：GitLab merge_requests 事件接收，X-Gitlab-Token 校验，open 写表（去重）、merge/close 回流更新状态。push 事件 ack 不处理（Week 6）。
- [x] 审核队列混合两来源（Web 提交 + GitLab MR），source 字段区分。
- [x] `GET /api/review-tasks`（列表，带 status 过滤）、`GET /:id`（详情）、`GET /:id/diff`（分支相对 main 的内容 diff）。
- [x] `POST /:id/approve`（mergeMR + 状态更新）、`POST /:id/reject`（closeMR + 评论）。
- [x] 后台审核队列页（ReviewView.vue）：表格 + 来源标签 + 待审/全部 tab + diff 展开 + 通过/驳回 + MR 链接。
- [x] db 补函数：updateReviewTaskStatus / findReviewTaskByMrIid（去重）/ getReviewTask。
- [x] git.ts 补 getDiff（fetch + git diff main...origin/branch，限定 content-repo/content/ 路径）。
- [x] config + .env.example 加 WEBHOOK_SECRET。
- [x] webhook 配置文档 `docs/coding-webhook-setup.md`。
- [x] 已知问题清单 `docs/known-issues.md`（merge 卡点）。

## 判断标准达成情况

1. **工程师 push → webhook → 写 review_tasks**：✅ 用 curl 模拟 merge_requests open webhook，正确写入 source=gitlab_mr，slug 从分支名解析（draft/quickstart-xxx → quickstart，feature/api-fix-xxx → api）。
2. **审核队列看到混合来源**：✅ ReviewView 同时显示「工程师 Git」和「PM 通道」标签，双通道汇合。
3. **点通过 → merge MR → 合入 main**：⚠️ 代码链路通（调 gitbeaker merge API 正确），但 Coding 评审规则门槛拦住真合入。详见下方卡点。

## 卡点：approve mergeMR 被 Coding 评审规则拦住

### 现象
approve 调 `gitbeaker.MergeRequests.merge()` 返回 HTTP 200，但 MR 实际未合入（state=opened，merge_status=unknown）。

### 根因
浏览器打开 MR4 确认：京东 Coding MR 默认评审规则「需1人评审通过」+「不允许自评」+「不允许评审通过后自动合并」。标准 GitLab 默认无此门槛可直接合。merge_status 一直 unknown → 不可合并 → merge 静默失败。

### 处理（Leah 决定：选 3 不硬磕）
- 本周验证的是**代码逻辑链路**（curl→webhook→队列→点通过→调 merge API），不是平台权限问题——链路完全正确。
- approve 端点改如实处理：mergeMR 后查实际状态，真合标 merged，没合保持 pending + comment 记录原因 + 返回 HTTP 409 merge_pending。不骗人标 merged。
- 卡点写进 `docs/known-issues.md`，Week 10 部署正式仓库时配套决策（仓库评审规则 + bot 账号 + 审批策略一起定）。
- 不改当前仓库评审设置（不绕开审核卡口）、不本周申请 bot PAT、不阻塞 Week 5 收官。

## 实现要点

### webhook 路由（routes/webhook.ts）
- `POST /api/webhook/gitlab`，校验 `X-Gitlab-Token` == WEBHOOK_SECRET（空则跳过，仅本地）。
- 按 `object_kind` 分发：merge_requests → handleMergeRequests；push → ack 不处理；其他 → 200。
- handleMergeRequests：只关心 target_branch=main 的 MR。action=open 去重写表（findReviewTaskByMrIid）；merge → 标 merged；close → 标 rejected。
- **webhook 必须 200**（否则 Coding 重试），异常也 200 + 记日志。
- slug 解析：从 source_branch 去掉前缀/、时间戳后缀、-update 等后缀，取主干。

### 去重设计
- webhook open 先 `findReviewTaskByMrIid(iid)`，存在则跳过。
- 这样 web 提交（Week 4 submit-review 已写表）的 MR，工程师通道再触发 webhook open 也不会重复插——同一 MR 在队列里只一条。

### diff（git.ts getDiff）
- `git fetch origin <branch>` 确保远端分支引用最新 → `git.raw(['diff', 'main...origin/<branch>', '--', 'content-repo/content/'])`。
- 限定 content 路径，避免混入非内容改动。用 `main...branch`（三点）显示分支新增的改动。

### approve 如实返回（routes/review.ts）
- mergeMR 后 `getMRStatus(iid)` 查实际 state/mergeStatus/mergedAt。
- state=merged → 标 merged；否则保持 pending + comment 记录 + HTTP 409 merge_pending。
- 这样审核者看到真实状态，不被 API 200 骗。

### ReviewView.vue
- 复用 admin CSS 变量 + DocList 表格风格。
- 来源标签：web=靛蓝「PM 通道」，gitlab_mr=蓝「工程师 Git」。
- 状态标签：pending=琥珀、merged/approved=绿、rejected=红。
- 行点击展开 diff（pre 显示，可后续加 +/- 着色）。
- 展开区有驳回评论框 + 通过/驳回按钮。
- 待审核/全部 tab，操作后刷新 + toast。

## 验证过程（真实走了一遍）

1. curl 模拟 MR open（iid=99）→ 写入 source=gitlab_mr slug=quickstart submitter=梁源文 ✓
2. 重复 iid=99 → 去重，不重复插 ✓
3. curl 模拟 MR merge（iid=99）→ id 状态变 merged + reviewed_at + comment ✓
4. diff 端点：分支不存在时返回错误信息；真实 MR4 分支返回 `diff --git a/content-repo/content/troubleshooting/errors.mdx` ✓
5. approve 状态校验：已 merged 的调 approve 返回 400；不存在 id 返回 404 ✓
6. 真闭环：API 建真实 MR4 → webhook open 去重（web 已写不重复）→ diff 真拿到改动 → approve 调 mergeMR（HTTP 200 但平台未真合，如实返回 409 merge_pending + comment 记录）✓
7. ReviewView UI：2 条混合来源显示、来源/状态标签、tab、展开 diff、通过/驳回按钮 ✓
8. 清理：MR4 关闭、draft 分支本地+远端删除、review 记录清空 ✓

## 复用点

- `gitlab.ts` mergeMR/closeMR（Week 3 预留，本周直接用 + 新增 getMRStatus）
- `db.ts` createReviewTask/listReviewTasks + 本周补 3 函数
- `routes/docs.ts`/`routes/ai.ts` 插件模式 → webhookRoutes/reviewRoutes 照搬
- admin `post<T>()` + `getJson` 封装 + DocList 表格样式

## 启动方式

```bash
# 后端（含 webhook + review 路由）
cd apps/backend && env -u PORT pnpm dev   # :3001
# 前端
cd apps/admin && pnpm dev                  # :5173
# 浏览器开 http://127.0.0.1:5173 → 侧边栏「审核队列」
```

## 未完成项 / 已知问题

- **approve mergeMR 平台卡点**：详见 docs/known-issues.md。Week 10 部署时配仓库评审规则 + bot 账号解决。
- **真实 webhook 未配**：本周 curl 模拟。Week 10 后端部署 116.196.90.213 后按 docs/coding-webhook-setup.md 配。
- **reviewer 硬编码 leah**：Week 8 登录后改。
- **push 事件未处理**：Week 6 触发构建。

## 下周计划（Week 6：OpenAPI 自动生成 + push 构建）

- [ ] push webhook 触发内容构建
- [ ] 接口文档从 OpenAPI/Swagger 自动生成（规划 §12 Week 6）
- [ ] 前台文档站补充自动生成的 API 参考

## 阻塞项

无。Week 5 代码闭环，平台卡点已记录不阻塞。
