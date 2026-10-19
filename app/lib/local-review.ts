/** A local review marker is invalidated by changed source content, not treated as engineering closure. */
export function localReviewKey(projectId: string, issue: { id?: string; guid?: string; title: string; evidence: string }, context: unknown) {
  return JSON.stringify({ projectId, id: issue.id ?? issue.guid, title: issue.title, evidence: issue.evidence, context });
}
