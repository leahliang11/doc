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

  const handleCopy = async () => {
    try {
      const resp = await fetch(`/docs/${slug}.md`)
      if (!resp.ok) return
      const markdown = await resp.text()
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      // 静默失败，不阻塞页面
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
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy as Markdown
        </>
      )}
    </button>
  )
}
