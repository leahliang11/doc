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

## 3. Steps 内 `<div>` 渲染（Week 4 升级发现，Week 10 已修复 ✅）

quickstart 的 Steps 用 `<div>` 包裹步骤，markdown-it 把 `<div>` 当 HTML 块，里面 `**粗体**` 没渲染。

**Week 10 修复**：PreviewSteps 对 `<div>` 子节点的 innerHTML 去缩进后再走一次 markdown-it（`**粗体**` 渲染成 `<strong>`）。同时支持 markdown 列表写法（`1. 2.` → `<ol><li>`，按 `<li>` 拆步骤）。

## 3.1 预览组件 props 解析（Week 10 修复 ✅）

Week 10 统一检查预览发现多个解析问题，已修复：

1. **多行嵌套数组 props 解析失败**：parseProps 用 `[^}]*` 正则不匹配跨行嵌套大括号，Params/CodeTabs 不渲染。改用括号配平扫描。
2. **模板字符串 `${x}` 误执行**：code 字段用反引号时，`new Function` 求值会把 `${process.env.X}` 当插值执行（浏览器无 process）。改用 `escapeTemplateStrings` 把反引号字符串转成 JSON 字面量（`${x}` 不插值）。
3. **单引号/JSON.parse 脆弱**：原 `replace(/(\w+):/)` 会破坏 URL/内容里的冒号。改用 Function 求值（经模板字符串转义后）。
4. **tag 扫描不跳反引号**：parseComponentAt 找 `/>` 时只跳 `"` `'`，遇到反引号字符串里的 `>` 误判。加反引号跳过。

10 篇文档预览全通过，6 组件（Callout/Steps/CodeTabs/Params/InternalOnly/NextSteps）渲染正常，0 解析错误。

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

## 5. chat-completions 迁移决策（Week 8 出，Week 9 确认）

**决策：选项 C 混合策略——重要接口手写 + 参考接口生成。**

- chat-completions 保持手写（流式响应 + 错误处理是差异化内容，OpenAPI 不表达）
- completions/embeddings/moderations 用生成（标准参数接口）
- **定位：产品策略，不是技术妥协**。重要接口差异化内容多，生成器要补一堆扩展（x-streaming/x-errors）性价比低；标准接口参数为主，生成器红利大。
- 详见 `docs/migration-decision.md`（Leah 已拍板选 C）。

## 6. AI 真接 Joybuilder dogfooding 发现（Week 9）

Week 9 把 AI 4 能力从 mock 换成真 Joybuilder 模型（DeepSeek-V4-Flash），dogfooding 暴露的真实问题：

### 6.1 LikeCodeNex 注入 JOYBUILDER_API_KEY 污染（已修复）
- **现象**：后端读到的 key 是 `pk-a6759...`（无效），不是 .env 填的 `pk-3f3b...`，401。
- **根因**：LikeCodeNex IDE 环境注入了同名 `JOYBUILDER_API_KEY`，dotenv 默认不覆盖已有 env，shell 污染压过 .env。
- **修复**：`config.ts` 的 `dotenv({ override: true })`，让 .env 覆盖 shell 注入。和 Week 1/6/7 的 Next 污染同源。
- **记录**：这是第 4 次踩 shell 污染坑（Next vars ×3 + Joybuilder key）。dev.mjs 只清了 Next 变量，后端 Node 服务需要单独 override。

### 6.2 流式请求不能传 request.signal（已修复）
- **现象**：流式 rewrite 报 `This operation was aborted`。
- **根因**：Fastify 的 `request.raw.signal` 在 reply 开始发送后会 abort，传给 chatStream 会导致中途取消。
- **修复**：流式端点不传 request.signal，靠连接关闭自然结束。

### 6.3 延迟观察（Flash 模型）
- rewrite 平均 ~1500ms（含 2 次失败重试，成功单次 ~700-800ms）
- audit 平均 ~2500ms（JSON mode 略慢，含结构化解析）
- **结论**：Flash 单次 < 5s，不开流式也能用，但流式（SSE 边生成边显示）体验明显更好，已默认开。

### 6.4 模型质量观察
- **改写质量高**：「这个功能的话，我们可以通过搞定一些配置来啥的整一下」→「该功能可通过完成相关配置来实现」（口语转书面准确）。
- **体检质量高**：真模型理解语义，检测出 mock 规则抓不到的问题（如「整篇跟着做一遍」→「按照本文步骤操作」），还给了具体改写建议和定位文本。
- **glm-5.2 带 reasoning_content**（思维链），输出冗长，不适合做助手；Flash/Pro 干净，默认用 Flash。

### 6.5 失败率
- rewrite 4 次 2 失败（failRate 0.5）——失败的是调试期 key 污染那次 + 流式 signal 那次，修复后稳定。
- 修复后无失败。Week 10 部署后长期监控真实失败率。

### dogfooding 价值
真用 Joybuilder 写文档，提前暴露了 key 污染、流式 signal、延迟、模型质量等真实问题。这些问题反哺 JoyMaaS 文档系统自身迭代 + Joybuilder 产品体验优化。

## 7. 云机部署发现（Week 10）

Week 10 部署到 116.196.90.213（CentOS 8）暴露的环境问题：

### 7.1 云机访问不到京东内网（结构性限制，未解决）
- **现象**：云机访问 `coding.jd.com`（172.28.60.239）和 `ai-api.jdcloud.com`（10.160.255.20）均超时，22/443/80 全不通。但能访问 joyspace.jd.com、github、baidu。
- **根因**：云机（116.196.90.213 公网）不在京东内网的可访问网段，coding.jd.com 和 ai-api.jdcloud.com 是内网服务不对该云机开放。
- **影响**：
  1. backend 的 AI 能力（调 Joybuilder）在云机 fetch failed——演示时 AI 走本地 backend 兜底
  2. backend 的 git push（回 coding）在云机会失败——save 能本地 commit，但 push 到 coding 不通
  3. webhook 方向（coding → 云机）需配好 coding webhook 后实测 delivery
- **处理**：AI 和 git push 演示走本地 backend。webhook 配置给 Leah 在 coding 网页操作（指引见 docs/demo-script.md）。长期解法：换能访问内网的部署机，或云机配内网代理。

### 7.2 better-sqlite3 在 CentOS 8 编译失败（已解决）
- **现象**：better-sqlite3 13.0.3 在云机 require 报 `GLIBC_2.29 not found`（CentOS 8 glibc 2.28），prebuilt 二进制不能用；源码编译报 node-gyp/python3.6 海象运算符语法错。
- **根因**：CentOS 8 glibc 2.28 < better-sqlite3 prebuilt 要求的 2.29；python3.6 不支持 node-gyp 用的 `:=` 语法。
- **解决**：换用 Node 22 内置的 `node:sqlite`（`DatabaseSync`），零原生依赖，API 和 better-sqlite3 几乎一致（`db.exec/prepare/run/get/all/lastInsertRowid`）。`services/db.ts` 改 import，`package.json` start 加 `NODE_OPTIONS=--experimental-sqlite`。去掉 better-sqlite3 依赖。
- **记录**：第 5 类 shell/环境污染坑的延伸——CentOS 8 老系统的原生模块编译是雷区，能用内置/纯 JS 方案优先。

### 7.3 macOS tar 传文件带 ._ AppleDouble（已解决）
- **现象**：本地 macOS 打包 tar 传到 Linux，每个文件带 `._` 前缀的 AppleDouble 资源叉文件，contentlayer 把 `._xxx.mdx` 当文档扫，docs 列表出现垃圾条目。
- **解决**：传后 `find -name "._*" -delete`。长期解法：tar 加 `--no-xattrs` 或用 `COPYFILE_DISABLE=1`。

### 7.4 webhook 方向待实测（未解决）
- coding.jd.com → 云机 116.196.90.213 这个方向还没实测（需要 Leah 在 coding 网页配 webhook 后看 delivery 日志）。
- backend webhook 端点本身已验证工作正常（本地 curl 模拟 merge_requests open 事件，正确写表）。
- 若 coding 能出公网访问云机，webhook 闭环即通；否则 webhook 方向也受限，演示用本地 curl 模拟。

