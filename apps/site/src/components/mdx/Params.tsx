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
    <div className="my-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-normal text-foreground">参数名</TableHead>
            <TableHead className="font-normal text-foreground">类型</TableHead>
            <TableHead className="font-normal text-foreground">必填</TableHead>
            <TableHead className="font-normal text-foreground">默认值</TableHead>
            <TableHead className="font-normal text-foreground">说明</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {params.map((param) => (
            <TableRow key={param.name}>
              <TableCell className="font-mono text-sm text-primary">{param.name}</TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">{param.type}</TableCell>
              <TableCell>
                {param.required ? (
                  <span className="text-destructive text-xs">是</span>
                ) : (
                  <span className="text-muted-foreground text-xs">否</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {param.default ?? '-'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{param.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Week 2：转为标准 Markdown 表格
export type { ParamsProps, Param }
type ParamsWithToMarkdown = typeof Params & {
  toMarkdown: (props: ParamsProps) => string
}
const ParamsExport = Object.assign(Params, {
  toMarkdown: (_props: ParamsProps): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as ParamsWithToMarkdown

export { ParamsExport as Params }
