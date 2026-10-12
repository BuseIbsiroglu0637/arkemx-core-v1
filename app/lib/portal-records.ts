export type ApprovalState = "Bekliyor" | "İncelemede" | "Onaylandı";
export type PortalDecision = { id: string; text: string; owner: string; status: string; createdAt: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function portalRecords(value: unknown, revision?: string) {
  const portal = record(value);
  const stored = record(portal.approvals);
  const bindings = record(portal.approvalRecords);
  const staleApprovals: string[] = [];
  const approvals = Object.fromEntries(["scope", "system", "coordination", "delivery"].map(key => {
    const state = stored[key];
    const binding = record(bindings[key]);
    if (revision !== undefined && (binding.revision !== revision || binding.state !== state || !revision.trim())) {
      if (state === "İncelemede" || state === "Onaylandı") staleApprovals.push(key);
      return [key, "Bekliyor"];
    }
    return [key, state === "İncelemede" || state === "Onaylandı" ? state : "Bekliyor"];
  })) as Record<string, ApprovalState>;
  const decisions: PortalDecision[] = Array.isArray(portal.decisions) ? portal.decisions.filter((value): value is PortalDecision => {
    const row = record(value);
    return ["id", "text", "owner", "status", "createdAt"].every(key => typeof row[key] === "string");
  }) : [];
  return { approvals, decisions, staleApprovals };
}

export function recordPortalApproval(value: unknown, gate: string, state: ApprovalState, revision: string, actor: string, recordedAt: string) {
  if (!["scope", "system", "coordination", "delivery"].includes(gate) || !revision.trim()) return null;
  const portal = record(value);
  const approvals = { ...record(portal.approvals), [gate]: state };
  const approvalRecords = { ...record(portal.approvalRecords), [gate]: { state, revision, actor, recordedAt } };
  const approvalHistory = [...(Array.isArray(portal.approvalHistory) ? portal.approvalHistory : []), { gate, state, revision, actor, recordedAt }];
  return { approvals, approvalRecords, approvalHistory };
}

export function nextPortalDecisionId(decisions: PortalDecision[]) {
  const max = decisions.reduce((result, row) => /^DEC-\d+$/.test(row.id) ? Math.max(result, Number(row.id.slice(4))) : result, 0);
  return `DEC-${String(max + 1).padStart(3, "0")}`;
}
