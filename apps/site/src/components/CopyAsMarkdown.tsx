'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

// 复制本文档的纯 Markdown 版本（供 Agent 消费）
// 点击时 fetch /docs/:slug.md 拿现成 Markdown，复用 .md 路由
interface CopyAsMarkdownProps {
  slug: string
}

export function CopyAsMarkdown({ slug }: CopyAsMarkdownProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  const handleCopy = async () => {
    try {
      // 用当前页面路径推算 .md URL：basePath 下 location.pathname 已含前缀，
      // 直接 pathname + '.md' 不管部署在哪个子路径都对
      const url = `${location.pathname}.md`
      const resp = await fetch(url)
      if (!resp.ok) {
        setError(true)
        setTimeout(() => setError(false), 2000)
        return
      }
      const markdown = await resp.text()
      // 优先用 clipboard API；失败（如页面未聚焦/被禁）时用 execCommand 兜底，保证总能复制
      try {
        await navigator.clipboard.writeText(markdown)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = markdown
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-neutral-400 hover:text-foreground dark:hover:border-neutral-500"
      aria-label="复制为 Markdown"
      title="复制本文档的纯 Markdown（供 AI 使用）"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-primary" />
          已复制
        </>
      ) : error ? (
        <>
          <Copy className="h-3.5 w-3.5 text-destructive" />
          复制失败
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy as Markdown
        </>
      )}
    </button>
  )
}
