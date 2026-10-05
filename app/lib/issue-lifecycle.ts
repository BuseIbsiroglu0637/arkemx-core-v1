/** Device-local coordination state; review is NEVER a technical clearance. */
export type CoordinationIssueLike = {
  id: string;
  severity: "critical" | "review" | "info";
};

export function summarizeIssueLifecycle(
  activeIssues: readonly CoordinationIssueLike[],
  reviewedIds: readonly string[],
) {
  const active = new Set(activeIssues.map((issue) => issue.id));
  const reviewed = [...new Set(reviewedIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
  const reviewedSet = new Set(reviewed);
  const critical = activeIssues.filter((issue) => issue.severity === "critical");
  return {
    schema: "ARKEM-ISSUE-LIFECYCLE/1.0" as const,
    activeCount: activeIssues.length,
    activeCriticalCount: critical.length,
    reviewedActiveCount: activeIssues.filter((issue) => reviewedSet.has(issue.id)).length,
    reviewedCriticalCount: critical.filter((issue) => reviewedSet.has(issue.id)).length,
    // These issues no longer trigger the current parametric rules. This is not
    // equivalent to approval of a revised IFC model or engineering design.
    modelClearedIds: reviewed.filter((id) => !active.has(id)),
    blocked: critical.length > 0,
    status: critical.length > 0 ? "critical-open" as const : "conceptual-clear" as const,
    reviewed,
    limitation: "İnceleme kaydı veya parametrik kuralın kaybolması, yetkili mühendis onayı değildir.",
  };
}

/** Legacy 'resolved' was a one-click acknowledgment, not evidence of a fix. */
export function restoreReviewedIds(
  reviewed: unknown,
  legacyResolved: unknown,
): string[] {
  const source = Array.isArray(reviewed) ? reviewed : legacyResolved;
  if (!Array.isArray(source)) return [];
  return [...new Set(source.filter((id): id is string => typeof id === "string" && id.length > 0))];
}
