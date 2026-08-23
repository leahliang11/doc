---
date: 2026-08-23
week: 8
topic: chat-completions 迁移决策
type: 决策报告
owner: Leah
status: 待 Leah 拍板
---

# chat-completions 迁移决策报告

## 背景

Week 6-7 用 embeddings/completions/moderations 三个接口验证了 OpenAPI 生成器。Week 8 补完嵌套展开（4.1/4.2）后，生成器已能处理复杂嵌套结构。现在要决策：手写的样板接口 `chat-completions.mdx`（前 5 周最好的文档）是否迁移到生成模式。

本报告基于「生成版 chat-completions.gen.mdx」vs「手写版 chat-completions.mdx」的量化对比，给出三个选项 + 建议，**Leah 拍板**。

## 量化对比

### 请求参数

| 维度 | 手写 | 生成 | 差距 |
|---|---|---|---|
| 参数行数 | 8 | 9 | 生成多 1 行（messages 展开成 messages[].role + messages[].content） |
| 嵌套表达 | `messages` 一行 + 描述「每项含 role 和 content」 | `messages[].role` + `messages[].content` 两行点路径 | **生成更清晰**（用户直接看到字段名） |
| enum 可选值 | 无 | `role` 自动追加「可选值: system / user / assistant」 | **生成更好**（边界 4.4 修复） |
| required 标记 | model/messages 是 | model/messages 是 | 一致 |
| default 值 | stream/temperature/top_p 有 | 同 | 一致 |

**结论**：请求参数生成版 ≥ 手写版。嵌套展开 + enum 是生成版的优势。

### 响应参数

| 维度 | 手写 | 生成 | 差距 |
|---|---|---|---|
| 参数行数 | 6 | 5 | 手写多 1 行（手写有 `choices` 一行 + `choices[].message`，生成只有 `choices[].message`） |
| 嵌套表达 | `choices[].message` / `choices[].finish_reason` 点路径 | 同 | **一致**（生成器补完 4.1/4.2 后达手写水平） |
| required 标记 | 全标 true | 全标 false（生成器不传 response 的 required） | **手写更好**（响应必填字段语义更准） |
| enum | 无 | `finish_reason` 自动追加「可选值: stop / length / tool_calls」 | **生成更好** |

**结论**：响应参数各有优劣。生成 enum 好，手写 required 语义准。生成器补 response.required 传递即可持平。

### 请求示例

| 维度 | 手写 | 生成 | 差距 |
|---|---|---|---|
| 语言数 | 4（cURL/Python/Node/Go） | 4（同） | 一致 |
| 示例内容 | cURL/Python/Node 完整可跑，Go 是注释占位 | 同 | 一致 |
| 代码块格式 | 单行紧凑（`\n` 转义） | 多行展开（yaml `|` 块） | 手写更紧凑，生成更易读，**视觉差异不影响功能** |

**结论**：请求示例完全一致。

### 章节完整度

| 章节 | 手写 | 生成 | 差距 |
|---|---|---|---|
| 接口概述 | ✅ | ✅ | 一致 |
| 请求参数 | ✅ | ✅ | 生成更优 |
| 请求示例 | ✅ | ✅ | 一致 |
| 响应参数 | ✅ | ✅ | 持平（补 required 后） |
| **流式响应** | ✅（SSE 示例 + warning Callout） | ❌ | **手写独有**（OpenAPI 不表达流式） |
| **错误处理** | ✅（链接错误码排障） | ❌ | **手写独有**（OpenAPI 不表达错误码章节） |
| InternalOnly | ✅ | ✅ | 一致 |

**结论**：生成版缺流式响应 + 错误处理两个章节。这是 OpenAPI 规范的局限——流式行为和错误码排障不在 OpenAPI 标准表达范围内，需要 x-extension 扩展。

## 差距汇总

| 维度 | 生成 vs 手写 | 修法 |
|---|---|---|
| 请求参数嵌套 | 生成更优 | — |
| enum 可选值 | 生成更优 | — |
| 响应 required 语义 | 生成略差 | 生成器补 response.required 传递（半天） |
| 流式响应章节 | 生成缺 | yaml 加 `x-streaming` 扩展 + 生成器渲染（1 天） |
| 错误处理章节 | 生成缺 | yaml 加 `x-errors` 扩展 + 生成器渲染（半天） |

**核心判断**：补完「response.required + x-streaming + x-errors」三个扩展（约 2 天），生成版可达手写水平，甚至超越（enum + 嵌套展开 + 标准化）。

## 三个选项

### 选项 A：覆盖（迁移到生成模式）
- 删手写 chat-completions.mdx，yaml 的 spec 作为唯一源
- 先补 x-streaming + x-errors + response.required 三个扩展
- **优点**：单一数据源，改 yaml 即更新，无漂移风险
- **缺点**：要补 3 个扩展（2 天），OpenAPI yaml 会变长（流式/错误码写进 spec 不够纯粹）
- **适合**：愿意投入 2 天补扩展，追求单一数据源

### 选项 B：双源（生成 + 手写共存）
- 手写 chat-completions.mdx 保留，yaml 也生成（.gen.mdx 不覆盖）
- 生成版管参数表（自动同步），手写版管流式/错误处理/示例
- **优点**：各取所长
- **缺点**：两份文件维护，参数表改了要同步两处，漂移风险高；用户看哪个？
- **适合**：几乎不适合——双源维护成本 > 收益

### 选项 C：混合（当前策略，手写重要 + 生成参考）
- chat-completions 保持手写（重要接口，流式/错误处理是差异化内容）
- completions/embeddings/moderations 保持生成（标准参数接口）
- **优点**：零迁移成本，各接口用最合适的模式
- **缺点**：chat-completions 改参数要手动（不享受生成器红利）
- **适合**：重要接口差异化内容多、标准接口参数为主的场景

## 建议

**推荐选项 C（混合）**，理由：

1. **chat-completions 的流式响应 + 错误处理是 JoyMaaS 文档的差异化内容**，不是参数表能替代的。手写保留这些章节价值更高。
2. **生成器的价值在「标准参数接口批量生成」**（completions/embeddings/moderations 这类），chat-completions 这种需要流式详解的接口用生成反而要补一堆扩展，性价比低。
3. **零迁移成本**，本周不阻塞，Week 9 可以直接做 AI 真接模型。
4. **未来可逆**：如果后续 OpenAPI 标准支持流式表达（或 JoyMaaS 自定义 x-streaming 成熟），再迁移不迟。

**如果 Leah 倾向单一数据源（选项 A）**，本周或 Week 9 补 x-streaming + x-errors + response.required 三个扩展（约 2 天），生成器可达手写水平。

## 不替 Leah 决策

本报告给数据 + 建议，**最终由 Leah 拍板**。三个选项都可行，取决于「单一数据源 vs 差异化内容」的取舍。

## 产物

- 生成版对比产物：`content-repo/content/api/chat-completions.gen.mdx`（Week 8 步骤 6 清理）
- 手写版保留：`content-repo/content/api/chat-completions.mdx`（source=manual）
- yaml 的 chat-completions spec：保留（Week 9 若选 A 可直接用）
