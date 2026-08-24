'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

interface EndpointBarProps {
  method: string
  path: string
}

export function EndpointBar({ method, path }: EndpointBarProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(`${method} ${path}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="endpoint-bar">
      <span className={`endpoint-method endpoint-method-${method.toLowerCase()}`}>{method}</span>
      <code>{path}</code>
      <button type="button" onClick={copy} aria-label="复制接口地址">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
    </div>
  )
}
