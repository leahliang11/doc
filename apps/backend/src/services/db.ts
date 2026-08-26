// SQLite 封装：review_tasks / edit_sessions 表（规划 §5.2）
// 用 Node 22 内置的 node:sqlite（零原生依赖，绕开 better-sqlite3 在 CentOS 8 的 glibc/node-gyp 编译问题）
import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'
import { DB_PATH } from '../config.js'

// 确保 data 目录存在
const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS review_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,           -- 'web' | 'gitlab_mr'
    slug TEXT NOT NULL,
    branch TEXT NOT NULL,
    mr_iid INTEGER,                 -- 仅 gitlab_mr / web 提交后建了 MR 的
    submitter TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'merged'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    reviewer TEXT,
    comment TEXT
  );

  CREATE TABLE IF NOT EXISTS edit_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    user TEXT NOT NULL,
    base_commit TEXT NOT NULL,
    opened_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS build_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,           -- 'push' | 'manual'
    ref TEXT,                       -- push 的 ref（refs/heads/main）
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'building' | 'done' | 'failed'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    built_at TEXT,
    log TEXT
  );

  -- Ask JoyMaaS 会话（W13 新增）
  CREATE TABLE IF NOT EXISTS ask_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    query TEXT NOT NULL,
    answer TEXT,
    result_none INTEGER DEFAULT 0,     -- 1 = AI 答"文档里没有找到"
    useful INTEGER,                    -- NULL / 1(👍) / 0(👎)
    audience TEXT NOT NULL DEFAULT 'external',
    page_slug TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ── ask_sessions ──
export function createAskSession(data: {
  sessionId: string
  query: string
  audience: string
  pageSlug?: string
}): number {
  const r = db.prepare(
    `INSERT INTO ask_sessions (session_id, query, audience, page_slug) VALUES (?, ?, ?, ?)`,
  ).run(data.sessionId, data.query, data.audience, data.pageSlug ?? null)
  return Number(r.lastInsertRowid)
}

export function updateAskSession(id: number, answer: string, resultNone: boolean): void {
  db.prepare(
    `UPDATE ask_sessions SET answer = ?, result_none = ? WHERE id = ?`,
  ).run(answer, resultNone ? 1 : 0, id)
}

export function setAskUseful(sessionId: string, useful: boolean): void {
  db.prepare(
    `UPDATE ask_sessions SET useful = ? WHERE session_id = ? ORDER BY id DESC LIMIT 1`,
  ).run(useful ? 1 : 0, sessionId)
}

// ── edit_sessions ──
export function recordEditSession(slug: string, user: string, baseCommit: string): void {
  db.prepare(
    'INSERT INTO edit_sessions (slug, user, base_commit) VALUES (?, ?, ?)',
  ).run(slug, user, baseCommit)
}

// ── review_tasks ──
export function createReviewTask(task: {
  source: 'web' | 'gitlab_mr'
  slug: string
  branch: string
  mrIid: number
  submitter: string
}): number {
  const result = db.prepare(
    `INSERT INTO review_tasks (source, slug, branch, mr_iid, submitter, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
  ).run(task.source, task.slug, task.branch, task.mrIid, task.submitter)
  return Number(result.lastInsertRowid)
}

export function listReviewTasks(status?: string): any[] {
  if (status && status !== 'all') {
    return db.prepare('SELECT * FROM review_tasks WHERE status = ? ORDER BY created_at DESC').all(status)
  }
  return db.prepare('SELECT * FROM review_tasks ORDER BY created_at DESC').all()
}

export function getReviewTask(id: number): any {
  return db.prepare('SELECT * FROM review_tasks WHERE id = ?').get(id)
}

// 按 MR iid 查找（webhook 去重 + merge/close 回流用）
export function findReviewTaskByMrIid(mrIid: number): any {
  return db.prepare('SELECT * FROM review_tasks WHERE mr_iid = ? ORDER BY id DESC LIMIT 1').get(mrIid)
}

export function updateReviewTaskStatus(
  id: number,
  status: string,
  reviewer?: string,
  comment?: string,
): void {
  db.prepare(
    `UPDATE review_tasks
     SET status = ?, reviewed_at = datetime('now'), reviewer = ?, comment = ?
     WHERE id = ?`,
  ).run(status, reviewer ?? null, comment ?? null, id)
}

// ── build_tasks ──

export function recordBuildNeed(source: string, ref?: string): number {
  const result = db
    .prepare('INSERT INTO build_tasks (source, ref, status) VALUES (?, ?, ?)')
    .run(source, ref ?? null, 'pending')
  return Number(result.lastInsertRowid)
}

export function listBuildTasks(status?: string): any[] {
  if (status && status !== 'all') {
    return db
      .prepare('SELECT * FROM build_tasks WHERE status = ? ORDER BY created_at DESC')
      .all(status)
  }
  return db.prepare('SELECT * FROM build_tasks ORDER BY created_at DESC').all()
}

export function updateBuildTaskStatus(id: number, status: string, log?: string): void {
  db.prepare(
    `UPDATE build_tasks SET status = ?, built_at = datetime('now'), log = ? WHERE id = ?`,
  ).run(status, log ?? null, id)
}

export function clearBuildTask(id: number): void {
  db.prepare('DELETE FROM build_tasks WHERE id = ?').run(id)
}

export function countPendingBuildTasks(): number {
  const r = db
    .prepare("SELECT count(*) as c FROM build_tasks WHERE status = 'pending'")
    .get() as { c: number }
  return r.c
}

// ── 发布记录 / 工作台 / 待办（本周新增）──

// 发布记录：分页查已 merged 的，按发布时间倒序
export function listPublishedReviews(page: number, pageSize: number): { items: any[]; total: number } {
  const offset = (page - 1) * pageSize
  const items = db
    .prepare(
      `SELECT id, source, slug, branch, mr_iid, submitter, reviewer, reviewed_at, created_at, comment
       FROM review_tasks WHERE status = 'merged' ORDER BY reviewed_at DESC LIMIT ? OFFSET ?`,
    )
    .all(pageSize, offset)
  const total =
    (
      db
        .prepare("SELECT count(*) as c FROM review_tasks WHERE status = 'merged'")
        .get() as { c: number }
    ).c
  return { items, total }
}

// 本周已发布数（reviewed_at >= 本周一）
export function countMergedThisWeek(): number {
  // weekday 0 = 本周日往前推算，这里用 'weekday 1' 拿本周一 00:00
  const r = db
    .prepare(
      `SELECT count(*) as c FROM review_tasks
       WHERE status = 'merged' AND reviewed_at >= date('now', 'weekday 1')`,
    )
    .get() as { c: number }
  return r.c
}

// 最近 N 条审核活动（含来源，工作台"最近活动"用）
export function recentReviewTasks(limit: number): any[] {
  return db
    .prepare(
      `SELECT id, source, slug, branch, mr_iid, submitter, reviewer, status, created_at, reviewed_at
       FROM review_tasks ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)
}
