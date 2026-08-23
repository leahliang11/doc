---
date: 2026-08-23
week: 6
owner: Leah
status: 完成
---

# Week 6 周报：OpenAPI 自动生成 + push 构建标记

## 完成项（对照 P0 落地规划 §12 Week 6）

- [x] `content-repo/openapi/openapi.yaml`：embeddings 接口 spec（OpenAPI 3.0，含 requestBody/responses/x-codeSamples/x-callout/x-internal）。
- [x] `apps/site/scripts/gen-openapi.ts`：读 yaml → 遍历 paths → 生成 content/api/embeddings.mdx，自动注入 Params/CodeTabs/Callout/InternalOnly，source=openapi。
- [x] package.json：`gen:openapi` 脚本 + `build` 前置 gen。
- [x] `build_tasks` 表 + db 函数（recordBuildNeed/listBuildTasks/updateBuildTaskStatus/clearBuildTask/countPendingBuildTasks）。
- [x] webhook push：push 到 main → 写 build_tasks（不自动 spawn）。
- [x] `routes/build.ts`：GET /api/build/tasks、POST /api/build/run（spawn pnpm gen:openapi，异步，完成写 log）、DELETE /:id。
- [x] admin 顶栏：「N 待构建」徽章 + 立即构建按钮（15s 轮询 + 触发后 3s 轮询到 done/failed）。
- [x] 生成器幂等 + manual 保护（source=manual 的文件绝不覆盖）。

## 判断标准达成

**改 openapi.yaml 加一个 optional 参数 → 构建后前台 embeddings 页自动多一行参数说明，格式和手写页一致。**

实测：openapi.yaml 给 embeddings 加 `dimensions`（integer, optional）→ 跑 `pnpm gen:openapi` → embeddings.mdx 请求参数表从 4 行变 5 行（多了 dimensions）→ contentlayer 重新编译 → 前台 /docs/api/embeddings 渲染出 dimensions 行，格式与手写 chat-completions 完全一致（Params 表格 + CodeTabs + Callout）。

## 关键决策（Leah 定）

1. **embeddings 验证生成机制，不覆盖手写 chat-completions**：选 3"先跑通再决策"。chat-completions 是前 5 周最好的手写样板，不为验证机制冒险覆盖。Week 7 再对比生成质量决定迁移策略。
2. **push 标记 + 手动构建（选 2），不后端 spawn 自动构建**：后端只记账（build_tasks），构建由手动/CI 触发。职责清晰、Week 10 可演进（换 CI 不动 webhook 逻辑）。反对后端 spawn 自动构建：拖主进程、本地/云主机逻辑不一致、后端职责越界。

## 实现要点

### gen-openapi.ts 生成器
- js-yaml 解析 openapi.yaml → 遍历 paths → 每个 operation 生成一篇 mdx。
- slug 派生：`/v1/embeddings` → 去 `/v1/` → `api/embeddings` → 文件 content/api/embeddings.mdx。
- frontmatter：title=summary / description / slug / category=api / source=openapi / updated=今天。
- body：接口概述（METHOD url）→ Callout（x-callout）→ 请求参数 Params（requestBody.schema.properties，required 映射、default/example 提取）→ 请求示例 CodeTabs（x-codeSamples）→ 响应参数 Params（responses.200.schema）→ InternalOnly（x-internal）。
- **反引号转义**：code 里的反引号转义为 `\``，避免破坏 CodeTabs 模板字符串。
- **manual 保护**：生成前查目标文件 frontmatter source，source=manual 则跳过（warn），绝不覆盖手写。
- **幂等**：每次生成覆盖 source=openapi 的同名文件。

### build_tasks + push 记账
- build_tasks 表：source（push/manual）/ ref / status（pending/building/done/failed）/ created_at / built_at / log。
- webhook push：ref 含 main → recordBuildNeed('push', ref)；非 main 忽略。不自动 spawn。
- POST /api/build/run：recordBuildNeed('manual') + 异步 spawn `pnpm gen:openapi`（site 目录），完成 updateBuildTaskStatus(done/failed) + log。

### admin 顶栏
- onMounted 调 listBuildTasks('pending') + 15s 轮询。
- >0 显示「N 待构建」琥珀徽章 + 立即构建按钮。
- 触发构建后 3s 轮询 listBuildTasks('all')，最新任务 done/failed 时停止 + alert 结果。

## 踩坑记录

1. **shell 环境污染导致 site dev 启动炸**：LikeCodeNex IDE 注入 `NODE_ENV=production` + `__NEXT_PRIVATE_STANDALONE_CONFIG`（指向别人项目 zhaohongyang1/likecode-next-pack）+ `TURBOPACK=1` 等。Next dev 读污染变量用错 config，报 `Missing field turbopackMemoryEviction`。解法：启动用 `env -u NODE_ENV -u __NEXT_PRIVATE_STANDALONE_CONFIG -u __NEXT_PRIVATE_ORIGIN -u TURBOPACK -u NEXT_DEPLOYMENT_ID npx next dev --turbopack`。Week 1 提过的 shell 污染问题再现。
2. **contentlayer dev 不扫描新生成文件**：gen 出 embeddings.mdx 后 dev 模式 404，需手动 `pnpm contentlayer` 预生成触发。生产 build 不受影响（build 前置 gen + contentlayer）。
3. **ESM 下 __dirname 不存在**：build.ts 用 `__dirname` 报 ReferenceError（server.ts top-level await 是 ESM）。改 `import.meta.dirname`。
4. **tsx 未装**：site 无 tsx，`pnpm add -D tsx` 装 4.23.12。

## 验证过程（真实走了一遍）

1. `pnpm gen:openapi` → 生成 embeddings.mdx（source=openapi，4 参数 + CodeTabs cURL/Python/Node + 响应 Params + Callout + InternalOnly）✓
2. **核心判断标准**：yaml 加 dimensions → 再 gen → mdx 请求参数 5 行 → contentlayer 重编译 → 前台 embeddings 页渲染 dimensions 行，格式与手写一致 ✓
3. curl 模拟 push（ref=main）→ build_tasks 写 1 条 pending；非 main push 不写 ✓
4. POST /api/build/run → task_id=3 building → 8s 后 status=done，log 含"生成 embeddings.mdx...完成 1 篇" ✓
5. 生成器幂等：再跑 gen 不报错 ✓
6. manual 保护：代码逻辑检查 source=manual 跳过（embeddings 是新建不触发，chat-completions 不在 yaml 里天然不冲突）✓
7. admin 顶栏 15s 轮询待构建数 ✓

## 未完成项 / 已知问题

- **chat-completions 迁移到生成模式**：Week 7 决策。对比生成 embeddings 和手写 chat-completions 的质量差距：差距小→迁移 chat-completions（用 x-overview 保留手写概述）；差距大→保持"手写重要接口 + 生成参考接口"混合策略，记 known-issues。
- **push 不自动构建**：手动触发，Week 10 换 CI。
- **contentlayer dev 需手动触发预生成**：仅 dev 模式，生产 build 正常。
- **embeddings 一个接口**：多接口批量生成留后续。

## 启动方式

```bash
# site（清 shell 污染变量）
cd apps/site && env -u NODE_ENV -u __NEXT_PRIVATE_STANDALONE_CONFIG -u __NEXT_PRIVATE_ORIGIN -u TURBOPACK npx next dev --turbopack  # :50528
# 后端
cd apps/backend && env -u PORT pnpm dev   # :3001
# 前端
cd apps/admin && pnpm dev                  # :5173
# 生成 API 文档
cd apps/site && pnpm gen:openapi
```

## 下周计划（Week 7）

- [ ] 对比生成 embeddings vs 手写 chat-completions 质量，决策迁移策略
- [ ] 可能迁移 chat-completions 到生成模式（x-overview 保留手写内容）
- [ ] 生成器增强：enum 参数、嵌套对象、错误响应（4xx）生成
- [ ] 清理 Week 5 approve merge 平台卡点（如 Week 10 提前）—— 看优先级

## 阻塞项

无。Week 6 代码闭环，判断标准达成。
