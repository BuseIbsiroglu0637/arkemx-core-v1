import { calculateStructuralConcept, type StructuralConceptInput } from "./engineering.ts";
import { createStructuralStudio } from "./structural-studio.ts";
import { createDocumentIdentity } from "./document-identity.ts";
import { inspectStructuralSourceReferences, planGeometrySnapshot, structuralAnalysisBlockers } from "./source-reference-integrity.ts";
import { projectIntegrityIssues, resolvePlanHandoffGeometry } from "./project-integrity.ts";

type Data = Record<string, unknown>;
const data = (v: unknown): Data => v && typeof v === "object" && !Array.isArray(v) ? v as Data : {};
export type StructuralCalculationOptions = {
  designBasis: string; soilClass: string; repetition: number; transportDistance: number; fireRating: number;
};

// Strict, deterministic JSON. Reject unsupported/nonfinite values rather than
// letting JSON.stringify silently change the evidence (e.g. NaN -> null).
export function traceJson(value: unknown): string {
  function normalize(v: unknown, depth = 0): unknown {
    if (depth > 40) throw new Error("Traceability content too deep");
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return v.map(item => normalize(item, depth + 1));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, normalize(item, depth + 1)]));
    throw new Error("Unsupported traceability content");
  }
  return JSON.stringify(normalize(value));
}

export async function traceSha256(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : Uint8Array.from(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export function prepareStructuralCalculation(project: unknown, input: StructuralConceptInput, options: StructuralCalculationOptions) {
  const p = data(project), modules = data(p.modules), structure = data(modules["structural-concept"]), plan = data(modules["plan-editor"]);
  if (inspectStructuralSourceReferences(project).status !== "consistent" || structuralAnalysisBlockers(structure).length) return null;
  if (projectIntegrityIssues(project).some(issue => issue.startsWith("plan-editor:") || issue.startsWith("structural-concept:") || issue.startsWith("architectural-program:"))) return null;
  const geometry = resolvePlanHandoffGeometry(plan);
  // Linked calculations must use the source geometry. Independent scenarios
  // can still calculate, but cannot claim a complete source/document chain.
  if (Math.abs(input.width - Number(geometry.width)) > .001 || Math.abs(input.depth - Number(geometry.depth)) > .001 || input.floors !== plan.floorCount || input.baysX !== plan.baysX || input.baysY !== plan.baysY) return null;
  const elements = (plan.elements as Data[]).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const architecturalScheme = data(modules["architectural-program"]).architecturalScheme;
  const result = calculateStructuralConcept(input);
  const studio = createStructuralStudio({ reference: String(p.id), input, architecturalScheme, ...options, generatedAt: "content-addressed" });
  const structuralStudio = Object.fromEntries(Object.entries(studio).filter(([key]) => key !== "generatedAt"));
  const content = {
    schema: "ARKEM-STRUCTURAL-CALCULATION-CONTENT/1.0",
    engine: { concept: "calculateStructuralConcept/1.0", studio: "createStructuralStudio/3.0" },
    projectId: p.id, revision: p.revision,
    scope: "uniform-floor-concept-model", fullBuildingAnalysis: false, technicalApproval: false,
    source: { module: "plan-editor", revision: structure.sourceRevision, units: plan.units, elements, geometry: planGeometrySnapshot(plan), architecturalScheme: architecturalScheme ?? null },
    units: structure.units, input, options, result, structuralStudio,
  };
  return JSON.parse(traceJson(content)) as typeof content;
}

export type StructuralCalculationRecord = {
  schema: "ARKEM-STRUCTURAL-CALCULATION/1.0"; id: string; sha256: string;
  content: NonNullable<ReturnType<typeof prepareStructuralCalculation>>;
};

export async function recordStructuralCalculation(content: StructuralCalculationRecord["content"]): Promise<StructuralCalculationRecord> {
  const snapshot = JSON.parse(traceJson(content)) as StructuralCalculationRecord["content"];
  const sha256 = await traceSha256(traceJson(snapshot));
  return { schema: "ARKEM-STRUCTURAL-CALCULATION/1.0", id: `CALC-${sha256}`, sha256, content: snapshot };
}

export async function verifyStructuralCalculation(record: StructuralCalculationRecord, project: unknown, input: StructuralConceptInput, options: StructuralCalculationOptions) {
  try {
    if (record.schema !== "ARKEM-STRUCTURAL-CALCULATION/1.0") return false;
    const sha = await traceSha256(traceJson(record.content));
    if (record.sha256 !== sha || record.id !== `CALC-${sha}`) return false;
    const current = prepareStructuralCalculation(project, input, options);
    return !!current && traceJson(current) === traceJson(record.content);
  } catch { return false; }
}

export async function createStructuralDocument(record: StructuralCalculationRecord, project: unknown, input: StructuralConceptInput, options: StructuralCalculationOptions, format: "JSON" | "PDF" | "DXF" | "CSV") {
  if (!await verifyStructuralCalculation(record, project, input, options)) throw new Error("Hesap kaydı güncel kaynak/girdi/sonuç ile eşleşmiyor.");
  const p = data(project);
  const elementIds = record.content.source.elements.map(element => String(element.id));
  const identityInput = {
    projectCode: String(p.id), module: "STR", sheetNo: `STR-001-${format}`, revision: String(p.revision), coordinateSystem: String(p.coordinateReference ?? ""),
    sourceRevision: String(record.content.source.revision), elementIds, calculationIds: [record.id],
    sourceContext: { projectId: String(p.id), revision: String(p.revision), elementIds, calculationIds: [record.id], calculationBindings: [{ id: record.id, projectId: String(record.content.projectId), revision: String(record.content.revision), elementIds }] },
    contentDigest: record.sha256,
  };
  const identity = createDocumentIdentity(identityInput);
  if (identity.references.status !== "declared") throw new Error("Belge kaynak zinciri doğrulanamadı.");
  return {
    schema: "ARKEM-STRUCTURAL-DOCUMENT-MANIFEST/1.0" as const, format, identity, identityInput,
    calculationId: record.id, calculationSha256: record.sha256, projectId: String(p.id), revision: String(p.revision), elementIds,
    scope: record.content.scope, contentIntegrity: "sha256-and-recalculation-matched", technicalApproval: false,
  };
}

export async function sealStructuralDocument(manifest: Awaited<ReturnType<typeof createStructuralDocument>>, fileName: string, bytes: string | Uint8Array) {
  const sha256 = await traceSha256(bytes);
  return { schema: "ARKEM-STRUCTURAL-DOCUMENT/1.0", id: `DOC-${sha256}`, manifest, artifact: { fileName, sha256, byteLength: typeof bytes === "string" ? new TextEncoder().encode(bytes).length : bytes.byteLength }, technicalApproval: false };
}

export async function verifyStructuralDocument(document: Awaited<ReturnType<typeof sealStructuralDocument>>, registry: Record<string, StructuralCalculationRecord>, project: unknown, input: StructuralConceptInput, options: StructuralCalculationOptions, bytes: string | Uint8Array) {
  try {
    if (document.schema !== "ARKEM-STRUCTURAL-DOCUMENT/1.0") return false;
    const calculation = registry[document.manifest.calculationId];
    if (!calculation || !await verifyStructuralCalculation(calculation, project, input, options)) return false;
    const expected = await createStructuralDocument(calculation, project, input, options, document.manifest.format);
    if (traceJson(expected) !== traceJson(document.manifest)) return false;
    const sha = await traceSha256(bytes);
    const size = typeof bytes === "string" ? new TextEncoder().encode(bytes).length : bytes.byteLength;
    return document.id === `DOC-${sha}` && document.artifact.sha256 === sha && document.artifact.byteLength === size;
  } catch { return false; }
}
