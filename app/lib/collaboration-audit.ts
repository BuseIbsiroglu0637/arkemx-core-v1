export type CollaborationDecision = {
  id: string;
  text: string;
  owner: string;
  status: string;
  createdAt: string;
};

export function createCollaborationAudit(input: {
  projectId: string;
  revision: string;
  decisions: CollaborationDecision[];
  approvals: Record<string, string>;
}) {
  return {
    schema: "ARKEM-COLLABORATION-AUDIT/1.0",
    projectId: input.projectId,
    revision: input.revision,
    generatedAt: new Date().toISOString(),
    decisions: input.decisions.map((decision) => ({
      ...decision,
      traceable: Boolean(decision.id && decision.owner && decision.createdAt),
    })),
    approvals: Object.entries(input.approvals).map(([gate, state]) => ({ gate, state })),
    boundary: {
      persistence: "device-local",
      cloudCdeConnected: false,
      note: "Çok kullanıcılı yorum, bildirim ve yetki akışı için müşteri CDE/kimlik servisi gerekir.",
    },
  };
}
