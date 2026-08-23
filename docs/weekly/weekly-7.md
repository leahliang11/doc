---
date: 2026-08-23
week: 7
owner: Leah
status: 完成
---

# Week 7 周报：OpenAPI 生成器边界验证

## 完成项

- [x] openapi.yaml 加 completions 接口 spec（11 参数，验证多 optional 渲染）
- [x] openapi.yaml 加 moderations 接口 spec（嵌套对象 response，验证特殊结构）
- [x] 跑 gen 生成 completions.mdx / moderations.mdx，前台 3 个生成 API 页全可访问
- [x] 生成器边界记录到 docs/known-issues.md（6 个边界点）
- [x] pnpm dev 前置脚本自动清 shell 污染（scripts/dev.mjs，一劳永逸）

## 判断标准达成

**2 个新 API 完整生成 + 前台可访问 + 至少发现 1 个生成器边界记录 known-issues。** ✅

- completions（11 参数，9 optional）+ moderations（嵌套 response）全生成，前台 HTTP 200。
- 发现 6 个生成器边界，写进 known-issues §4。

## 生成器边界发现（详见 docs/known-issues.md §4）

| # | 边界 | 当前 | 优先级 |
|---|---|---|---|
| 4.1 | 嵌套 object 不展开 | 只显示 object | 高 |
| 4.2 | array items 不展开 | 只显示 array | 高 |
| 4.3 | yaml 重复键直接崩 | 无容错 | 中 |
| 4.4 | enum 不渲染 | description 手写 | 中 |
| 4.5 | oneOf/anyOf/allOf 不支持 | 跳过 | 低 |
| 4.6 | 重复 properties 键 | 同 4.3 | 中 |

**最影响质量的两个**：4.1 嵌套 object + 4.2 array items 不展开。moderations 的 `results[0].categories`（object）只显示成 object，内部 hate/violence/sexual 等分类没列出来。当前用 `results[0].xxx` 点路径 workaround（非标准 OpenAPI 写法）。

## 关键决策

### 不迁移 chat-completions（本周只验证边界）
- 本周加 completions/moderations 两个新接口验证生成器，不动手写 chat-completions。
- chat-completions 是前 5 周最好样板，迁移决策要等生成质量数据。
- Week 8-9 对比 3-4 个生成 API vs 1 个手写 chat-completions 的质量差距，再决定迁移策略（覆盖/双源/混合）。

### pnpm dev 自动清污染
- 写 scripts/dev.mjs：spawn next dev 前 delete 掉 IDE 注入的污染变量（NODE_ENV/__NEXT_PRIVATE_*/TURBOPACK/NEXT_DEPLOYMENT_ID）。
- package.json dev 改成 `node scripts/dev.mjs`，固定端口 50528 + --turbopack。
- 一劳永逸：不再每次启动手动 `env -u ...`。解决 Week 1/6 踩的 shell 污染坑。

## 实现要点

### completions spec（验证多 optional）
- 11 个参数：model/prompt（required）+ max_tokens/temperature/top_p/n/stream/logprobs/echo/stop/user（9 optional，带 default）。
- 验证生成器对大量 optional 参数的渲染——Params 表 11 行，required/default 都正确。
- 含 warning Callout（x-callout variant=warning「已推荐改用 Chat Completions」）。

### moderations spec（验证嵌套 response）
- response 含 results 数组 + results[0].flagged（boolean）+ results[0].categories（object）+ results[0].category_scores（object）。
- 用点路径 `results[0].xxx` 是 workaround（非标准 OpenAPI，标准应在 items.schema.properties）。
- 暴露边界 4.1/4.2：object/array 不展开内部结构。

### dev.mjs 清污染脚本
- 列出 6 个污染变量名，spawn 前 delete。
- 默认 args `['--turbopack', '-p', '50528']`，支持传参覆盖。
- stdio inherit，日志直接进终端。

## 踩坑

1. **yaml 重复键让生成器崩**：moderations spec 我故意写了两个 `results:` 键测边界，js-yaml 抛 YAMLException，gen:openapi 整个中断。修掉重复键后恢复。这本身是边界 4.3，记进 known-issues。
2. **contentlayer dev 不扫新文件**：3 个新 mdx 首次需 `pnpm contentlayer` 预生成触发（Generated 6 documents），之后 200。Week 6 同问题。

## 启动方式（本周简化）

```bash
# site（不再手动 env -u，pnpm dev 自动清污染）
cd apps/site && pnpm dev   # :50528
# 后端
cd apps/backend && env -u PORT pnpm dev   # :3001
# admin
cd apps/admin && pnpm dev   # :5173
# 生成 API 文档
cd apps/site && pnpm gen:openapi
```

## 验证过程

1. openapi.yaml 加 completions（11 参数）+ moderations（嵌套 response）✓
2. `pnpm gen:openapi` → 生成 3 篇（embeddings/completions/moderations），跳过 0 ✓
3. contentlayer Generated 6 documents → 3 个生成 API 页全 HTTP 200 ✓
4. completions 页：11 参数渲染 + warning Callout ✓
5. moderations 页：results[0].flagged/categories/category_scores 渲染（object 未展开，边界确认）✓
6. 边界记录：6 个点写进 known-issues §4 ✓
7. pnpm dev 自动清污染：不手动 env -u，next dev Ready + HTTP 200 ✓
8. 手写 chat-completions 未被碰（source=manual）✓

## 生成质量初步观察（Week 8-9 决策输入）

- **简单接口（embeddings/completions）**：生成质量接近手写，Params/CodeTabs/Callout 齐全，optional 参数 + default 渲染正确。
- **复杂 response（moderations）**：嵌套对象信息丢失（categories 内部分类没展开），需补 4.1/4.2 边界或手写补充。
- **chat-completions 迁移倾向**：若补 4.1/4.2（嵌套+items 展开），生成质量可达手写水平，Week 8-9 可考虑迁移；否则保持"手写重要接口 + 生成参考接口"混合。

## 未完成项 / 留 Week 8-9

- **chat-completions 迁移决策**：本周只验证边界，不迁移。Week 8-9 对比质量后定。
- **生成器边界修复**：4.1/4.2（嵌套+items）优先级高，迁移前要补；4.3（yaml 容错）健壮性；4.4/4.5 视需要。
- **push 自动构建**：仍手动触发，Week 10 换 CI。

## 下周计划（Week 8）

- [ ] 补生成器 4.1（嵌套 object 递归）+ 4.2（array items 展开）
- [ ] 用修复后的生成器重跑 moderations，看嵌套结构能否展开
- [ ] 对比修复后生成 embeddings/completions vs 手写 chat-completions 质量
- [ ] 出 chat-completions 迁移决策（覆盖/双源/混合）

## 阻塞项

无。Week 7 边界验证闭环，清污染脚本一劳永逸。
