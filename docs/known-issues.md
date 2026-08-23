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

## 4. OpenAPI 生成器边界（Week 7 发现，Week 8 部分修复）

Week 7 加 completions/moderations 验证生成器，发现以下"扛不住"的场景。Week 8 补完 4.1/4.2/4.4。

### 4.1 嵌套对象不展开（Week 8 已修复 ✅）
生成器只取 schema 顶层 properties，object 类型的 property 只显示 `type: object`，内部 properties 不递归生成子表。
- ~~例：moderations 响应 `results[0].categories`（object）只显示 object，不列出 hate/violence/sexual 等具体分类。~~
- **Week 8 修复**：生成器 `schemaToParamRows` 递归遍历 object.properties，用点路径扁平化（`results[].categories.hate`）。moderations 响应表现在完整展开 13 行。
- 修复前 workaround（点路径 `results[0].xxx`）已废弃，yaml 改回标准 OpenAPI array items.schema.properties 写法。

### 4.2 array items 不展开（Week 8 已修复 ✅）
array 类型的 property 只显示 `type: array`，items 里的 schema 不处理。
- **Week 8 修复**：生成器检测 array.items.schema.properties，递归用 `parent[].child` 前缀展开。chat-completions 的 `messages[].role` / `choices[].message` 自动产出。

### 4.3 yaml 重复键直接崩（未修，中优先级）
openapi.yaml 里重复的 mapping key 让 js-yaml 抛 YAMLException，生成器无 try-catch 容错，整个构建中断。
- 影响：spec 写错一个重复键，gen:openapi 全部接口都不生成（构建失败）。
- 修法：生成器 try-catch 包 yaml.load，解析失败给友好错误（指出哪行），不影响已生成的其他接口。

### 4.4 enum 不渲染（Week 8 已修复 ✅）
OpenAPI 的 `enum` 字段生成器没提取，description 里不列出可选值。
- **Week 8 修复**：生成器 `propToParam` 检测 enum，在 description 末尾追加「可选值: a / b / c」。chat-completions 的 `role` 自动显示「可选值: system / user / assistant」。

### 4.5 oneOf/anyOf/allOf 不支持（未修，低优先级）
复合 schema（oneOf/anyOf/allOf）没适配，遇到会当成无 properties 跳过。
- 影响：用复合 schema 定义的请求体/响应体生成空 Params。
- 修法：生成器解析复合 schema，合并 properties。

### 4.6 多级路径 slug 文件名冲突（Week 8 已修复 ✅）
`/v1/chat/completions` 两级路径，deriveSlug 产出 `chat/completions.mdx`（含斜杠），写文件失败。
- **Week 8 修复**：deriveSlug 多级路径用连字符拼接（`chat-completions`），和手写文件名对齐，触发 manual 保护。

### 边界汇总（Week 8 后）
| 场景 | 状态 | 优先级 |
|---|---|---|
| 嵌套 object | ✅ 已修复（Week 8） | — |
| array items | ✅ 已修复（Week 8） | — |
| enum | ✅ 已修复（Week 8） | — |
| 多级路径 slug | ✅ 已修复（Week 8） | — |
| yaml 重复键 | 未修 | 中（健壮性）|
| oneOf/anyOf/allOf | 未修 | 低（本项目少用）|

Week 8 迁移决策详见 `docs/migration-decision.md`。

