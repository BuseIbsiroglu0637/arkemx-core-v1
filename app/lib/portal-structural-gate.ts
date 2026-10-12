import { structuralAnalysisBlockers, inspectStructuralSourceReferences } from "./source-reference-integrity.ts";
import { projectIntegrityIssues } from "./project-integrity.ts";
import { verifyStructuralCalculation, type StructuralCalculationRecord, type StructuralCalculationOptions } from "./structural-traceability.ts";
import type { StructuralConceptInput } from "./engineering.ts";

const data = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export type StructuralGate = { ready: boolean; label: string; requirement: string; technicalApproval: false };
const gate = (label: string, requirement: string, ready = false): StructuralGate => ({ ready, label, requirement, technicalApproval: false });

/** A verified preliminary calculation is a workflow control, never technical approval. */
export async function portalStructuralGate(project: unknown, upstreamReady: boolean): Promise<StructuralGate> {
  const p = data(project), modules = data(p.modules), structure = data(modules["structural-concept"]), plan = data(modules["plan-editor"]);
  if (structuralAnalysisBlockers(structure).length || plan.floorCoordination !== undefined || plan.floorFrame !== undefined)
    return gate("Engelli", "Mevcut kat geometrisi için taşıyıcı hesap desteklenmiyor");
  if (projectIntegrityIssues(project).some(issue => /^(plan-editor|structural-concept|architectural-program):/.test(issue)) || inspectStructuralSourceReferences(project).status === "invalid")
    return gate("Engelli", "Kaynak plan, birimler veya revizyon uyuşmazlığını düzeltin");
  const record = data(structure.calculationRegistry)[String(structure.calculationId)] as StructuralCalculationRecord | undefined;
  if (!record || !structure.input) return gate("Eksik", "Güncel plana bağlı taşıyıcı ön hesap kaydı gerekiyor");
  const production = data(data(structure.structuralStudio).production);
  const options = { designBasis: structure.designBasis, soilClass: structure.soilClass, repetition: production.repetition ?? data(record.content?.options).repetition, transportDistance: production.transportDistance ?? data(record.content?.options).transportDistance, fireRating: production.fireRating ?? data(record.content?.options).fireRating } as StructuralCalculationOptions;
  if (!await verifyStructuralCalculation(record, project, structure.input as StructuralConceptInput, options))
    return gate("Eksik", "Hesap kaydı güncel kaynak ve girdilerle doğrulanamadı; yeniden hesaplayın");
  const checks = record.content.result.checks;
  if (!Array.isArray(checks) || !checks.length) return gate("Eksik", "Ön hesap kontrol sonuçları gerekiyor");
  if (checks.some(check => check.state === "block")) return gate("Engelli", "Taşıyıcı ön hesapta engelleyici kontrol var");
  if (!upstreamReady) return gate("Eksik", "Önceki aşama kontrollerini ve sistem kararını tamamlayın");
  if (checks.some(check => check.state !== "pass")) return gate("Eksik", "Taşıyıcı ön hesap inceleme gerektiriyor");
  return gate("Hazır ✓", "Güncel ön hesap kontrolleri tamamlandı · teknik onay değildir", true);
}
