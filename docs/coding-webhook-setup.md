---
date: 2026-08-23
topic: Coding webhook 配置
type: 文档
owner: Leah
status: Week 10 部署时执行
---

# 京东 Coding Webhook 配置步骤

> Week 5 本地用 curl 模拟 webhook payload 验证逻辑。真实 webhook 配置在 Week 10 后端部署到 116.196.90.213 后执行（届时 Coding 可达后端地址）。

## 前置条件

- 后端服务已部署，且有 Coding 可达的地址（如 `http://116.196.90.213:3001`）。
- `.env` 里设了 `WEBHOOK_SECRET`（自定义一段密钥）。

## 配置步骤（coding.jd.com）

1. 打开仓库 `liangyuanwen.1/doc` → 设置 → Webhooks（GitLab 标准入口）。
2. 新建 Webhook：
   - **URL**：`http://116.196.90.213:3001/api/webhook/gitlab`
   - **Secret token**：填 `.env` 里 `WEBHOOK_SECRET` 的值（作为 `X-Gitlab-Token` 校验）。
   - **Trigger 事件勾选**：
     - ✅ `Merge request events`（Week 5 审核）
     - ✅ `Push events`（Week 6 构建，本周可不勾）
   - **SSL verification**：内网 HTTP 无 SSL，选 Disable（或按内网证书配）。
3. 保存。底部 Test 按钮可发测试事件（可选）。

## 事件 → 后端处理对照

| Coding 事件 | 后端动作 | review_tasks 影响 |
|---|---|---|
| merge_requests open | 写 review_tasks（source='gitlab_mr'，去重） | 新增 pending |
| merge_requests merge | updateReviewTaskStatus(merged) | 标 merged |
| merge_requests close | updateReviewTaskStatus(rejected) | 标 rejected |
| push（Week 6） | 触发构建 | 无 |

## 工程师通道真实流程

1. 工程师本地改文档 → `git push origin <branch>`
2. 在 Coding 上创建 MR（source=`<branch>` → target=`main`）
3. Coding 触发 `merge_requests open` webhook → 后端写入审核队列
4. 后台「审核队列」出现这条（来源标「工程师 Git」）
5. 审核者看 diff → 通过/驳回

## 本地 curl 模拟测试（Week 5 用）

```bash
# 模拟 MR open（注意 .env 里 WEBHOOK_SECRET 留空则不校验 token）
curl -X POST http://127.0.0.1:3001/api/webhook/gitlab \
  -H "Content-Type: application/json" \
  -d '{
    "object_kind": "merge_requests",
    "object_attributes": {
      "action": "open",
      "iid": 99,
      "source_branch": "draft/quickstart-1787494222650",
      "target_branch": "main",
      "title": "docs: update",
      "state": "opened"
    },
    "user": { "username": "liangyuanwen.1", "name": "梁源文" }
  }'

# 模拟 MR merge
curl -X POST http://127.0.0.1:3001/api/webhook/gitlab \
  -H "Content-Type: application/json" \
  -d '{"object_kind":"merge_requests","object_attributes":{"action":"merge","iid":99,"source_branch":"x","target_branch":"main","state":"merged"},"user":{"name":"x"}}'

# 查队列
curl http://127.0.0.1:3001/api/review-tasks
```

## payload 字段（GitLab 标准，Coding 兼容）

```jsonc
{
  "object_kind": "merge_requests",
  "object_attributes": {
    "action": "open|merge|close|reopen|update",
    "iid": 4,                      // MR iid（项目内序号）
    "source_branch": "draft/...",
    "target_branch": "main",
    "title": "...",
    "state": "opened|merged|closed"
  },
  "project": { "id": 968403, "path_with_namespace": "liangyuanwen.1/doc" },
  "user": { "username": "...", "name": "..." }
}
```

## 校验

后端读 `X-Gitlab-Token` header，与 `WEBHOOK_SECRET` 比对，不符返回 401。`.env` 里 `WEBHOOK_SECRET` 留空则跳过校验（仅本地调试用，生产必填）。

## 已知卡点（Week 5 发现，详见 docs/known-issues.md）

approve 调 mergeMR 受 Coding 评审规则门槛（需1人评审+不允许自评）阻挡，MR 不真合入。Week 10 部署时配仓库评审规则后解决。
