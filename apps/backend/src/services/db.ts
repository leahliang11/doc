// SQLite 封装：review_tasks / edit_sessions 表（规划 §5.2）
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { DB_PATH } from '../config.js'

// 确保 data 目录存在
const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

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
`)

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
