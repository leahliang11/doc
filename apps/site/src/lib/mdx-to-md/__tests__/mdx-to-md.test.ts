import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mdxToMarkdown } from '../index.ts'
import {
  calloutToMarkdown,
  stepsToMarkdown,
  codeTabsToMarkdown,
  paramsToMarkdown,
  internalOnlyToMarkdown,
  nextStepsToMarkdown,
} from '../converters.ts'

// ── Callout ──
describe('Callout', () => {
  it('info + title → [!NOTE]', () => {
    const md = calloutToMarkdown({ variant: 'info', title: '提示' }, '内容')
    assert.ok(md.includes('> [!NOTE] 提示'))
    assert.ok(md.includes('> 内容'))
  })

  it('danger 无 title → [!CAUTION]', () => {
    const md = calloutToMarkdown({ variant: 'danger' }, '危险内容')
    assert.ok(md.includes('> [!CAUTION]'))
    assert.ok(md.includes('> 危险内容'))
  })

  it('四种 variant 全覆盖', () => {
    assert.ok(calloutToMarkdown({ variant: 'info' }, 'x').includes('[!NOTE]'))
    assert.ok(calloutToMarkdown({ variant: 'warning' }, 'x').includes('[!WARNING]'))
    assert.ok(calloutToMarkdown({ variant: 'danger' }, 'x').includes('[!CAUTION]'))
    assert.ok(calloutToMarkdown({ variant: 'success' }, 'x').includes('[!TIP]'))
  })

  it('默认 variant = info', () => {
    const md = calloutToMarkdown({}, 'x')
    assert.ok(md.includes('[!NOTE]'))
  })

  it('多行正文每行加 > 前缀', () => {
    const md = calloutToMarkdown({ variant: 'info' }, '第一行\n第二行')
    assert.ok(md.includes('> 第一行'))
    assert.ok(md.includes('> 第二行'))
  })
})

// ── Steps ──
describe('Steps', () => {
  it('3 个子块转有序列表', () => {
    const md = stepsToMarkdown({}, '第一步\n\n第二步\n\n第三步')
    assert.ok(md.includes('1. 第一步'))
    assert.ok(md.includes('2. 第二步'))
    assert.ok(md.includes('3. 第三步'))
  })

  it('空 children 返回空串', () => {
    assert.equal(stepsToMarkdown({}, ''), '')
    assert.equal(stepsToMarkdown({}, '   \n  '), '')
  })

  it('多行块后续行缩进对齐', () => {
    const md = stepsToMarkdown({}, '标题\n详细说明')
    assert.ok(md.includes('1. 标题'))
    assert.ok(md.includes('   详细说明'))
  })

  it('MDX div 中标题和说明保持在同一个步骤', () => {
    const raw = `<Steps>
  <div>
    **创建 API Key**

    登录控制台创建并保存 Key。
  </div>
  <div>
    **发起请求**

    复制代码并运行。
  </div>
</Steps>`
    const md = mdxToMarkdown(raw, 'external')
    assert.ok(md.includes('1. **创建 API Key**'))
    assert.ok(md.includes('   登录控制台创建并保存 Key。'))
    assert.ok(md.includes('2. **发起请求**'))
    assert.ok(md.includes('   复制代码并运行。'))
    assert.ok(!md.includes('3.'))
  })
})

// ── CodeTabs ──
describe('CodeTabs', () => {
  it('3 个 tab 全部展开', () => {
    const md = codeTabsToMarkdown({
      tabs: [
        { label: 'cURL', code: 'curl http://x' },
        { label: 'Python', code: 'print(1)' },
        { label: 'Node', code: 'console.log(1)' },
      ],
    })
    assert.ok(md.includes('#### cURL'))
    assert.ok(md.includes('```bash'))
    assert.ok(md.includes('curl http://x'))
    assert.ok(md.includes('#### Python'))
    assert.ok(md.includes('```python'))
    assert.ok(md.includes('#### Node'))
    assert.ok(md.includes('```javascript'))
  })

  it('1 个 tab', () => {
    const md = codeTabsToMarkdown({ tabs: [{ label: 'Go', code: 'fmt.Println()' }] })
    assert.ok(md.includes('#### Go'))
    assert.ok(md.includes('```go'))
  })

  it('空 tabs 返回空串', () => {
    assert.equal(codeTabsToMarkdown({ tabs: [] }), '')
  })

  it('code 含换行和引号', () => {
    const md = codeTabsToMarkdown({
      tabs: [{ label: 'cURL', code: 'curl -X POST \\\n  -H "Auth: x"' }],
    })
    assert.ok(md.includes('curl -X POST'))
    assert.ok(md.includes('"Auth: x"'))
  })

  it('Java 标签推断', () => {
    const md = codeTabsToMarkdown({ tabs: [{ label: 'Java', code: 'System.out' }] })
    assert.ok(md.includes('```java'))
  })
})

// ── Params ──
describe('Params', () => {
  it('完整表格含表头分隔行', () => {
    const md = paramsToMarkdown({
      params: [
        { name: 'model', type: 'string', required: true, description: '模型 ID' },
        { name: 'stream', type: 'boolean', required: false, default: 'false', description: '流式' },
      ],
    })
    assert.ok(md.includes('| 参数名 | 类型 | 必填 | 默认值 | 说明 |'))
    assert.ok(md.includes('|---|---|---|---|---|'))
    assert.ok(md.includes('| model | string | 是 | - | 模型 ID |'))
    assert.ok(md.includes('| stream | boolean | 否 | false | 流式 |'))
  })

  it('无 default 字段显示 -', () => {
    const md = paramsToMarkdown({
      params: [{ name: 'x', type: 'string', required: true, description: 'd' }],
    })
    assert.ok(md.includes('| x | string | 是 | - | d |'))
  })

  it('空数组只有表头', () => {
    const md = paramsToMarkdown({ params: [] })
    assert.ok(md.includes('| 参数名 | 类型 | 必填 | 默认值 | 说明 |'))
    assert.ok(md.includes('|---|---|---|---|---|'))
    assert.equal(md.split('\n').length, 2)
  })

  it('说明含换行压成空格', () => {
    const md = paramsToMarkdown({
      params: [{ name: 'x', type: 'string', required: true, description: '第一行\n第二行' }],
    })
    assert.ok(md.includes('第一行 第二行'))
    assert.ok(!md.includes('第一行\n第二行'))
  })
})

// ── InternalOnly ──
describe('InternalOnly', () => {
  it('external 受众返回空串', () => {
    assert.equal(internalOnlyToMarkdown({}, '内部内容', 'external'), '')
  })

  it('internal 受众返回内容原文', () => {
    const md = internalOnlyToMarkdown({}, '内部内容', 'internal')
    assert.equal(md, '内部内容')
  })
})

// ── NextSteps ──
describe('NextSteps', () => {
  it('转链接列表', () => {
    const md = nextStepsToMarkdown({
      items: [
        { title: 'Chat API', description: '完整参数', href: '/docs/api' },
        { title: '错误码', description: '排障', href: '/docs/errors' },
      ],
    })
    assert.ok(md.includes('- [Chat API](/docs/api): 完整参数'))
    assert.ok(md.includes('- [错误码](/docs/errors): 排障'))
  })

  it('空 items 返回空串', () => {
    assert.equal(nextStepsToMarkdown({ items: [] }), '')
  })
})

// ── 端到端 mdxToMarkdown ──
describe('mdxToMarkdown 端到端', () => {
  it('普通 Markdown 原样保留', () => {
    const raw = '## 标题\n\n这是一段正文。\n\n- 列表项\n\n```\ncode\n```'
    const md = mdxToMarkdown(raw, 'external')
    assert.ok(md.includes('## 标题'))
    assert.ok(md.includes('这是一段正文'))
    assert.ok(md.includes('- 列表项'))
    assert.ok(md.includes('code'))
  })

  it('Callout 转 GFM alert', () => {
    const raw = '<Callout variant="warning" title="注意">\n流式处理。\n</Callout>'
    const md = mdxToMarkdown(raw, 'external')
    assert.ok(md.includes('> [!WARNING] 注意'))
    assert.ok(md.includes('> 流式处理'))
  })

  it('CodeTabs 全部展开（不藏 Tab）', () => {
    const raw = `<CodeTabs tabs={[
  { label: 'cURL', code: 'curl x' },
  { label: 'Python', code: 'print(1)' }
]} />`
    const md = mdxToMarkdown(raw, 'external')
    assert.ok(md.includes('#### cURL'))
    assert.ok(md.includes('#### Python'))
    assert.ok(md.includes('```bash'))
  })

  it('Params 转表格', () => {
    const raw = `<Params params={[
  { name: 'model', type: 'string', required: true, description: '模型' }
]} />`
    const md = mdxToMarkdown(raw, 'external')
    assert.ok(md.includes('| 参数名 | 类型 | 必填 | 默认值 | 说明 |'))
    assert.ok(md.includes('| model | string | 是 | - | 模型 |'))
  })

  it('InternalOnly external 过滤 / internal 保留', () => {
    const raw = '<InternalOnly>\n内部定价 0.0008。\n</InternalOnly>'
    const ext = mdxToMarkdown(raw, 'external')
    const int = mdxToMarkdown(raw, 'internal')
    assert.ok(!ext.includes('内部定价'))
    assert.ok(int.includes('内部定价'))
  })

  it('NextSteps 转链接列表', () => {
    const raw = `<NextSteps items={[
  { title: 'Chat API', description: '完整参数', href: '/docs/api' }
]} />`
    const md = mdxToMarkdown(raw, 'external')
    assert.ok(md.includes('- [Chat API](/docs/api): 完整参数'))
  })

  it('代码块内 <Callout> 文本不误解析', () => {
    const raw = '```\n<Callout>这是代码里的文本</Callout>\n```'
    const md = mdxToMarkdown(raw, 'external')
    // 代码块里的 <Callout> 应原样保留为文本，不转成 alert
    assert.ok(md.includes('<Callout>这是代码里的文本</Callout>'))
    assert.ok(!md.includes('[!NOTE]'))
  })

  it('Callout 内嵌 Steps', () => {
    const raw = '<Callout variant="info" title="步骤">\n<Steps><div>第一步</div><div>第二步</div></Steps>\n</Callout>'
    const md = mdxToMarkdown(raw, 'external')
    assert.ok(md.includes('[!NOTE] 步骤'))
  })
})
