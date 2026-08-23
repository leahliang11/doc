---
date: 2026-08-23
week: 10
topic: 演示脚本
type: 演示
owner: Leah
status: 完成
---

# JoyMaaS 文档系统演示脚本

20 分钟演示流程，覆盖双通道闭环。访问地址：`http://116.196.90.213`。

## 演示前准备

### 云机服务（已部署，PM2 常驻）
```bash
# 确认服务在跑
ssh root@116.196.90.213 'pm2 list'
# 应看到 joymaas-backend + joymaas-site 都 online
```

### 本地 backend（演示 AI + git push 用）
云机访问不到京东内网（AI/git push），演示 AI 和保存 push 时用本地 backend：
```bash
cd /Users/liangyuanwen.1/joymaas-docs-system/doc/apps/backend && env -u PORT pnpm dev
# admin 改成连本地：vite dev proxy 已配 :3001
```

### Coding webhook 配置（Leah 手动，一次性）
1. 打开 https://coding.jd.com/liangyuanwen.1/doc → 设置 → Webhooks
2. 新增 webhook：
   - URL: `http://116.196.90.213/api/webhook/gitlab`
   - Secret: `joymaas-webhook-2026`（和 backend .env 的 WEBHOOK_SECRET 一致）
   - 触发事件：勾选 `push` + `merge_requests`
3. 点「测试」看 delivery 是否成功（验证 coding 能否访问云机）

## 演示流程（20 分钟）

### 第一部分：前台文档站（3 分钟）
1. 打开 `http://116.196.90.213/joymaas-docs/docs/quickstart`
2. 展示 5 个组件渲染：Steps / Callout / CodeTabs / Params / InternalOnly
3. 切深浅色，展示导航
4. 点 `api/chat-completions` 看手写接口文档质量

### 第二部分：后台编辑器——PM 通道（8 分钟）
1. 打开 `http://116.196.90.213/joymaas-doc-admin/`
2. 左侧点「文档」→ 点「快速开始」进编辑器
3. 展示 CodeMirror 语法高亮 + 右侧实时预览（6 组件按前台样式渲染）
4. **AI 改写**（走本地 backend）：选中一段口语文字 → 工具栏「改写」→ 精简/纠错 → 看 diff → 采纳
5. **AI 续写**：光标处点「续写」→ 流式生成
6. **文档体检**：点「体检」→ 看真模型检测出的问题 + 跳转定位
7. **保存草稿**：点保存 → 看 commit 生成（本地 backend 操作 doc 仓库）
8. **提交审核**：点提交 → 弹出 MR 链接（coding.jd.com 上能看到 MR）

### 第三部分：工程师通道——webhook（5 分钟）
> 需 webhook 已配 + coding 能访问云机

1. 在 coding.jd.com 直接 push 一个改文档的 commit 到 main
2. 回 admin「审核队列」→ 看到这条 push 自动出现（来源标签「工程师 Git」）
3. 或在 coding 提一个 MR → 审核队列出现（来源「PM 通道」）
4. 点行展开看 diff
5. **通过** → mergeMR（若仓库评审规则配好，真合入 main）

### 第四部分：OpenAPI 自动生成（3 分钟）
1. 展示 `content-repo/openapi/openapi.yaml`
2. 改一个字段（如 embeddings 加参数）
3. 跑 `pnpm gen:openapi`
4. 前台对应页面刷新，看到字段更新

### 第五部分：Agent 三件套（1 分钟）
1. `curl http://116.196.90.213/joymaas-docs/docs/quickstart.md` → 纯 Markdown
2. `curl http://116.196.90.213/joymaas-docs/llms.txt` → 全站索引
3. 说明：AI Agent 喂 .md 能正确读文档

## 关键判断标准

| 场景 | 判断 |
|---|---|
| 前台 10 篇文档全可访问 | ✅ |
| 后台编辑器预览 = 前台效果 | ✅ |
| AI 改写/续写/体检真调 Joybuilder | ✅（本地 backend） |
| 保存生成 commit + 提交审核建 MR | ✅（本地 backend） |
| webhook 收到 push → 审核队列显示 | 待 coding 配置后实测 |
| approve → merge MR → 合入 main | 待仓库评审规则配 |
| OpenAPI 改 yaml → 前台更新 | ✅ |
| Agent .md + llms.txt | ✅ |

## 已知限制（演示时说明）

1. **云机 AI 和 git push 走本地 backend**：云机访问不到京东内网（coding.jd.com / ai-api.jdcloud.com）。演示 AI 和保存时用本地 backend。
2. **webhook 方向待实测**：coding 能否出公网访问云机，配好 webhook 后看 delivery。
3. **approve 真合入**：受 coding 评审规则门槛（需1人评审+不允许自评），配好规则或 bot 账号后真合入。

## 访问地址速查

| 入口 | 地址 |
|---|---|
| 前台文档站 | http://116.196.90.213/joymaas-docs/ |
| 后台编辑器 | http://116.196.90.213/joymaas-doc-admin/ |
| backend API | http://116.196.90.213/api/docs |
| AI metrics | http://116.196.90.213/api/ai/metrics |
| 仓库 | https://coding.jd.com/liangyuanwen.1/doc |
