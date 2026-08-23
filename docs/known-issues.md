---
date: 2026-08-23
topic: 已知问题清单
type: 跟踪
owner: Leah
status: 跟踪中
---

# 已知问题清单

记录跨周跟踪、未在本周解决的问题。每条注明发现周、影响、处理计划。

## 1. Coding MR 评审规则导致 approve 无法真合入（Week 5 发现）

### 现象
后台「审核队列」点「通过」→ 后端调 `gitbeaker.MergeRequests.merge()` → Coding API 返回 HTTP 200，但 MR 实际未合入（`state` 仍 `opened`，`merge_status` 一直 `unknown`，`merged_at` 为 null）。

### 根因
京东 Coding 的 MR 默认开启评审规则（浏览器打开 MR 页可见）：
- 「需 1 人评审通过」
- 「不允许自评」（Leah 自己开的 MR 不能自己审）
- 「不允许评审通过后自动合并代码」

标准 GitLab MR 默认无评审门槛可直接合，京东 Coding 默认开评审。`merge_status: unknown` 是 Coding 还没满足评审条件、不可合并的状态。gitbeaker 的 merge 调用因此静默失败（HTTP 200 但没真合）。

### 影响
- 判断标准 3「点通过 → merge MR → 合入 main」在当前仓库配置下无法真闭环（merge API 调用链正确，但平台拦住）。
- 不影响 Week 5 其他全部功能（webhook 写表、双通道队列、diff、状态回流、驳回 closeMR 均正常）。

### 当前处理（Week 5）
approve 端点已做如实处理：mergeMR 调用后查 MR 实际状态，真合了标 `merged`，没合保持 `pending` + comment 记录原因，返回 HTTP 409 `merge_pending`。代码链路正确性已验证。

### 处理计划（Week 10 部署时配套决策）
届时是正式仓库，评审规则要重新配，一并决策：
1. 仓库评审规则改「不需评审」或「允许自评」？还是保留评审门槛用 bot 账号审？
2. 是否申请 bot 账号 PAT 做审批（满足「需1人评审」且避开「不允许自评」）？
3. bot 账号 / 审批策略 / 仓库保护分支 一起定。

### 不要做（Leah 决定）
- 不改当前仓库评审设置（避免绕开 P0 最想验证的审核卡口机制）
- 不本周申请 bot PAT（等 Week 10 一起决策）
- 不因为这个卡点阻塞 Week 5 收官

## 2. contentlayer2 跨大版本风险（Week 1 发现，已记入 weekly-1）

Next.js 16 + contentlayer2 是踩出来的路，contentlayer2 原作者停更、社区 fork。P0 期间不动，后续 Next 升级要评估换方案。详见 weekly-1.md。

## 3. Steps 内 `<div>` 渲染（Week 4 升级发现，已记入 weekly-4）

quickstart 的 Steps 用 `<div>` 包裹步骤，markdown-it 把 `<div>` 当 HTML 块，里面 `**粗体**` 没渲染。是内容写法问题。可后续让 Steps 预览组件对 `<div>` 子节点再走一次 markdown-it。
