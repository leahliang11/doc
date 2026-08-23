import { Sidebar } from '@/components/Sidebar'

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 gap-8 px-6 py-8">
      <aside className="w-64 flex-shrink-0">
        <Sidebar />
      </aside>
      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  )
}
