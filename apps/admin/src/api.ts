// 后端 API 封装（通过 vite 代理 /api → :3001）

const API = '/api'

export interface DocListItem {
  slug: string
  title: string
  category: string
  status: string
  updated: string
}

export interface OpenResult {
  markdown: string
  frontmatter: Record<string, unknown>
  base_commit: string
}

export interface SaveResult {
  commit_hash: string
  branch: string
}

export interface SubmitResult {
  mr_iid: number
  mr_url: string
}

// 当前用户（Week 4 无登录，硬编码）
const USER = { name: 'leah', email: 'liangyuanwen.1@jd.com' }

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }))
    const e = new Error(err.error || `HTTP ${resp.status}`) as Error & {
      status: number
      remote_markdown?: string
    }
    e.status = resp.status
    e.remote_markdown = err.remote_markdown
    throw e
  }
  return resp.json()
}

export async function listDocs(): Promise<DocListItem[]> {
  const resp = await fetch(`${API}/docs`)
  return resp.json()
}

export async function openDoc(slug: string): Promise<OpenResult> {
  return post<OpenResult>('/docs/open', { slug, user: USER.name })
}

export async function saveDoc(
  slug: string,
  markdown: string,
  baseCommit: string,
): Promise<SaveResult> {
  return post<SaveResult>('/docs/save', {
    slug,
    markdown,
    base_commit: baseCommit,
    user: USER,
  })
}

export async function submitReview(
  slug: string,
  branch: string,
  title?: string,
): Promise<SubmitResult> {
  return post<SubmitResult>('/docs/submit-review', {
    slug,
    branch,
    submitter: USER.name,
    title,
  })
}

// ── 新建文档（本周新增）──

export interface CreateResult {
  slug: string
  commit_hash: string
}

export async function createDoc(params: {
  title: string
  slug: string
  template?: string
}): Promise<CreateResult> {
  return post<CreateResult>('/docs/create', { ...params, user: USER })
}

export async function genOpenApi(): Promise<{ generated: boolean; docs: DocListItem[] }> {
  return post('/docs/gen-openapi', {})
}

// ── 审核队列（Week 5）──

export interface ReviewTask {
  id: number
  source: 'web' | 'gitlab_mr'
  slug: string
  branch: string
  mr_iid: number | null
  submitter: string
  status: 'pending' | 'approved' | 'rejected' | 'merged'
  created_at: string
  reviewed_at: string | null
  reviewer: string | null
  comment: string | null
}

async function getJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${API}${path}`)
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }))
    throw new Error(err.error || `HTTP ${resp.status}`)
  }
  return resp.json()
}

export async function listReviewTasks(status?: string): Promise<ReviewTask[]> {
  const q = status ? `?status=${status}` : ''
  return getJson<ReviewTask[]>(`/review-tasks${q}`)
}

export async function getDiff(taskId: number): Promise<{ diff: string; branch: string }> {
  return getJson(`/review-tasks/${taskId}/diff`)
}

export async function approveReview(taskId: number): Promise<{ status: string; mr_iid: number }> {
  return post(`/review-tasks/${taskId}/approve`, {})
}

export async function rejectReview(
  taskId: number,
  comment: string,
): Promise<{ status: string; mr_iid: number }> {
  return post(`/review-tasks/${taskId}/reject`, { comment })
}

// ── 构建（Week 6）──

export interface BuildTask {
  id: number
  source: string
  ref: string | null
  status: 'pending' | 'building' | 'done' | 'failed'
  created_at: string
  built_at: string | null
  log: string | null
}

export async function listBuildTasks(status?: string): Promise<BuildTask[]> {
  const q = status ? `?status=${status}` : ''
  return getJson<BuildTask[]>(`/build/tasks${q}`)
}

export async function runBuild(): Promise<{ status: string; task_id: number }> {
  return post('/build/run', {})
}

// ── 发布记录 / 工作台 / 待办（本周新增）──

export interface PublishItem {
  id: number
  source: 'web' | 'gitlab_mr'
  slug: string
  branch: string
  mr_iid: number | null
  submitter: string
  reviewer: string | null
  reviewed_at: string | null
  created_at: string
  comment: string | null
}

export async function listPublish(
  page = 1,
  pageSize = 20,
): Promise<{ items: PublishItem[]; total: number; page: number; pageSize: number }> {
  return getJson(`/publish?page=${page}&pageSize=${pageSize}`)
}

export interface DashboardStats {
  docsTotal: number
  pendingReview: number
  publishedThisWeek: number
  aiCallsThisWeek: number
  buildPending: number
  recentEdits: ReviewTask[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return getJson('/dashboard/stats')
}

export interface TodoGroup {
  pendingReviews: ReviewTask[]
  conflicts: ReviewTask[]
  aiWarnings: ReviewTask[]
  buildPending: BuildTask[]
}

export async function getTodos(): Promise<TodoGroup> {
  return getJson('/todos')
}

// ============ 文档层级结构（_meta.yaml） ============

export interface MetaGroup {
  id: string
  label: string
  order?: number
  pages?: string[]
}
export interface MetaSection {
  id: string
  label: string
  icon?: string
  order?: number
  groups?: MetaGroup[]
}
export interface Meta {
  sections: MetaSection[]
}

export async function getMeta(): Promise<Meta> {
  return getJson('/meta')
}

/** 保存整棵层级树（走 draft 分支 + MR） */
export async function saveMeta(meta: Meta): Promise<{ mr_iid: number; mr_url: string }> {
  return post('/meta', { yaml: meta })
}

/** 移动文档到新组（走 draft + MR） */
export async function moveDoc(
  slug: string,
  toSectionId: string,
  toGroupId: string,
): Promise<{ status: string }> {
  return post('/docs/move', { slug, toSectionId, toGroupId })
}
