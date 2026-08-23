---
date: 2026-08-23
week: 8
owner: Leah
status: 完成
---

# Week 8 周报：生成器嵌套展开 + 迁移决策

## 完成项

- [x] openapi.yaml 的 moderations 改标准 OpenAPI 写法（删点路径 workaround，改 array items.schema.properties 嵌套定义）
- [x] gen-openapi.ts `schemaToParams` 递归改造：嵌套 object + array items 用点路径扁平化（4.1/4.2 修复）
- [x] enum 自动追加可选值（4.4 修复）
- [x] 多级路径 slug 连字符拼接（4.6 修复，修 `/v1/chat/completions` 写文件失败 bug）
- [x] 生成器加对比模式（manual 文件旁路输出 .gen.mdx）
- [x] yaml 加 chat-completions 完整 spec
- [x] 重跑 moderations 验证嵌套完整展开（13 行点路径）
- [x] 出迁移决策报告 docs/migration-decision.md
- [x] 清污染脚本记 memory（后续所有 Next 项目都用）

## 判断标准达成

**moderations 的 `results[].categories` 嵌套字段完整展开到前台 + 生成的 chat-completions 和手写版差距量化。** ✅

- moderations 响应参数表从 5 行（含 3 行 object 占位）→ 13 行完整点路径（`results[].flagged` / `results[].categories.hate` / `results[].category_scores.hate` 等）。
- 前台 4 个 API 页全 HTTP 200。
- chat-completions 生成版 vs 手写版量化对比（参数/示例/流式/错误处理 4 维度），出决策报告。

## 生成器递归展开设计

核心：`schemaToParamRows(schema, prefix, depth)` 递归，点路径扁平化（不改前台/后台 Params 组件）。

- **object 有 properties** → 递归，object 自身不列行（避免冗余）
- **object 无 properties**（如 usage 只有一句描述）→ 保留 object 一行（和手写一致）
- **array items 是 object** → 递归，用 `parent[].child` 前缀（和手写 `choices[].message` 风格一致）
- **array items 是 primitive** → 保留 array 一行
- **maxDepth 3** 防无限递归

边界 4.4（enum）顺带修：`propToParam` 检测 enum，description 末尾追加「可选值: a / b / c」。

## 迁移决策结论（详见 docs/migration-decision.md）

| 维度 | 生成 vs 手写 | 修法 |
|---|---|---|
| 请求参数嵌套 | 生成更优（messages[].role/content 两行） | — |
| enum 可选值 | 生成更优 | — |
| 响应 required 语义 | 生成略差 | 补 response.required 传递（半天） |
| 流式响应章节 | 生成缺 | 补 x-streaming 扩展（1 天） |
| 错误处理章节 | 生成缺 | 补 x-errors 扩展（半天） |

**建议选项 C（混合）**：chat-completions 保持手写（流式+错误处理是差异化内容），标准参数接口用生成。零迁移成本，Week 9 可直接做 AI 真接模型。若 Leah 倾向单一数据源（选项 A），补 3 个扩展约 2 天可达手写水平。

**Leah 拍板**，不替决策。

## 关键 bug 修复（边界 4.6）

`/v1/chat/completions` 两级路径，deriveSlug 产出 `chat/completions.mdx`（含斜杠），写文件 ENOENT。改成多级路径连字符拼接（`chat-completions`），和手写文件名对齐，触发 manual 保护。这个 bug 不修，对比模式根本跑不起来。

## 实现要点

### moderations yaml 标准化
- 删 `results[0].flagged` / `results[0].categories` / `results[0].category_scores` 点路径 workaround
- 改 `results` array 下 `items.schema.properties` 嵌套定义 flagged/categories/category_scores
- categories 和 category_scores 都是 object，properties 列 hate/threatening/self-harm/sexual/violence

### 对比模式
- manual 保护文件不 skip，改写到 `<name>.gen.mdx`
- chat-completions.mdx（手写 5036 字节）+ chat-completions.gen.mdx（生成 4508 字节）并存对比
- 对比完删 .gen.mdx，手写不被碰

## 踩坑

1. **多级路径 slug bug**：deriveSlug 不处理 `/`，`chat/completions.mdx` 写文件失败。修成连字符。
2. **contentlayer 缓存**：改 mdx 后要 `pnpm contentlayer` 重新编译才在前台生效（Week 6/7 同问题）。

## 启动方式

```bash
cd apps/site && pnpm dev           # :50528（dev.mjs 自动清污染）
cd apps/site && pnpm gen:openapi   # 生成 API 文档
cd apps/site && pnpm contentlayer  # 重新编译 mdx
```

## 验证过程

1. moderations yaml 改标准写法 ✓
2. schemaToParams 递归改造 ✓
3. `pnpm gen:openapi` → 3 篇生成，moderations 响应 13 行点路径 ✓
4. completions/embeddings 回归（11 参数 + 5 参数正常）✓
5. 前台 4 个 API 页全 HTTP 200 ✓
6. chat-completions spec 加 yaml ✓
7. 对比模式：chat-completions.gen.mdx 产出，手写不被碰 ✓
8. 迁移决策报告（4 维度量化 + 3 选项 + 建议）✓
9. known-issues §4 更新（4.1/4.2/4.4/4.6 标记已修复）✓
10. 清污染脚本记 memory ✓

## 未完成项 / 留 Week 9

- **chat-completions 迁移执行**：本周只出决策，Leah 拍板后执行（选 A 补扩展 / 选 C 保持手写）
- **4.3 yaml 重复键容错**：未修（健壮性，不阻塞）
- **4.5 oneOf/anyOf/allOf**：未修（本项目少用）
- **AI 真接模型**：从 Week 8 挪到 Week 9（Anthropic/OpenAI SDK 集成）

## 下周计划（Week 9）

- [ ] AI 真接模型（替换 services/ai.ts 的 mock 实现）
- [ ] 若 Leah 选迁移选项 A，补 x-streaming + x-errors + response.required 扩展

## 阻塞项

无。生成器嵌套展开闭环，迁移决策已出（待 Leah 拍板）。
