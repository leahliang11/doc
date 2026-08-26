'use client'

import { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'

// 复制本文档的纯 Markdown 版本（供 Agent 消费）
// 点击时 fetch /docs/:slug.md 拿现成 Markdown，复用 .md 路由
interface CopyAsMarkdownProps {
  slug: string
}

export function CopyAsMarkdown({ slug }: CopyAsMarkdownProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  const [showTip, setShowTip] = useState(false)

  const handleCopy = async () => {
    try {
      const url = `${location.pathname}.md`
      const resp = await fetch(url)
      if (!resp.ok) {
        setError(true)
        setTimeout(() => setError(false), 2000)
        return
      }
      const markdown = await resp.text()
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
      setShowTip(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="relative inline-flex shrink-0">
      {/* 主复制按钮 */}
      <button
        onClick={handleCopy}
        className={
          'inline-flex h-9 items-center gap-1.5 rounded-l-lg border-y border-l px-3 text-xs font-medium shadow-sm transition-colors ' +
          (copied
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400'
            : error
              ? 'border-border bg-card text-destructive'
              : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary')
        }
        aria-label="复制为 Markdown"
        data-document-slug={slug}
      >
        {copied ? (
          <><Check className="h-3.5 w-3.5" />已复制 Markdown</>
        ) : error ? (
          <><Copy className="h-3.5 w-3.5" />复制失败</>
        ) : (
          <><Copy className="h-3.5 w-3.5" />复制页面</>
        )}
      </button>

      {/* 说明按钮（点击展开格式说明） */}
      <button
        onClick={() => setShowTip((v) => !v)}
        className="inline-flex h-9 items-center rounded-r-lg border border-border bg-card px-1.5 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        aria-label="查看复制格式说明"
        title="查看格式说明"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showTip ? 'rotate-180' : ''}`} />
      </button>

      {/* 格式说明浮窗 */}
      {showTip && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-background p-3 shadow-lg shadow-slate-950/10">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            复制内容格式
          </p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-[12px]">
              <span className="mt-0.5 rounded bg-brand-soft px-1 py-0.5 font-mono text-[10px] font-semibold text-brand">MD</span>
              <div>
                <p className="font-medium text-foreground">Markdown 格式</p>
                <p className="text-muted-foreground">保留标题/代码块/表格，适合直接喂给 AI 或 Claude</p>
              </div>
            </div>
            <div className="flex items-start gap-2 px-2.5 py-1 text-[11px] text-muted-foreground">
              <span className="mt-0.5">💡</span>
              <span>也可访问 <code className="text-xs">{location?.pathname ?? ''}.md</code> 直接获取原始 Markdown</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
