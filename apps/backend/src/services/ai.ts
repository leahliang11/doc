// AI 服务抽象层
// 当前 mock 实现（setTimeout 模拟延迟 + 规则化响应）
// 后接真模型：只改本文件的实现，接口不变
//
// 4 能力：rewrite(改写) / complete(续写) / generate(生成) / audit(体检)

export type RewriteMode = 'simplify' | 'expand' | 'fix' | 'tone'

export interface AuditIssue {
  category: string // 技术准确性 / 链接 / 标点 / 口语化
  message: string
  search?: string // 用于在编辑器定位的文本片段
}

// 模拟网络延迟
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 选中改写：精简/扩写/纠错/改语气 */
export async function rewrite(text: string, mode: RewriteMode): Promise<string> {
  await delay(600)
  switch (mode) {
    case 'simplify': {
      // 精简：去掉冗词，保留主干
      const trimmed = text
        .replace(/(?:的来说|的话|什么的|之类的|之类的东西)/g, '')
        .replace(/(?:我们|大家)(?:可以|能够|需要|要)/g, '可以')
        .replace(/(?:如果|假如)说?/g, '若')
        .replace(/(?:然后|接着|接下来)(?:的话|就)?/g, '然后')
        .replace(/(?:非常|十分|特别|极其|相当)(?:重要|关键|核心|必要)/g, '重要')
        .replace(/通过(?:……|…|的?方式(?:方法)?|的办法)/g, '通过')
        .replace(/\s+/g, ' ')
        .trim()
      return trimmed || text
    }
    case 'expand': {
      // 扩写：在原文末尾补充说明句
      const lastChar = text.trim().slice(-1)
      const tail = lastChar === '。' || lastChar === '.' ? '' : '。'
      return `${text}${tail}具体而言，这一步骤保证了后续流程的数据一致性，建议在变更后回读校验。`
    }
    case 'fix': {
      // 纠错：修正常见标点/全半角/中英混用
      return text
        .replace(/[,，]$/gm, '。')
        .replace(/\s+([，。、；])/g, '$1')
        .replace(/["""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/\.\.\./g, '……')
        .replace(/(?<=[一-龥])\s+(?=[一-龥])/g, '')
        .trim()
    }
    case 'tone': {
      // 改语气：口语→书面
      return text
        .replace(/(?:这个|那个)(?:东西|玩意|事|事儿)/g, '此项')
        .replace(/(?:弄|搞|整)(?:一下|一下|出来|完)/g, '完成')
        .replace(/(?:没问题|OK|ok)\s*[，。]/g, '')
        .replace(/(?:可能|大概|也许)(?:要|会)/g, '可能')
        .replace(/(?:赶紧|赶快|尽快)/g, '尽快')
        .trim()
    }
    default:
      return text
  }
}

/** 续写补全：根据前文上下文生成后续文本 */
export async function complete(context: string): Promise<string> {
  await delay(800)
  // mock：根据上下文末尾的关键词给固定续写
  const ctx = context.toLowerCase()
  if (ctx.includes('参数') || ctx.includes('param')) {
    return '\n\n> [!NOTE]\n> 以下参数均为必填，省略时返回 400。'
  }
  if (ctx.includes('错误') || ctx.includes('error') || ctx.includes('401')) {
    return '\n\n常见的 401 原因：API Key 失效或未传。检查 `Authorization` 头后重试。'
  }
  if (ctx.includes('步骤') || ctx.includes('step') || ctx.includes('1.')) {
    return '\n\n2. 携带 API Key 调用 `/v1/chat/completions`。\n3. 校验返回的 `usage.total_tokens`。'
  }
  if (ctx.includes('示例') || ctx.includes('example')) {
    return '\n\n```bash\ncurl -X POST https://api.example.com/v1/chat/completions \\\n  -H "Authorization: Bearer $API_KEY"\n```'
  }
  // 默认续写：补充一句承接
  return '\n\n需要注意的是，以上内容基于当前版本，后续升级请以最新发布为准。'
}

/** 从描述生成：输入描述生成整段/大纲 */
export async function generate(prompt: string): Promise<string> {
  await delay(1000)
  const p = prompt.trim()
  // mock：根据描述关键词套模板
  if (p.includes('排障') || p.includes('错误') || p.includes('401') || p.includes('403')) {
    return `## 鉴权失败排障\n\n当接口返回 \`401 Unauthorized\` 或 \`403 Forbidden\` 时，按以下顺序排查：\n\n1. **核对 API Key**：确认 Key 未过期、未禁用、且对应环境（测试/生产）。\n2. **检查请求头**：\`Authorization: Bearer <KEY>\` 格式正确，无多余空格。\n3. **权限范围**：该 Key 是否具备目标接口的调用权限。\n4. **限频命中**：短时间内高频调用可能触发风控，等待 60 秒后重试。\n\n> [!WARNING]\n> 切勿在客户端代码硬编码生产环境 Key，应通过服务端中转。`
  }
  if (p.includes('参数') || p.includes('字段') || p.includes('入参')) {
    return `### 请求参数\n\n<Params params={[\n  { name: 'model', type: 'string', required: true, default: '-', description: '模型标识，如 glm-4' },\n  { name: 'messages', type: 'array', required: true, default: '-', description: '对话消息数组' },\n  { name: 'temperature', type: 'number', required: false, default: '0.7', description: '采样温度 0-2' }\n]} />\n\n所有参数以 JSON 格式置于请求体，Content-Type 为 \`application/json\`。`
  }
  if (p.includes('快速开始') || p.includes('快速入门') || p.includes('quickstart')) {
    return `## 快速开始\n\n5 分钟完成第一次调用。\n\n<Steps>\n\n1. 获取 API Key：在控制台「密钥管理」创建。\n2. 安装 SDK：\`npm i @joymaas/sdk\`。\n3. 发起调用：\n\n\`\`\`bash\ncurl https://api.example.com/v1/chat/completions \\\n  -H "Authorization: Bearer $API_KEY"\n\`\`\`\n\n</Steps>\n\n<Callout type="info" title="下一步">\n\n调用成功后，参考完整 API 文档接入更多能力。\n\n</Callout>`
  }
  // 默认：把描述转成一段说明
  return `## ${p.slice(0, 40)}\n\n${p}。本节内容将围绕此主题展开，覆盖关键概念、操作步骤与注意事项。\n\n> [!NOTE]\n> 具体参数与示例见下文。`
}

/** 文档体检：检查技术准确性/链接/标点/口语化 */
export async function audit(doc: string): Promise<AuditIssue[]> {
  await delay(1000)
  const issues: AuditIssue[] = []

  // 口语化
  const colloquialisms = [
    { word: '搞定', msg: '口语化表达「搞定」，建议改为「完成」' },
    { word: '搞一下', msg: '口语化表达「搞一下」，建议改为「处理」' },
    { word: '啥', msg: '口语化「啥」，建议改为「什么」' },
    { word: '整一下', msg: '口语化「整一下」，建议改为「完成」' },
    { word: 'OK', msg: '出现「OK」，正式文档建议改为「可以」或删除' },
    { word: '啥的', msg: '口语化「啥的」，建议删除或改写' },
  ]
  for (const c of colloquialisms) {
    if (doc.includes(c.word)) issues.push({ category: '口语化', message: c.msg, search: c.word })
  }

  // 标点
  if (/[,，][\s]*\n/.test(doc)) {
    issues.push({ category: '标点', message: '行尾逗号建议改为句号', search: doc.match(/[,，][\s]*\n/)?.[0] })
  }
  if (/[a-zA-Z]+[，。、]/.test(doc)) {
    issues.push({ category: '标点', message: '英文单词后混用中文标点' })
  }
  if (/\.\.\.(?!\.)/.test(doc)) {
    issues.push({ category: '标点', message: '英文省略号「...」建议改为中文「……」' })
  }

  // 链接
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(doc)) !== null) {
    const href = m[2]
    if (!href.startsWith('http') && !href.startsWith('/') && !href.startsWith('#')) {
      issues.push({ category: '链接', message: `链接「${m[1]}」的 href 非标准：${href}`, search: m[0] })
    }
    if (href.includes('example.com') || href.includes('TODO')) {
      issues.push({ category: '链接', message: `链接「${m[1]}」疑似占位：${href}`, search: m[0] })
    }
  }

  // 技术准确性
  const techHints = [
    { word: 'localhost:3000', msg: '出现 localhost:3000，正式文档应使用生产域名' },
    { word: 'TODO', msg: '文档中存在 TODO 占位符，发布前需补全' },
    { word: 'FIXME', msg: '文档中存在 FIXME，发布前需处理' },
    { word: 'xxx', msg: '文档中存在「xxx」占位，需替换为真实值' },
    { word: '即将支持', msg: '「即将支持」属于未定承诺，建议改为具体版本或删除' },
  ]
  for (const t of techHints) {
    if (doc.includes(t.word)) issues.push({ category: '技术准确性', message: t.msg, search: t.word })
  }

  // 空标题/重复标题
  const headings = [...doc.matchAll(/^#+\s+(.+)$/gm)].map((h) => h[1])
  const seen = new Set<string>()
  for (const h of headings) {
    if (seen.has(h)) {
      issues.push({ category: '技术准确性', message: `重复标题：${h}`, search: h })
    }
    seen.add(h)
  }

  // 无问题
  if (issues.length === 0) {
    issues.push({ category: '通过', message: '未检测到明显问题，可提交审核' })
  }

  return issues
}
