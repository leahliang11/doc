// gitbeaker 封装：操作京东 Coding（GitLab 衍生）的 MR
import { Gitlab } from '@gitbeaker/rest'
import { CODING_TOKEN, CODING_HOST, CODING_PROJECT_ID } from '../config.js'

const client = new Gitlab({
  token: CODING_TOKEN,
  host: CODING_HOST,
})

// 创建 MR：sourceBranch → main
export async function createMR(
  sourceBranch: string,
  title: string,
): Promise<{ iid: number; webUrl: string }> {
  const mr = await client.MergeRequests.create(
    CODING_PROJECT_ID,
    sourceBranch,
    'main',
    title,
  ) as any
  return {
    iid: mr.iid,
    webUrl: mr.web_url,
  }
}

// 关闭 MR（审核驳回时用，Week 5）
export async function closeMR(iid: number): Promise<void> {
  await client.MergeRequests.edit(CODING_PROJECT_ID, iid, {
    stateEvent: 'close',
  })
}

// 合并 MR（审核通过时用，Week 5）
export async function mergeMR(iid: number): Promise<void> {
  await client.MergeRequests.merge(CODING_PROJECT_ID, iid)
}

// 查 MR 状态（审核后确认是否真合入）
export async function getMRStatus(iid: number): Promise<{
  state: string
  mergeStatus: string
  mergedAt: string | null
}> {
  const mr = (await client.MergeRequests.show(CODING_PROJECT_ID, iid)) as any
  return {
    state: mr.state,
    mergeStatus: mr.merge_status,
    mergedAt: mr.merged_at,
  }
}
