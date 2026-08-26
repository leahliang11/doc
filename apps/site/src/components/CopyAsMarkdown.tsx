'use client'

import { useState, useRef, useEffect } from 'react'
import { Copy, Check, ChevronDown, FileText, FileCode } from 'lucide-react'

// 复制本文档的内容（供用户复制页面 / 供 Agent 消费）
// 两种格式：
//   1. Markdown（.md 版本，喂 AI 用）
//   2. 页面文本（当前渲染出的纯文本，人复制用）
interface CopyAsMarkdownProps {
  slug: string
}

export function CopyAsMarkdown({ slug }: CopyAsMarkdownProps) {
  const [copied, setCopied] = useState<'md' | 'text' | null>(null)
  const [error, setError] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 点击组件外部关菜单
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    window.addEventListener('mousedown', onDocClick)
    return () => window.removeEventListener('mousedown', onDocClick)
  }, [])

  async function writeClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    }
  }

  const handleCopyMd = async () => {
    setShowMenu(false)
    try {
      const url = `${location.pathname}.md`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('fetch failed')
      const text = await resp.text()
      const ok = await writeClipboard(text)
      if (!ok) throw new Error('clipboard failed')
      setCopied('md')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  const handleCopyText = async () => {
    setShowMenu(false)
    try {
      // 从当前 DOM 抓页面文档正文
      const article = document.querySelector('article.doc-document, article.api-document')
      const text = (article?.textContent ?? document.body.textContent ?? '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      const ok = await writeClipboard(text)
      if (!ok) throw new Error('clipboard failed')
      setCopied('text')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  const label = copied === 'md'
    ? '已复制 Markdown'
    : copied === 'text'
      ? '已复制页面文字'
      : error
        ? '复制失败'
        : '复制页面'

  return (
    <div ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        onClick={handleCopyMd}
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
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {label}
      </button>
      <button
        onClick={() => setShowMenu((v) => !v)}
        className={
          'inline-flex h-9 items-center rounded-r-lg border px-1.5 shadow-sm transition-colors ' +
          (showMenu
            ? 'border-primary/40 bg-primary/5 text-primary'
            : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary')
        }
        aria-label="更多复制选项"
        title="更多复制选项"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border bg-background p-1.5 shadow-lg shadow-slate-950/10">
          <button
            onClick={handleCopyMd}
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
          >
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
              <FileCode className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">复制为 Markdown</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                保留标题/代码块/表格结构。适合喂给 AI、Claude、Cursor
              </span>
            </span>
          </button>
          <button
            onClick={handleCopyText}
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
          >
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">复制页面文字</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                纯文本，粘贴到聊天/邮件/文档里
              </span>
            </span>
          </button>
          <div className="mx-2 my-1 border-t border-border" />
          <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground/70">
            也可访问 <code className="rounded bg-muted px-1 py-0.5 text-[10.5px]">{`${slug}.md`}</code> 直接获取原始 Markdown
          </p>
        </div>
      )}
    </div>
  )
}
