'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useAudience } from '@/providers/audience-provider'

// 右上角切换：外部视角 <-> 内部视角
// external: Eye 图标（默认，公开可见）
// internal: EyeOff 图标（内部视角，看得到 InternalOnly 内容）
export function AudienceToggle() {
  const { audience, setAudience, ready } = useAudience()

  const next: 'external' | 'internal' = audience === 'internal' ? 'external' : 'internal'
  const label = audience === 'internal' ? '切到外部视角' : '切到内部视角'

  return (
    <button
      onClick={() => setAudience(next)}
      disabled={!ready}
      className={
        'grid h-9 w-9 place-items-center rounded-lg transition-colors ' +
        (audience === 'internal'
          ? 'bg-brand-soft text-brand hover:bg-brand-soft/80'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground')
      }
      aria-label={label}
      title={label}
    >
      {audience === 'internal' ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </button>
  )
}
