---
date: 2026-08-23
week: 9
owner: Leah
status: 完成
---

# Week 9 周报：AI 真接 Joybuilder 模型

## 完成项

- [x] Joybuilder chat 客户端（services/joybuilder.ts：流式 async generator + JSON mode + 错误处理）
- [x] AI 日志 + 延迟监控（services/ai-log.ts：ai-log.jsonl + ai-metrics.json）
- [x] 4 能力替换 mock 为真模型（rewrite/complete/generate/audit，签名不变）
- [x] 路由加流式 SSE（rewrite/complete/generate 支持 stream:true）
- [x] 前端流式改造（streamSSE helper + 3 函数边收边显示）
- [x] dogfooding 问题记进 known-issues §6

## 判断标准达成

**后台 AI 改写选中文字 → 真调 Joybuilder 返回改写结果 → 显示 → 可采纳。4 能力全通。** ✅

- rewrite 流式：5 个 chunk 边生成边显示（`该 / 功能 / 可通过完成 / 相关配置 / 来实现。`）
- rewrite 非流式：「这个功能的话，我们可以通过搞定一些配置来啥的整一下」→「该功能可通过完成相关配置来实现」
- audit JSON mode：真模型理解语义，检测出口语化问题 + 具体改写建议 + 定位文本（mock 做不到）
- complete/generate：同流式 SSE 链路
- metrics 记录首次/平均/失败率

## 技术实现

### Joybuilder 客户端
- 端点 `http://ai-api.jdcloud.com/v1/chat/completions`（标准 OpenAI Chat 兼容）
- 默认模型 `DeepSeek-V4-Flash`（最快最干净；glm-5.2 带 reasoning_content 太长，Pro 居中）
- `chat(messages, {jsonMode})` 非流式；`chatStream(messages)` async generator yield delta.content
- JSON mode `response_format:{type:'json_object'}` 支持，audit 用它

### 4 能力 prompt 设计
- rewrite：system「技术文档编辑，按指令改写，只返回结果」+ mode 标签（精简/扩写/纠错/改语气）
- complete：system「根据上下文续写，保持风格一致，只返回续写内容」
- generate：system「JoyMaaS 文档作者，可用 Callout/Steps/Params/CodeTabs 组件」
- audit：system「文档审核员，返回 JSON {issues:[{category,message,search}]}」+ JSON mode

### 日志 + 延迟监控
- `data/ai-log.jsonl`：AI_LOG=true 时记 prompt/response/latency（调优用）
- `data/ai-metrics.json`：按 capability 分桶，count/okCount/failCount/firstLatency/avgLatency
- `GET /api/ai/metrics` 读 metrics

### 流式 SSE
- 路由：body 加 `stream:true` 返回 `text/event-stream`，`data: {chunk}\n\n` + `data: [DONE]`
- 前端：`streamSSE(url, body, onChunk)` 用 fetch + ReadableStream 读 SSE，边收边更新编辑器/结果区

## dogfooding 发现（详见 known-issues §6）

### 踩的坑（都修了）
1. **LikeCodeNex 注入 JOYBUILDER_API_KEY 污染**：shell 里有同名旧 key 压过 .env，401。修复：`dotenv({override:true})`。这是第 4 次踩 shell 污染坑（Week 1/6/7 Next vars ×3 + 本周 Joybuilder key）。
2. **流式不能传 request.signal**：Fastify reply 发送后 signal abort，中途取消。修复：流式不传 signal。

### 真实体验观察
- **延迟**：Flash rewrite ~700-1500ms，audit ~2500ms（JSON mode 略慢），均 < 5s，流式体验好。
- **改写质量高**：口语转书面准确，语义理解到位。
- **体检质量高**：检测出 mock 规则抓不到的问题（如「整篇跟着做一遍」→「按照本文步骤操作」），给具体改写建议 + 定位文本。这是真模型的价值。
- **模型选择**：Flash 默认，glm-5.2 带 reasoning_content 冗长不适合助手。

## 关键决策（Leah 定）
- 接 Joybuilder（dogfooding + 合规 + 提前暴露真实体验）
- 默认 DeepSeek-V4-Flash
- API key 走后端环境变量，前端只调 /api/ai/*
- 日志开关 + 延迟监控 + 延迟高加流式（Flash <5s，流式已默认开改善体验）

## 启动方式

```bash
# 后端（.env 填 JOYBUILDER_API_KEY，dotenv override 清 shell 污染）
cd apps/backend && env -u PORT pnpm dev   # :3001
# 前端
cd apps/admin && pnpm dev                  # :5173
# 看 metrics
curl http://127.0.0.1:3001/api/ai/metrics
# 看日志（AI_LOG=true 时）
tail data/ai-log.jsonl
```

## 验证过程

1. curl 测 3 模型可用（glm-5.2/Pro/Flash）✓
2. 测流式 SSE + JSON mode ✓
3. joybuilder.ts 客户端写好 ✓
4. ai-log.ts + metrics ✓
5. ai.ts 4 能力换真模型 ✓
6. routes/ai.ts 流式 SSE ✓
7. Editor.vue streamSSE helper + 3 函数流式 ✓
8. 后端 rewrite 非流式返回改写结果 ✓
9. 后端 rewrite 流式 5 chunk ✓
10. 后端 audit JSON mode 返回高质量结构化结果 ✓
11. 前端文档体检面板真显示出口语化问题 + 建议 ✓
12. metrics 记录 rewrite 4 次 / audit 3 次 + 延迟 + 失败率 ✓
13. 日志 ai-log.jsonl 记 prompt/response ✓
14. key 不泄露（.env 在 .gitignore，代码无明文）✓

## 未完成项 / 留 Week 10

- **前端流式 rewrite/complete UI 验证**：后端 SSE 链路通（curl 验证），前端 streamSSE 代码写好 HMR 无报错，但自动化操作 CodeMirror 选区模拟受限，留真实手动操作验证
- **prompt 精调**：当前 prompt 够用，调优留后续（看日志 ai-log.jsonl 针对性优化）
- **多模型切换 UI**：env 可换模型，UI 切换留后续
- **token 用量计费**：留 Week 10+

## 下周计划（Week 10）

- [ ] 部署到 116.196.90.213（后端 + 前台 + admin）
- [ ] 真实 Coding webhook 配置（替换 curl 模拟）
- [ ] 仓库评审规则 + bot 账号决策（Week 5 留的）
- [ ] 10 篇真内容 + 全流程测试
- [ ] 演示

## 阻塞项

无。AI 4 能力真接 Joybuilder 闭环，dogfooding 价值已体现（暴露并修复 key 污染 + 流式 signal + 确认模型质量）。
