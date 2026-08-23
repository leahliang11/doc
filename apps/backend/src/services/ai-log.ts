// AI 日志 + 延迟监控
// AI_LOG=true 时记录 prompt/response 到 data/ai-log.jsonl（调优用）
// metrics 始终记录到 data/ai-metrics.json（首次延迟/平均延迟/失败率/调用次数，按 capability 分桶）
import * as fs from 'fs'
import * as path from 'path'
import { AI_LOG, JOYBUILDER_MODEL } from '../config.js'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const LOG_PATH = path.join(DATA_DIR, 'ai-log.jsonl')
const METRICS_PATH = path.join(DATA_DIR, 'ai-metrics.json')

export interface AiCallRecord {
  capability: string // rewrite / complete / generate / audit
  model: string
  prompt: string
  response: string
  latencyMs: number
  ok: boolean
}

/** 记录一次 AI 调用（仅 AI_LOG=true 时写 jsonl） */
export function logAiCall(rec: AiCallRecord): void {
  if (!AI_LOG) return
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const line = JSON.stringify(rec) + '\n'
    fs.appendFileSync(LOG_PATH, line)
  } catch {
    // 日志失败不影响主流程
  }
}

interface CapabilityMetric {
  count: number
  okCount: number
  failCount: number
  firstLatencyMs: number
  totalLatencyMs: number
}
type MetricsFile = Record<string, CapabilityMetric>

function readMetrics(): MetricsFile {
  try {
    if (!fs.existsSync(METRICS_PATH)) return {}
    return JSON.parse(fs.readFileSync(METRICS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeMetrics(m: MetricsFile): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(METRICS_PATH, JSON.stringify(m, null, 2))
  } catch {
    // metrics 写失败不影响主流程
  }
}

/** 更新 metrics（首次/平均/失败率/调用次数） */
export function recordMetric(
  capability: string,
  latencyMs: number,
  ok: boolean,
): void {
  const m = readMetrics()
  const cur = m[capability] ?? {
    count: 0,
    okCount: 0,
    failCount: 0,
    firstLatencyMs: latencyMs,
    totalLatencyMs: 0,
  }
  cur.count += 1
  if (ok) cur.okCount += 1
  else cur.failCount += 1
  cur.totalLatencyMs += latencyMs
  m[capability] = cur
  writeMetrics(m)
}

/** 读 metrics 给 API 用 */
export function getMetrics(): Record<string, CapabilityMetric & { avgLatencyMs: number; failRate: number }> {
  const m = readMetrics()
  const out: Record<string, CapabilityMetric & { avgLatencyMs: number; failRate: number }> = {}
  for (const [k, v] of Object.entries(m)) {
    out[k] = {
      ...v,
      avgLatencyMs: v.count > 0 ? Math.round(v.totalLatencyMs / v.count) : 0,
      failRate: v.count > 0 ? +(v.failCount / v.count).toFixed(3) : 0,
    }
  }
  return out
}

export { JOYBUILDER_MODEL }
