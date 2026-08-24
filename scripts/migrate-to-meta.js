#!/usr/bin/env node
/**
 * 迁移脚本：扫描 content-repo/content/ 下所有 mdx 的 category/slug，
 * 按 categoryLabels 映射生成初版 _meta.yaml。
 *
 * 用法：node scripts/migrate-to-meta.js [--dry-run]
 *
 * 注意：本脚本生成的是"初版"层级结构。category 是扁平的，无法恢复
 * 真实的 section/group 归组，所以按默认映射生成后再人工调整。
 */
const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.resolve(__dirname, '../content-repo/content')
const OUT_PATH = path.join(CONTENT_DIR, '_meta.yaml')
const dryRun = process.argv.includes('--dry-run')

// category 中文标签（和前台 Sidebar 的 categoryLabels 保持一致的种子）
const CATEGORY_LABELS = {
  quickstart: '开始使用',
  api: 'API 参考',
  models: '模型能力',
  guides: '构建与实践',
  troubleshooting: '排障',
}

const ICONS = {
  quickstart: 'rocket',
  api: 'code',
  models: 'box',
  guides: 'book',
  troubleshooting: 'wrench',
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!m) return {}
  const fields = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i <= 0) continue
    fields[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return fields
}

function walk(dir) {
  const out = [dir]
  for (const entry of fs.readdirSync(dir)) {
    const abs = path.join(dir, entry)
    const st = fs.statSync(abs)
    if (st.isDirectory()) out.push(...walk(abs))
  }
  return out
}

function collectDocs() {
  const docs = []
  for (const dir of walk(CONTENT_DIR)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.mdx')) continue
      const abs = path.join(dir, file)
      if (abs.endsWith('_meta.yaml')) continue
      const raw = fs.readFileSync(abs, 'utf-8')
      const fm = parseFrontmatter(raw)
      const rel = path.relative(CONTENT_DIR, abs).replace(/\.mdx$/, '')
      docs.push({ slug: rel, category: fm.category || 'uncataloged' })
    }
  }
  return docs
}

function buildMeta(docs) {
  const grouped = {}
  for (const d of docs) {
    if (!grouped[d.category]) grouped[d.category] = []
    grouped[d.category].push(d.slug)
  }
  const sections = Object.entries(grouped).map(([cat, pages], idx) => ({
    id: cat,
    label: CATEGORY_LABELS[cat] || cat,
    icon: ICONS[cat] || 'file',
    order: idx + 1,
    groups: [
      {
        id: cat,
        label: CATEGORY_LABELS[cat] || cat,
        order: 1,
        pages,
      },
    ],
  }))
  return { sections }
}

function yamlify(meta) {
  const L = []
  L.push('# 文档层级权威源：section → group → page 三层结构')
  L.push('# 由 scripts/migrate-to-meta.js 生成。修改本文件走 Git 流程。')
  L.push('sections:')
  for (const s of meta.sections) {
    L.push(`  - id: ${s.id}`)
    L.push(`    label: ${s.label}`)
    L.push(`    icon: ${s.icon}`)
    L.push(`    order: ${s.order}`)
    L.push(`    groups:`)
    for (const g of s.groups) {
      L.push(`      - id: ${g.id}`)
      L.push(`        label: ${g.label}`)
      L.push(`        order: ${g.order}`)
      L.push(`        pages:`)
      for (const p of g.pages) L.push(`          - ${p}`)
    }
  }
  return L.join('\n') + '\n'
}

const docs = collectDocs()
const meta = buildMeta(docs)
const yaml = yamlify(meta)

if (dryRun) {
  console.log(yaml)
  console.log(`\ndocs=${docs.length} (${Object.keys(meta.sections).length} sections)`)
} else {
  fs.mkdirSync(CONTENT_DIR, { recursive: true })
  fs.writeFileSync(OUT_PATH, yaml)
  console.log(`written=${OUT_PATH} docs=${docs.length}`)
}