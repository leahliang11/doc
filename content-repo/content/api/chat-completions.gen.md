---
title: 创建对话补全
description: 创建一个对话补全。给定一组消息列表，模型返回一个补全响应。支持流式返回和函数调用。兼容 OpenAI Chat Completions API。
slug: api/chat-completions
category: api
audience: external
updated: 2026-08-24
status: published
owner: leah
ai_readable: true
source: openapi
---

## 接口概述

```http
POST /v1/chat/completions
```
创建一个对话补全。给定一组消息列表，模型返回一个补全响应。支持流式返回和函数调用。兼容 OpenAI Chat Completions API。

<Callout variant="info" title="兼容 OpenAI 格式">

本接口兼容 OpenAI Chat Completions API，已有的 OpenAI 客户端只需替换 base_url 和 api_key。

</Callout>

## 请求参数

<Params params={[
  { name: 'model', type: 'string', required: true, description: '模型 ID，如 doubao-pro-256k。完整列表见 /v1/models' },
  { name: 'messages[].role', type: 'string', required: false, description: '消息角色，system / user / assistant。可选值: system / user / assistant' },
  { name: 'messages[].content', type: 'string', required: false, description: '消息内容' },
  { name: 'stream', type: 'boolean', required: false, default: 'false', description: '是否使用流式返回（SSE）' },
  { name: 'temperature', type: 'number', required: false, default: '1', description: '采样温度，范围 0-2，越大越发散' },
  { name: 'max_tokens', type: 'integer', required: false, description: '最大输出 token 数' },
  { name: 'top_p', type: 'number', required: false, default: '1', description: '核采样，与 temperature 二选一' },
  { name: 'tools', type: 'array', required: false, description: '函数调用工具列表' },
  { name: 'response_format', type: 'object', required: false, description: '返回格式控制，如 {"type":"json_object"}' }
]} />

## 请求示例

<CodeTabs tabs={[
  { label: 'cURL', code: `curl -X POST https://api.joymaas.com/v1/chat/completions \
  -H "Authorization: Bearer $JOYMAAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-pro-256k",
    "messages": [
      {"role": "system", "content": "你是一个简洁的助手"},
      {"role": "user", "content": "用一句话解释什么是向量"}
    ],
    "stream": false
  }'` },
  { label: 'Python', code: `import requests

resp = requests.post(
    "https://api.joymaas.com/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {JOYMAAS_API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "model": "doubao-pro-256k",
        "messages": [
            {"role": "system", "content": "你是一个简洁的助手"},
            {"role": "user", "content": "用一句话解释什么是向量"},
        ],
    },
)
print(resp.json())` },
  { label: 'Node', code: `const resp = await fetch("https://api.joymaas.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.JOYMAAS_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "doubao-pro-256k",
    messages: [
      { role: "system", content: "你是一个简洁的助手" },
      { role: "user", content: "用一句话解释什么是向量" },
    ],
  }),
});
console.log(await resp.json());` },
  { label: 'Go', code: `// 用 net/http 构造 POST 请求
// body := \`{"model":"doubao-pro-256k","messages":[...]}\`
// req, _ := http.NewRequest("POST", "https://api.joymaas.com/v1/chat/completions", strings.NewReader(body))
// req.Header.Set("Authorization", "Bearer "+apiKey)
// 参见完整 SDK 示例` }
]} />

## 响应参数

<Params params={[
  { name: 'id', type: 'string', required: false, description: '本次补全的唯一 ID' },
  { name: 'model', type: 'string', required: false, description: '实际生成响应的模型 ID' },
  { name: 'choices[].message', type: 'object', required: false, description: '含 role 和 content 的消息对象' },
  { name: 'choices[].finish_reason', type: 'string', required: false, description: '停止原因，stop / length / tool_calls。可选值: stop / length / tool_calls' },
  { name: 'usage', type: 'object', required: false, description: 'token 用量统计' }
]} />

响应示例见 [快速开始](/docs/quickstart)。

<InternalOnly>

内部限流策略：单 Key 默认 1000 RPM / 2000000 TPM，超出返回 429。SLA：P99 < 2s，可用性 99.9%。内部容量水位看内部监控大盘 joymaas-api-capacity。

</InternalOnly>
