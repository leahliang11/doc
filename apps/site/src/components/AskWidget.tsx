'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { useAudience } from '@/providers/audience-provider'

// ── 类型 ──────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  resultNone?: boolean    // AI 表示文档里没有答案
  useful?: boolean | null // 用户反馈 true/false/null(未反馈)
  latencyMs?: number
}

// ── 工具 ──────────────────────────────────────────────────────
function randomId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const backendBase =
  typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? '') : ''

// ── 主组件 ────────────────────────────────────────────────────
interface AskWidgetProps {
  /** 当前文档页面 slug（用于 context hint）*/
  pageSlug?: string
}

export function AskWidget({ pageSlug }: AskWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { audience } = useAudience()
  const sessionId = useRef(randomId())   // 一次打开共享一个 sessionId
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<(() => void) | null>(null)

  // 滚到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  // 监听搜索零结果跳转（DocSearch 发出 open-ask-widget 事件）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { query?: string }
      setOpen(true)
      sessionId.current = randomId()
      if (detail?.query) {
        setInput(detail.query)
        setTimeout(() => inputRef.current?.focus(), 150)
      }
    }
    window.addEventListener('open-ask-widget', handler)
    return () => window.removeEventListener('open-ask-widget', handler)
  }, [])

  const handleOpen = () => {
    setOpen(true)
    // 重置 sessionId，每次打开新会话
    sessionId.current = randomId()
    setTimeout(() => inputRef.current?.focus(), 100)
  }
  const handleClose = () => {
    setOpen(false)
    abortRef.current?.()
  }

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return

    setInput('')
    const userMsg: Message = { id: randomId(), role: 'user', content: q }
    setMessages((prev) => [...prev, userMsg])

    const assistantId = randomId()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ])
    setLoading(true)
    scrollToBottom()

    let aborted = false
    const controller = new AbortController()
    abortRef.current = () => {
      aborted = true
      controller.abort()
    }

    let fullText = ''
    let resultNone = false
    let latencyMs: number | undefined

    try {
      const res = await fetch(`${backendBase}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          audience,
          pageSlug,
          sessionId: sessionId.current,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '')
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `请求失败（${res.status}）：${txt.slice(0, 100)}` }
              : m,
          ),
        )
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
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          try {
            const data = JSON.parse(payload)
            if (data.text !== undefined) {
              fullText += data.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullText } : m,
                ),
              )
              scrollToBottom()
            }
            if (data.resultNone !== undefined) resultNone = data.resultNone
            if (data.latencyMs !== undefined) latencyMs = data.latencyMs
            if (data.message !== undefined) {
              // error event
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: `出错了：${data.message}` }
                    : m,
                ),
              )
            }
          } catch {
            // 忽略
          }
        }
      }

      // 打上 resultNone + latency
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, resultNone, latencyMs, useful: null }
            : m,
        ),
      )
      scrollToBottom()
    } catch (e: unknown) {
      if (!aborted) {
        const message = e instanceof Error ? e.message : String(e)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `请求异常：${message}` }
              : m,
          ),
        )
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFeedback = async (msgId: string, useful: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, useful } : m)),
    )
    try {
      await fetch(`${backendBase}/api/ask/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.current, useful }),
      })
    } catch {
      // 忽略反馈失败
    }
  }

  return (
    <>
      {/* 浮球 */}
      <button
        onClick={open ? handleClose : handleOpen}
        className={
          'fixed bottom-6 right-6 z-50 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-all ' +
          (open
            ? 'bg-muted text-muted-foreground hover:bg-muted/80'
            : 'bg-brand text-white hover:bg-brand/90 shadow-brand/30')
        }
        aria-label={open ? '关闭 Ask JoyMaaS' : '打开 Ask JoyMaaS 文档助手'}
        title={open ? '关闭' : 'Ask JoyMaaS'}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* 抽屉 */}
      {open && (
        <div className="fixed bottom-[4.5rem] right-6 z-50 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-border bg-brand px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-white/80" />
              <span className="text-[14px] font-semibold text-white">Ask JoyMaaS</span>
            </div>
            <button
              onClick={handleClose}
              className="grid h-7 w-7 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ maxHeight: '380px', minHeight: '120px' }}>
            {messages.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-[13px] text-muted-foreground">
                  有什么关于 JoyMaaS 的问题？
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground/60">
                  我只回答文档里有的内容
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    'max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ' +
                    (msg.role === 'user'
                      ? 'bg-brand text-white'
                      : 'bg-muted text-foreground')
                  }
                >
                  {msg.content ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}

                  {/* 反馈按钮（仅 AI 消息、有内容、有 useful 字段时显示）*/}
                  {msg.role === 'assistant' && msg.content && msg.useful !== undefined && (
                    <div className="mt-2 flex items-center gap-2 border-t border-border/40 pt-2">
                      {msg.useful === null ? (
                        <>
                          <span className="text-[11px] text-muted-foreground">有帮助吗？</span>
                          <button
                            onClick={() => handleFeedback(msg.id, true)}
                            className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-emerald-600"
                            title="有帮助"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id, false)}
                            className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-red-500"
                            title="没帮助"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {msg.useful ? '👍 谢谢反馈' : '👎 已记录，我们会改进'}
                        </span>
                      )}
                      {msg.latencyMs !== undefined && (
                        <span className="ml-auto text-[10px] text-muted-foreground/50">
                          {msg.latencyMs < 1000
                            ? `${msg.latencyMs}ms`
                            : `${(msg.latencyMs / 1000).toFixed(1)}s`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 免责小字 */}
          <p className="border-t border-border px-4 py-1.5 text-center text-[11px] text-muted-foreground/60">
            AI 可能答错，重要信息请核对文档
          </p>

          {/* 输入框 */}
          <div className="flex items-end gap-2 border-t border-border px-3 py-2.5">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="问一个关于 JoyMaaS 的问题…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-lg bg-muted px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-brand/40 disabled:opacity-50"
              style={{ maxHeight: '100px' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 100)}px`
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="mb-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand/90 disabled:opacity-40"
              aria-label="发送"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
