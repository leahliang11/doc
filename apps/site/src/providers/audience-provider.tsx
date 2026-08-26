'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// 内外双视角：external（默认，公开访客）| internal（内部员工）
// 用途：切换后前台的 <InternalOnly> 块显隐
// 存 localStorage，SSR 首次总是 external（避免 hydration mismatch），客户端 hydrate 后按存储值恢复
export type Audience = 'external' | 'internal'

const STORAGE_KEY = 'joymaas-docs-audience'

interface AudienceContextValue {
  audience: Audience
  setAudience: (a: Audience) => void
  /** 是否已从 localStorage 完成读取（避免 SSR/hydration 时用错值） */
  ready: boolean
}

const AudienceContext = createContext<AudienceContextValue>({
  audience: 'external',
  setAudience: () => {},
  ready: false,
})

export function AudienceProvider({ children }: { children: ReactNode }) {
  const [audience, setAudienceState] = useState<Audience>('external')
  const [ready, setReady] = useState(false)

  // 客户端 mount 后读 localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'internal' || stored === 'external') {
        setAudienceState(stored)
      }
    } catch {
      // localStorage 被禁 → 忽略
    }
    setReady(true)
  }, [])

  const setAudience = (a: Audience) => {
    setAudienceState(a)
    try {
      localStorage.setItem(STORAGE_KEY, a)
    } catch {
      // 忽略
    }
  }

  return (
    <AudienceContext.Provider value={{ audience, setAudience, ready }}>
      {children}
    </AudienceContext.Provider>
  )
}

export function useAudience() {
  return useContext(AudienceContext)
}
