'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

interface SidebarLinkProps {
  href: string
  children: ReactNode
  badge?: string
}

export function SidebarLink({ href, children, badge }: SidebarLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.endsWith(href)

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors ${
        isActive
          ? 'bg-brand-soft font-medium text-brand'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {isActive && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge && (
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide ${
            badge === 'GET'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-brand-soft text-brand'
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
