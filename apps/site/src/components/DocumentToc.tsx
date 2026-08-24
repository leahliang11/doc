'use client'

import { useEffect, useState } from 'react'

interface TocItem {
  id: string
  text: string
  level: number
}

function toId(value: string, index: number) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  return normalized || `section-${index + 1}`
}

export function DocumentToc() {
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>('.prose-doc h2, .prose-doc h3'),
    )
    const seen = new Map<string, number>()
    const nextItems = headings.map((heading, index) => {
      const base = heading.id || toId(heading.textContent ?? '', index)
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      const id = count ? `${base}-${count + 1}` : base
      heading.id = id
      return { id, text: heading.textContent ?? '', level: Number(heading.tagName.slice(1)) }
    })
    const frame = requestAnimationFrame(() => {
      setItems(nextItems)
      setActiveId(nextItems[0]?.id ?? '')
    })

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id)
      },
      { rootMargin: '-90px 0px -70% 0px' },
    )
    headings.forEach((heading) => observer.observe(heading))
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  if (items.length < 2) return null

  return (
    <aside className="doc-toc hidden xl:block" aria-label="本页内容">
      <div className="sticky top-24">
        <p className="mb-3 text-xs font-semibold text-foreground">本页内容</p>
        <nav className="space-y-0.5 border-l border-border">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`block border-l px-3 py-1.5 text-xs leading-5 transition-colors ${
                item.level === 3 ? 'pl-6' : ''
              } ${
                activeId === item.id
                  ? '-ml-px border-brand font-medium text-brand'
                  : '-ml-px border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}
