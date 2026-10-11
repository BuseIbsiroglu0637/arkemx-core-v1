import type { ProjectOperatingWorkItem } from "./project-os-2";

export type TrackingEvidence = { actor: string; reason: string; evidence: string; at: string; revision: string };
export type TrackingDocument = { code: string; title: string; discipline: string; rev: string; status: "Onaylı" | "İncelemede" | "Revizyon"; date: string; source?: string; approval?: TrackingEvidence };
export type TrackingDecision = { id: string; title: string; impact: string; owner: string; due: string; state: string; resolution?: TrackingEvidence };
export type TrackingWork = ProjectOperatingWorkItem & { closure?: TrackingEvidence };
export type RegisterDraft = { title: string; owner: string; due: string; code: string; revision: string; discipline: string; source: string; impact: string };
export type TrackingProgress = { actual: number; planned: number; budget: number; actualCost: number; week: number; evidence: TrackingEvidence };
export type TrackingPhase = { id: string; name: string; owner: string; start: string; end: string; progress: number; source: string; revision: string };

/** Empty form templates cannot restore object rows; preserve register rows explicitly. */
export function restoreRegisterRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter(row => row && typeof row === "object" && !Array.isArray(row)) as T[] : [];
}

export function earnedValueFromProgress(value: TrackingProgress | null) {
  if (!value) return null;
  if (![value.actual, value.planned].every(n => Number.isFinite(n) && n >= 0 && n <= 100)
    || ![value.budget, value.actualCost, value.week].every(n => Number.isFinite(n) && n >= 0)
    || value.budget <= 0 || !Number.isInteger(value.week)) throw new Error("İlerleme %0–100, bütçe pozitif, maliyet ve hafta sıfır veya pozitif olmalı.");
  const earned = value.budget * value.actual / 100;
  const plannedValue = value.budget * value.planned / 100;
  const spi = plannedValue > 0 ? earned / plannedValue : null;
  const cpi = value.actualCost > 0 ? earned / value.actualCost : null;
  return { ...value, earned, spi, cpi, eac: cpi && cpi > 0 ? value.budget / cpi : null, dataStatus: "user-record" as const };
}

export function trackingEvidence(input: Omit<TrackingEvidence, "at">, at = new Date().toISOString()): TrackingEvidence {
  if (![input.actor, input.reason, input.evidence, input.revision].every(value => value.trim())) throw new Error("İşlem yapan kişi, gerekçe, dayanak ve revizyon gerekli.");
  return { ...input, actor: input.actor.trim(), reason: input.reason.trim(), evidence: input.evidence.trim(), at };
}

export function createTrackingWork(draft: RegisterDraft, id: string): TrackingWork {
  if (![draft.title, draft.owner, draft.due, draft.source, draft.revision].every(value => value.trim())) throw new Error("Görev adı, sorumlu, tarih, kaynak ve revizyon gerekli.");
  return { id, type: "task", title: draft.title.trim(), owner: draft.owner.trim(), dueDate: draft.due, revision: draft.revision.trim(), source: draft.source.trim(), status: "open", priority: "normal", disciplines: [], scheduleImpact: draft.impact.trim() || "Etki değerlendirilecek", costImpact: "Veri yok" };
}
