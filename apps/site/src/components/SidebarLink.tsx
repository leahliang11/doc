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
      className={`group relative flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
        isActive
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {isActive && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge && (
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide ${
            badge === 'GET'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
