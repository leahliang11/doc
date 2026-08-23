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
  if (status) {
    return db.prepare('SELECT * FROM review_tasks WHERE status = ? ORDER BY created_at DESC').all(status)
  }
  return db.prepare('SELECT * FROM review_tasks ORDER BY created_at DESC').all()
}
