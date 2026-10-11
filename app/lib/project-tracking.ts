type RecordValue = Record<string, unknown>;
export function restoreProjectTracking(saved: RecordValue) {
  // Previous versions mixed illustrative documents, progress and delivery
  // flags into every project. Preserve that snapshot for review, never
  // silently promote it to a verified project record.
  const current = saved.trackingDataStatus === "project-record";
  return {
    current,
    legacyTrackingSnapshot: current ? saved.legacyTrackingSnapshot ?? null
      : Object.keys(saved).some(key => ["documents", "decisions", "earnedValue", "handover"].includes(key))
        ? structuredClone(saved) : null,
    week: current && typeof saved.week === "number" ? saved.week : 0,
    documents: current && Array.isArray(saved.documents) ? saved.documents : [],
    decisions: current && Array.isArray(saved.decisions) ? saved.decisions : [],
    qualityOpen: current && Array.isArray(saved.qualityOpen) ? saved.qualityOpen : [],
    handover: current && Array.isArray(saved.handover) && saved.handover.length === 6
      ? saved.handover.map(value => value === true) : Array<boolean>(6).fill(false),
  };
}
