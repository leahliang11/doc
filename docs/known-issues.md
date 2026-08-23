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

## 4. OpenAPI 生成器边界（Week 7 发现）

Week 7 加 completions/moderations 验证生成器，发现以下"扛不住"的场景。当前用 workaround 绕过，未修。Week 8-9 决策迁移策略时一并评估是否补。

### 4.1 嵌套对象不展开
生成器只取 schema 顶层 properties，object 类型的 property 只显示 `type: object`，内部 properties 不递归生成子表。
- 例：moderations 响应 `results[0].categories`（object）只显示 object，不列出 hate/violence/sexual 等具体分类。
- 影响：复杂响应结构信息丢失，用户看不到对象内部字段。
- 当前 workaround：对关键嵌套字段手动用点路径 `results[0].flagged` / `results[0].categories` 单独列项（非标准 OpenAPI 写法）。
- 修法：生成器递归遍历 object.properties，生成嵌套 Params 或在 description 里列子字段。

### 4.2 array items 不展开
array 类型的 property 只显示 `type: array`，items 里的 schema 不处理。
- 例：`results`（array）只显示 array，不自动展开 items 里每项的 flagged/categories。
- 标准 OpenAPI 应在 `items.schema.properties` 里定义，生成器不读 items。
- 当前 workaround：手动用 `results[0].xxx` 点路径。
- 修法：生成器读 array.items.schema.properties，用 `xxx[]` 前缀展开。

### 4.3 yaml 重复键直接崩
openapi.yaml 里重复的 mapping key（如两个 `results:`）让 js-yaml 抛 YAMLException，生成器无 try-catch 容错，整个构建中断。
- 影响：spec 写错一个重复键，gen:openapi 全部接口都不生成（构建失败）。
- 修法：生成器 try-catch 包 yaml.load，解析失败给友好错误（指出哪行），不影响已生成的其他接口。

### 4.4 enum 不渲染
OpenAPI 的 `enum` 字段（如 type:string + enum:[float,base64]）生成器没提取，description 里不列出可选值。
- 影响：用户不知道枚举参数的可选值。
- 当前 workaround：在 description 里手写"float 或 base64"。
- 修法：生成器检测 enum，在 description 末尾追加"可选值: a/b/c"。

### 4.5 oneOf/anyOf/allOf 不支持
复合 schema（oneOf/anyOf/allOf）没适配，遇到会当成无 properties 跳过。
- 影响：用复合 schema 定义的请求体/响应体生成空 Params。
- 修法：生成器解析复合 schema，合并 properties。

### 4.6 重复 properties 键（yaml 层面非法）
OpenAPI spec 里同一 properties 下重复字段名是非法 yaml（见 4.3），但生成器该容错而非崩溃。

### 边界汇总
| 场景 | 当前 | 修法 | 优先级 |
|---|---|---|---|
| 嵌套 object | 只显示 object | 递归子表 | 高（Week 8 评估）|
| array items | 只显示 array | 读 items.schema | 高 |
| yaml 重复键 | 崩溃 | try-catch 容错 | 中（健壮性）|
| enum | 不渲染 | 追加可选值 | 中 |
| oneOf/anyOf/allOf | 跳过 | 合并 properties | 低（本项目少用）|

Week 8-9 决策 chat-completions 迁移时，若生成的接口质量因这些边界不达标，先补 4.1/4.2（嵌套+items）再迁移。

