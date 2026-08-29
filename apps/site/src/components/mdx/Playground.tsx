'use client'

import { useState, useRef } from 'react'
import { Play, Square, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

// Playground 默认请求体（每个 endpoint 一份合理示例）
const DEFAULT_BODIES: Record<string, object> = {
  'chat-completions': {
    model: 'DeepSeek-V4-Flash',
    messages: [
      { role: 'system', content: '你是一个 JoyMaaS API 助手，回答简洁。' },
      { role: 'user', content: '简单介绍一下你自己' },
    ],
    temperature: 0.7,
    max_tokens: 256,
  },
  embeddings: {
    model: 'embedding-3',
    input: '快速开始接入 JoyMaaS',
    encoding_format: 'float',
  },
  moderations: {
    model: 'moderation-latest',
    input: '这是一条测试文本，用于检测内容安全。',
  },
}

const ENDPOINT_LABELS: Record<string, string> = {
  'chat-completions': 'POST /v1/chat/completions',
  'embeddings': 'POST /v1/embeddings',
  'moderations': 'POST /v1/moderations',
}

interface PlaygroundProps {
  endpoint: string
  /** 覆盖默认请求体（可选） */
  defaultBody?: object
}

export function Playground({ endpoint, defaultBody }: PlaygroundProps) {
  const initBody = JSON.stringify(
    defaultBody ?? DEFAULT_BODIES[endpoint] ?? {},
    null,
    2,
  )
  const [bodyText, setBodyText] = useState(initBody)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string>('')
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [latency, setLatency] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const abortRef = useRef<(() => void) | null>(null)

  // 后端 URL：生产环境 nginx 把 /api/* 路由到 backend，dev 期走 NEXT_PUBLIC_BACKEND_URL
  const backendBase =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? '')
      : ''

  const validateBody = (): object | null => {
    try {
      const parsed = JSON.parse(bodyText)
      setBodyError(null)
      return parsed
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '无法解析'
      setBodyError('JSON 格式有误：' + message)
      return null
    }
  }

  const handleRun = async () => {
    const body = validateBody()
    if (!body) return

    setRunning(true)
    setOutput('')
    setErrMsg(null)
    setLatency(null)

    let aborted = false
    const controller = new AbortController()
    abortRef.current = () => {
      aborted = true
      controller.abort()
    }

    try {
      const res = await fetch(`${backendBase}/api/playground/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, body }),
        signal: controller.signal,
      })

      if (res.status === 429) {
        setErrMsg('请求过于频繁，请 1 分钟后再试')
        setRunning(false)
        return
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        setErrMsg(`请求失败 HTTP ${res.status}：${txt.slice(0, 200)}`)
        setRunning(false)
        return
      }
      if (!res.body) {
        setErrMsg('响应 body 为空')
        setRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done || aborted) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('event: chunk')) continue
          if (line.startsWith('event: done')) continue
          if (line.startsWith('event: error')) continue
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          try {
            const data = JSON.parse(payload)
            if (data.text !== undefined) {
              setOutput((prev) => prev + data.text)
            }
            if (data.latencyMs !== undefined) {
              setLatency(data.latencyMs)
            }
            if (data.message !== undefined) {
              setErrMsg(
                data.status
                  ? `错误 ${data.status}：${
                      typeof data.message === 'string'
                        ? data.message
                        : JSON.stringify(data.message, null, 2)
                    }`
                  : data.message,
              )
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    } catch (error: unknown) {
      if (!aborted) {
        setErrMsg(error instanceof Error ? error.message : '请求异常')
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    abortRef.current?.()
  }

  const handleReset = () => {
    setBodyText(initBody)
    setBodyError(null)
    setOutput('')
    setErrMsg(null)
    setLatency(null)
  }

  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-border bg-background">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="rounded bg-brand px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
            POST
          </span>
          <code className="text-[12px] text-foreground">
            {ENDPOINT_LABELS[endpoint] ?? endpoint}
          </code>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
          aria-label={collapsed ? '展开 Playground' : '收起 Playground'}
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
          {/* 左侧：请求编辑器 */}
          <div className="flex flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                请求体
              </span>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="重置为默认值"
              >
                <RotateCcw className="h-3 w-3" />
                重置
              </button>
            </div>
            <textarea
              value={bodyText}
              onChange={(e) => {
                setBodyText(e.target.value)
                setBodyError(null)
              }}
              spellCheck={false}
              className="min-h-[160px] flex-1 resize-none bg-canvas px-3 py-2.5 font-mono text-[12px] leading-[1.6] text-foreground outline-none placeholder:text-muted-foreground lg:min-h-[210px]"
              placeholder="{}"
            />
            {bodyError && (
              <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                {bodyError}
              </p>
            )}
            {/* Run / Stop 按钮 */}
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              {running ? (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  停止
                </button>
              ) : (
                <button
                  onClick={handleRun}
                  className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-brand/90"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  运行
                </button>
              )}
              {latency !== null && (
                <span className="text-[11px] text-muted-foreground">
                  {latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
          </div>

          {/* 右侧：响应区 */}
          <div className="flex flex-col">
            <div className="flex items-center border-b border-border px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                响应
              </span>
              {running && (
                <span className="ml-2 flex items-center gap-1 text-[11px] text-brand">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                  生成中
                </span>
              )}
            </div>
            <div className="relative min-h-[160px] flex-1 overflow-auto bg-[#f7f7f9] px-3 py-2.5 lg:min-h-[210px] dark:bg-[#1b1b1f]">
              {errMsg ? (
                <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-rose-700 dark:text-rose-300">
                  {errMsg}
                </pre>
              ) : output ? (
                <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-foreground">
                  {output}
                </pre>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">
                  {running ? '等待响应...' : '点击「运行」发送请求'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
