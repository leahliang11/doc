// GitHub Pull Request 适配层。
// 文件名和导出函数保持历史兼容，业务层无需感知 GitLab/Coding → GitHub 的迁移。
import { GITHUB_API_URL, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN } from '../config.js'

function apiUrl(path: string): string {
  return `${GITHUB_API_URL.replace(/\/$/, '')}${path}`
}

async function githubRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!GITHUB_TOKEN) throw new Error('缺少 GITHUB_TOKEN，无法操作 GitHub Pull Request')
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const repoPath = `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}`

// 创建 PR：sourceBranch → main
export async function createMR(
  sourceBranch: string,
  title: string,
): Promise<{ iid: number; webUrl: string }> {
  const mr = await githubRequest<{ number: number; html_url: string }>(`${repoPath}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, head: sourceBranch, base: 'main', body: '由 JoyMaaS 文档后台创建，审核通过后合入。' }),
  })
  return {
    iid: mr.number,
    webUrl: mr.html_url,
  }
}

// 关闭 PR（审核驳回时用）
export async function closeMR(iid: number): Promise<void> {
  await githubRequest(`${repoPath}/pulls/${iid}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' }),
  })
}

// 合并 PR（审核通过时用）
export async function mergeMR(iid: number): Promise<void> {
  await githubRequest(`${repoPath}/pulls/${iid}/merge`, {
    method: 'PUT',
    body: JSON.stringify({ merge_method: 'merge' }),
  })
}

// 查 PR 状态（审核后确认是否真合入）
export async function getMRStatus(iid: number): Promise<{
  state: string
  mergeStatus: string
  mergedAt: string | null
}> {
  const mr = await githubRequest<{
    state: string
    mergeable_state: string
    merged_at: string | null
  }>(`${repoPath}/pulls/${iid}`)
  return {
    state: mr.state,
    mergeStatus: mr.mergeable_state,
    mergedAt: mr.merged_at,
  }
}
