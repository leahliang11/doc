import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Param {
  name: string
  type: string
  required: boolean
  default?: string
  description: string
}

interface ParamsProps {
  params: Param[]
}

function Params({ params }: ParamsProps) {
  return (
    <div className="params-table my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/70 hover:bg-muted/70">
              <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">参数</TableHead>
              <TableHead className="h-10 px-3 text-xs font-semibold text-muted-foreground">类型</TableHead>
              <TableHead className="h-10 px-3 text-xs font-semibold text-muted-foreground">要求</TableHead>
              <TableHead className="h-10 px-3 text-xs font-semibold text-muted-foreground">默认值</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">说明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {params.map((param) => (
              <TableRow key={param.name} className="border-border-soft hover:bg-primary/[0.025]">
                <TableCell className="px-4 py-3 font-mono text-[13px] font-semibold text-primary">{param.name}</TableCell>
                <TableCell className="px-3 py-3">
                  <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">{param.type}</span>
                </TableCell>
                <TableCell className="px-3 py-3">
                  {param.required ? (
                    <span className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">必填</span>
                  ) : (
                    <span className="text-[11px] text-subtle-foreground">可选</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-3 font-mono text-xs text-muted-foreground">
                  {param.default ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-3 text-[13px] leading-5 text-muted-foreground">{param.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y divide-border md:hidden">
        {params.map((param) => (
          <div key={param.name} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-[13px] font-semibold text-primary">{param.name}</code>
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{param.type}</span>
              {param.required && <span className="text-[10px] font-medium text-rose-600">必填</span>}
            </div>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{param.description}</p>
            {param.default && <p className="mt-2 text-xs text-subtle-foreground">默认值：<code>{param.default}</code></p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// Week 2：转为标准 Markdown 表格
export type { ParamsProps, Param }
type ParamsWithToMarkdown = typeof Params & {
  toMarkdown: (props: ParamsProps) => string
}
const ParamsExport = Object.assign(Params, {
  toMarkdown: (): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as ParamsWithToMarkdown

export { ParamsExport as Params }
