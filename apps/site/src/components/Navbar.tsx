import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-normal text-foreground">JoyMaaS</span>
          <span className="text-sm text-muted-foreground">文档</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/docs/quickstart" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            快速开始
          </Link>
          <Link href="/docs/api/chat-completions" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            API
          </Link>
          <Link href="/docs/troubleshooting/errors" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            排障
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
