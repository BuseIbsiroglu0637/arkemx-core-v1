import { calculateStructuralConcept, SYSTEM_LABELS, type StructuralConceptInput } from "./engineering.ts";
import { inspectStructuralSourceReferences, planGeometrySnapshot } from "./source-reference-integrity.ts";
import { projectIntegrityIssues } from "./project-integrity.ts";
import { createDocumentIdentity } from "./document-identity.ts";
import { traceJson, traceSha256 } from "./structural-traceability.ts";
import { inspectFloorCoordination } from "./floor-coordination.ts";

type Data = Record<string, unknown>;
const data = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
export type FloorStudy = NonNullable<ReturnType<typeof calculateFloorPlateStudy>["study"]>;

// Independent rectangular floor areas and loads. Never a building analysis:
// no member continuity, load path, transfer floor or lateral model is invented.
export function calculateFloorPlateStudy(project: unknown, input: StructuralConceptInput) {
  const issues: string[] = [];
  const p = data(project), modules = data(p.modules), plan = data(modules["plan-editor"]), structure = data(modules["structural-concept"]);
  if (inspectStructuralSourceReferences(project).status !== "consistent") issues.push("Kat çalışması için güncel eleman ve geometri kaynak bağlantısı gerekiyor.");
  if (projectIntegrityIssues(project).some(issue => issue.startsWith("plan-editor:") || issue.startsWith("structural-concept:"))) issues.push("Kaynak proje, revizyon veya birimler geçersiz.");
  const floorCount = Number(plan.floorCount);
  const plates = Array.isArray(plan.floorPlates) ? plan.floorPlates.map(data).sort((a, b) => Number(a.level) - Number(b.level)) : [];
  if (typeof plan.floorCount !== "number" || !Number.isInteger(floorCount) || floorCount < 1 || floorCount > 50 || plates.length !== floorCount || plates.some((plate, i) => plate.level !== i + 1)) issues.push("Her kat için tek plaka gerekiyor; kat listesi 1’den kat sayısına kadar eksiksiz olmalı.");
  if (plates.some(plate => typeof plate.width !== "number" || !Number.isFinite(plate.width) || plate.width <= 0 || typeof plate.depth !== "number" || !Number.isFinite(plate.depth) || plate.depth <= 0 || !Number.isFinite(Number(plate.width) * Number(plate.depth)))) issues.push("Kat plaka boyutları geçersiz.");
  if (plates.some(plate => plate.grossArea !== undefined && (typeof plate.grossArea !== "number" || !Number.isFinite(plate.grossArea) || Math.abs(plate.grossArea - Number(plate.width) * Number(plate.depth)) > .01))) issues.push("Beyan edilen brüt alan plaka boyutlarıyla uyuşmuyor.");
  if (plates.some(plate => plate.polygon !== undefined || plate.holes !== undefined)) issues.push("Bu kat çalışması yalnız dikdörtgen brüt plakaları destekler.");
  if (!Object.hasOwn(SYSTEM_LABELS, input.system) || !["residential", "office", "industrial", "storage", "assembly"].includes(input.usage) || Object.values(input).some(v => typeof v === "number" && !Number.isFinite(v)) || input.slabThickness <= 0 || input.floorHeight <= 0 || input.superDeadLoad < 0 || input.liveLoad < 0 || input.roofSnowLoad < 0) issues.push("Yük veya malzeme girdileri geçersiz.");
  const elements = Array.isArray(plan.elements) ? plan.elements.map(data).sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0) : [];
  if (elements.some(element => !Number.isInteger(element.level) || Number(element.level) < 1 || Number(element.level) > floorCount || (element.load !== undefined && (typeof element.load !== "number" || !Number.isFinite(element.load) || element.load < 0)))) issues.push("Kaynak elemanın katı veya yükü geçersiz.");
  if (!Number.isInteger(plan.baysX) || Number(plan.baysX) < 1 || Number(plan.baysX) > 16 || !Number.isInteger(plan.baysY) || Number(plan.baysY) < 1 || Number(plan.baysY) > 16) issues.push("Kat çizimi için 1–16 aralığında geçerli aks adedi gerekiyor.");
  if (issues.length) return { study: null, issues };
  try {
    const floors = plates.map(plate => {
      const sourceElements = elements.filter(element => element.level === plate.level);
      const declaredLoads = sourceElements.filter(element => typeof element.load === "number");
      const liveLoad = declaredLoads.length ? Math.max(...declaredLoads.map(element => Number(element.load))) : input.liveLoad;
      const floorInput = { ...input, width: Number(plate.width), depth: Number(plate.depth), floors: 1, baysX: Number(plan.baysX), baysY: Number(plan.baysY), liveLoad };
      // Reuse only the existing area-load expressions, not its building proxies.
      const result = calculateStructuralConcept(floorInput);
      const area = floorInput.width * floorInput.depth;
      return {
        level: Number(plate.level), width: floorInput.width, depth: floorInput.depth, area,
        baysX: floorInput.baysX, baysY: floorInput.baysY, spanX: result.geometry.spanX, spanY: result.geometry.spanY,
        sourceElementIds: sourceElements.map(element => String(element.id)),
        liveLoadSource: declaredLoads.length ? "maximum-source-element-load" : "global-input",
        loads: { permanentArea: result.loads.permanentLoad, liveArea: liveLoad, permanentTotal: result.loads.permanentLoad * area, liveTotal: liveLoad * area, gravityCombinationProxy: result.loads.ulsAreaLoad * area, seismicWeightProxy: result.loads.seismicAreaLoad * area, roofSnowTotal: plate.level === floorCount ? input.roofSnowLoad * area : 0 },
        quantities: { grossSlabConcreteVolume: input.system === "concrete" || input.system === "hybrid" ? area * input.slabThickness : input.system === "precast" ? area * .1 : 0 },
      };
    });
    const sum = (get: (floor: (typeof floors)[number]) => number) => floors.reduce((total, floor) => total + get(floor), 0);
    const study = {
      schema: "ARKEM-FLOOR-PLATE-STUDY/1.0", projectId: String(p.id), revision: String(p.revision),
      scope: "independent-rectangular-floor-load-and-slab-study", fullBuildingAnalysis: false, technicalApproval: false,
      engine: "calculateStructuralConcept/1.0:area-load-expressions-only",
      source: { module: "plan-editor", revision: structure.sourceRevision, units: plan.units, geometry: planGeometrySnapshot(plan), elements },
      input, floors,
      ...(plan.floorCoordination === undefined ? {} : { coordination: inspectFloorCoordination(plan) }),
      totals: { grossArea: sum(floor => floor.area), permanentLoad: sum(floor => floor.loads.permanentTotal), liveLoad: sum(floor => floor.loads.liveTotal), gravityCombinationProxy: sum(floor => floor.loads.gravityCombinationProxy), seismicWeightProxy: sum(floor => floor.loads.seismicWeightProxy), roofSnowLoad: sum(floor => floor.loads.roofSnowTotal), grossSlabConcreteVolume: sum(floor => floor.quantities.grossSlabConcreteVolume) },
      limitations: ["Katlar yerel 0,0 başlangıcında bağımsız dikdörtgenlerdir; katlar arası konum ve taşıyıcı sürekliliği doğrulanmadı.", "Katın en büyük beyan edilmiş eleman yükü tüm brüt plaka alanına uygulanır; eleman yükü yoksa global girdi kullanılır.", "1,40G + 1,60Q mevcut ön motorun yük göstergesidir; nihai yük birleşimi veya yönetmelik kabulü değildir.", "Plaka miktarı brüttür; boşluklar düşülmez. Kolon, kiriş, temel, birleşim ve transfer katı analizi bu çalışmada yoktur."],
    };
    return { study: JSON.parse(traceJson(study)) as typeof study, issues: [] as string[] };
  } catch { return { study: null, issues: ["Kat hesabında sonlu olmayan veya desteklenmeyen sonuç oluştu."] }; }
}

export type FloorStudyRecord = { schema: "ARKEM-FLOOR-STUDY-RECORD/1.0"; id: string; sha256: string; content: FloorStudy };
export async function recordFloorStudy(content: FloorStudy): Promise<FloorStudyRecord> {
  const snapshot = JSON.parse(traceJson(content)) as FloorStudy;
  const sha256 = await traceSha256(traceJson(snapshot));
  return { schema: "ARKEM-FLOOR-STUDY-RECORD/1.0", id: `FLOOR-STUDY-${sha256}`, sha256, content: snapshot };
}
export async function verifyFloorStudy(record: FloorStudyRecord, project: unknown, input: StructuralConceptInput) {
  try {
    const current = calculateFloorPlateStudy(project, input).study;
    const sha = await traceSha256(traceJson(record.content));
    return record.schema === "ARKEM-FLOOR-STUDY-RECORD/1.0" && record.id === `FLOOR-STUDY-${sha}` && record.sha256 === sha && !!current && traceJson(current) === traceJson(record.content);
  } catch { return false; }
}
export async function floorStudyDocument(record: FloorStudyRecord, project: unknown, input: StructuralConceptInput, format: "JSON" | "CSV" | "PDF" | "DXF", level?: number) {
  if (!await verifyFloorStudy(record, project, input)) throw new Error("Kat çalışması güncel kaynakla eşleşmiyor.");
  if ((format === "PDF" || format === "DXF") && !record.content.floors.some(floor => floor.level === level)) throw new Error("Çizim katı bulunamadı.");
  const p = data(project), c = record.content;
  const elementIds = c.source.elements.map(element => String(element.id));
  const identityInput = { projectCode: c.projectId, revision: c.revision, module: "FLOOR-STUDY", sheetNo: `FLOOR-${level ?? "ALL"}-${format}`, sourceRevision: c.revision, elementIds, calculationIds: [record.id], contentDigest: record.sha256, coordinateSystem: "KAT YEREL / 0,0 — KATLAR ARASI KONUM DOGRULANMADI", sourceContext: { projectId: c.projectId, revision: c.revision, elementIds, calculationIds: [record.id], calculationBindings: [{ id: record.id, projectId: c.projectId, revision: c.revision, elementIds }] } };
  return { schema: "ARKEM-FLOOR-DOCUMENT/1.0", format, level: level ?? null, sourceCoordinateReference: p.coordinateReference ?? null, identityInput, identity: createDocumentIdentity(identityInput), studyId: record.id, studySha256: record.sha256, fullBuildingAnalysis: false, technicalApproval: false };
}
export async function sealFloorStudyDocument(manifest: Awaited<ReturnType<typeof floorStudyDocument>>, fileName: string, bytes: string | Uint8Array) {
  const sha256 = await traceSha256(bytes);
  return { schema: "ARKEM-FLOOR-DOCUMENT-RECORD/1.0", id: `FLOOR-DOC-${sha256}`, manifest, artifact: { fileName, sha256, byteLength: typeof bytes === "string" ? new TextEncoder().encode(bytes).length : bytes.byteLength }, fullBuildingAnalysis: false, technicalApproval: false };
}
export async function verifyFloorStudyDocument(document: Awaited<ReturnType<typeof sealFloorStudyDocument>>, registry: Record<string, FloorStudyRecord>, project: unknown, input: StructuralConceptInput, bytes: string | Uint8Array) {
  try {
    const study = registry[document.manifest.studyId];
    if (!study || document.schema !== "ARKEM-FLOOR-DOCUMENT-RECORD/1.0" || document.fullBuildingAnalysis !== false || document.technicalApproval !== false) return false;
    const expected = await floorStudyDocument(study, project, input, document.manifest.format, document.manifest.level ?? undefined);
    if (traceJson(expected) !== traceJson(document.manifest)) return false;
    const sha = await traceSha256(bytes), size = typeof bytes === "string" ? new TextEncoder().encode(bytes).length : bytes.byteLength;
    return document.id === `FLOOR-DOC-${sha}` && document.artifact.sha256 === sha && document.artifact.byteLength === size;
  } catch { return false; }
}
