---
title: GitHub Webhook 配置
description: 将 Pull Request 审核状态同步到 JoyMaaS 文档后台
---

# GitHub Webhook 配置

文档后台使用 GitHub Pull Request 作为发布审核载体。GitHub Webhook 接收 PR 和 `main` 分支 push 事件，将审核任务和构建待办同步到后台。

## 后端地址

```text
POST http://116.196.90.213/api/webhook/github
```

生产环境必须在后端 `.env` 配置 `WEBHOOK_SECRET`。GitHub Webhook 的 Secret 与此值保持一致，服务端通过 `X-Hub-Signature-256` 校验请求来源。

## GitHub 设置

在仓库 `Settings → Webhooks → Add webhook` 中填写：

- **Payload URL**：`http://116.196.90.213/api/webhook/github`
- **Content type**：`application/json`
- **Secret**：与云主机 `WEBHOOK_SECRET` 完全一致
- **Which events**：选择 `Let me select individual events`
- 勾选 **Pull requests** 和 **Pushes**
- **Active**：开启

## 状态映射

| GitHub 事件 | 后台行为 |
| --- | --- |
| `pull_request.opened` | 创建一条待审核任务 |
| `pull_request.reopened` | 将已有任务恢复为待审核 |
| `pull_request.closed` 且 `merged=true` | 标记为已发布 |
| `pull_request.closed` 且 `merged=false` | 标记为已驳回 |
| `push` 到 `main` | 记录一次待构建任务 |

只处理目标分支为 `main` 的 Pull Request，其他分支会直接忽略。相同 PR 编号重复投递时会自动去重。

## 本地模拟

本地未配置 `WEBHOOK_SECRET` 时不会校验签名，可直接用下面的最小 payload 验证路由：

```bash
curl -X POST http://127.0.0.1:3001/api/webhook/github \
  -H 'Content-Type: application/json' \
  -H 'X-GitHub-Event: pull_request' \
  -d '{"action":"opened","pull_request":{"number":1001,"base":{"ref":"main"},"head":{"ref":"draft/quickstart-1001"},"user":{"login":"demo"}}}'
```

返回 `{"status":"ok"}` 即表示事件已接收。审核队列可通过后台的“审核队列”页面查看。
