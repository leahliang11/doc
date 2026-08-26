import { Sidebar } from '@/components/Sidebar'
import { AskWidgetWrapper } from '@/components/AskWidgetWrapper'

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border/80 bg-background px-4 py-7 lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          <Sidebar />
        </div>
      </aside>
      <main className="min-w-0 bg-canvas">
        {children}
      </main>
      {/* Ask JoyMaaS 浮球（全站 docs 布局内） */}
      <AskWidgetWrapper />
    </div>
  )
}
