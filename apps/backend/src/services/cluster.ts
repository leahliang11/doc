// cluster.ts — 文档缺口聚类
// 定时扫 ask_sessions.result_none=1，把语义相近的 query 合并为一个缺口候选
// W16 策略：TF-IDF 余弦相似度（不依赖外部 embedding，自洽）
// 升级路径：Joybuilder 若有 embedding 接口，换成向量相似度
import crypto from 'crypto'
import { db, upsertDocGap } from './db.js'

// ── TF-IDF 工具 ─────────────────────────────────────────────

/** 中文/英文分词（简单分字+分词，无需额外依赖） */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^一-龥a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

/** TF 向量 */
function tfVector(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of tokens) map.set(t, (map.get(t) ?? 0) + 1)
  return map
}

/** 余弦相似度（0-1） */
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (const [k, va] of a) {
    const vb = b.get(k) ?? 0
    dot += va * vb
    normA += va * va
  }
  for (const [, vb] of b) normB += vb * vb
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// 相似度阈值
const SIMILARITY_THRESHOLD = 0.4  // TF-IDF 粒度粗，阈值比 embedding 低

// ── 聚类主逻辑 ───────────────────────────────────────────────

interface QueryEntry {
  query: string
  tokens: string[]
  tf: Map<string, number>
}

interface Cluster {
  representative: string
  hash: string
  members: string[]
}

function clusterQueries(queries: string[]): Cluster[] {
  const entries: QueryEntry[] = queries.map((q) => {
    const tokens = tokenize(q)
    return { query: q, tokens, tf: tfVector(tokens) }
  })

  const clusters: Cluster[] = []
  const assigned = new Set<number>()

  for (let i = 0; i < entries.length; i++) {
    if (assigned.has(i)) continue
    // 新簇：以 entries[i] 为代表
    const members: string[] = [entries[i].query]
    assigned.add(i)
    for (let j = i + 1; j < entries.length; j++) {
      if (assigned.has(j)) continue
      const sim = cosine(entries[i].tf, entries[j].tf)
      if (sim >= SIMILARITY_THRESHOLD) {
        members.push(entries[j].query)
        assigned.add(j)
      }
    }
    // 簇 hash：代表 query 的 sha256 前 16 位
    const hash = crypto.createHash('sha256').update(entries[i].query).digest('hex').slice(0, 16)
    clusters.push({ representative: entries[i].query, hash, members })
  }
  return clusters
}

// ── 定时任务入口 ─────────────────────────────────────────────

export async function runClusterJob(): Promise<{ processed: number; newGaps: number }> {
  // 取近 14 天 result_none 的 query（去重后最多 200 条避免过慢）
  const rows = db.prepare(
    `SELECT DISTINCT query FROM ask_sessions
     WHERE result_none = 1
       AND created_at >= datetime('now', '-14 days')
     LIMIT 200`
  ).all() as { query: string }[]

  if (rows.length === 0) return { processed: 0, newGaps: 0 }

  const queries = rows.map((r) => r.query)
  const clusters = clusterQueries(queries)

  let newGaps = 0
  for (const cluster of clusters) {
    // 写入 / 更新 doc_gaps（每个 cluster 成员各记一次，upsert 靠 hash 去重+计数）
    for (const _ of cluster.members) {
      upsertDocGap({ clusterHash: cluster.hash, representativeQuery: cluster.representative })
    }
    newGaps++
  }

  return { processed: queries.length, newGaps }
}

// ── 启动定时轮询 ─────────────────────────────────────────────

const INTERVAL_MS = 6 * 60 * 60 * 1000  // 6 小时

export function startClusterScheduler(log: (msg: string) => void = console.log): void {
  const run = async () => {
    try {
      const result = await runClusterJob()
      if (result.processed > 0) {
        log(`[cluster] processed ${result.processed} queries → ${result.newGaps} clusters`)
      }
    } catch (e: any) {
      log(`[cluster] error: ${e.message}`)
    }
  }

  // 启动时跑一次（5s 后，等 DB 初始化完）
  setTimeout(run, 5000)
  setInterval(run, INTERVAL_MS)
}
