'use client'

import Link from 'next/link'
import { Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

interface SearchItem {
  title: string
  description: string
  url: string
  category: string
}

interface DocSearchProps {
  items: SearchItem[]
}

const categoryLabels: Record<string, string> = {
  quickstart: '开始使用',
  api: 'API 参考',
  models: '模型能力',
  guides: '构建指南',
  troubleshooting: '排障',
}

export function DocSearch({ items }: DocSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return items.slice(0, 7)
    return items
      .filter((item) =>
        `${item.title} ${item.description} ${categoryLabels[item.category] ?? item.category}`
          .toLowerCase()
          .includes(keyword),
      )
      .slice(0, 10)
  }, [items, query])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mx-auto flex h-10 w-full max-w-[460px] items-center gap-2 rounded-lg border border-border bg-muted/70 px-3 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-background hover:text-foreground"
        aria-label="搜索文档"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">搜索文档，或直接提问</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-subtle-foreground sm:inline-flex">
          ⌘ K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/30 px-4 pt-[12vh] backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="关闭搜索"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-5 w-5 text-primary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入页面、API 或问题"
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-subtle-foreground"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto p-2">
              {!query && (
                <div className="mb-1 flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  常用入口
                </div>
              )}
              {results.length ? (
                results.map((item) => (
                  <Link
                    key={item.url}
                    href={item.url}
                    onClick={() => setOpen(false)}
                    className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-primary/5"
                  >
                    <span className="mt-0.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                      {categoryLabels[item.category] ?? item.category}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground group-hover:text-primary">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  没有找到匹配文档
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
