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
    <div className="params-table my-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/70 hover:bg-muted/70">
              <TableHead className="h-8 px-3 text-[11px] font-semibold text-muted-foreground">参数</TableHead>
              <TableHead className="h-8 px-2.5 text-[11px] font-semibold text-muted-foreground">类型</TableHead>
              <TableHead className="h-8 px-2.5 text-[11px] font-semibold text-muted-foreground">默认值</TableHead>
              <TableHead className="h-8 px-3 text-[11px] font-semibold text-muted-foreground">说明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {params.map((param) => (
              <TableRow key={param.name} className="border-border-soft hover:bg-primary/[0.025]">
                <TableCell className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <code className="border-0 bg-transparent p-0 font-mono text-[12px] font-semibold text-primary">{param.name}</code>
                    {param.required && <span className="text-[9px] font-medium text-rose-600 dark:text-rose-400">必填</span>}
                  </div>
                </TableCell>
                <TableCell className="px-2.5 py-2.5 font-mono text-[11px] text-muted-foreground">
                  {param.type}
                </TableCell>
                <TableCell className="px-2.5 py-2.5 font-mono text-[11px] text-subtle-foreground">
                  {param.default ?? '-'}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-[12px] leading-[18px] text-muted-foreground">{param.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y divide-border md:hidden">
        {params.map((param) => (
          <div key={param.name} className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-[12px] font-semibold text-primary">{param.name}</code>
              <span className="font-mono text-[10px] text-muted-foreground">{param.type}</span>
              {param.required && <span className="text-[10px] font-medium text-rose-600">必填</span>}
            </div>
            <p className="mt-1.5 text-[12px] leading-[18px] text-muted-foreground">{param.description}</p>
            {param.default && <p className="mt-1.5 text-[11px] text-subtle-foreground">默认值：<code>{param.default}</code></p>}
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
