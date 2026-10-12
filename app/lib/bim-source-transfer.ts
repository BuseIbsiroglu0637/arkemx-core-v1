import { projectIntegrityIssues } from "./project-integrity.ts";
import { inspectStructuralSourceReferences, structuralAnalysisBlockers } from "./source-reference-integrity.ts";

const data = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const inRange = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

/** Only actual current sources may supply dimensions; canonical defaults are not transfers. */
export function bimSourceTransfer(project: unknown) {
  const p = data(project), modules = data(p.modules), architecture = data(modules["architectural-program"]), structure = data(modules["structural-concept"]);
  const scheme = data(architecture.architecturalScheme), studio = data(structure.structuralStudio);
  const integrity = projectIntegrityIssues(project);
  const current = (module: Record<string, unknown>, key: string) => data(module._kernel).projectId === p.id && data(module._kernel).projectRevision === p.revision && !integrity.some(issue => issue.startsWith(`${key}:`));
  const floorHeight = data(scheme.plate).floorHeight;
  const architectureConnected = scheme.schema === "ARKEM-ARCH-SCHEME/3.0" && scheme.reference === p.id && current(architecture, "architectural-program") && inRange(floorHeight, 2.6, 10);
  const alternatives = Array.isArray(studio.alternatives) ? studio.alternatives.map(data) : [];
  const selectedSystem = data(structure.input).system;
  const selected = alternatives.find(alternative => alternative.system === selectedSystem);
  const dimensions = data(data(selected?.preliminary).numeric);
  const beamDepth = dimensions.beamDepth, slabDepth = dimensions.slabThickness;
  const structureConnected = studio.schema === "ARKEM-STRUCTURAL-STUDIO/3.0" && studio.reference === p.id && current(structure, "structural-concept")
    && !structuralAnalysisBlockers(structure).length && inspectStructuralSourceReferences(project).status === "consistent"
    && inRange(beamDepth, .2, 2) && inRange(slabDepth, .08, .6);
  const message = [architectureConnected ? "V113 kat yüksekliği alındı." : "V113 mimari kaynak eksik veya geçersiz; kat yüksekliği aktarılmadı.",
    structureConnected ? "V114 seçili sistemin kiriş ve döşeme ön boyutları alındı; kavramsal koordinasyon girdileridir." : "V114 taşıyıcı kaynak eksik veya geçersiz; kiriş ve döşeme değerleri aktarılmadı. Mevcut koordinasyon girdileri korundu."].join(" ");
  return { architectureConnected, structureConnected, architecturalScheme: architectureConnected ? scheme : undefined, structuralStudio: structureConnected ? { ...studio, activeSystem: selectedSystem } : undefined,
    floorHeight: architectureConnected ? floorHeight as number : undefined, beamDepth: structureConnected ? beamDepth as number : undefined, slabDepth: structureConnected ? slabDepth as number : undefined,
    key: JSON.stringify([p.id, p.revision, architecture, structure, modules["plan-editor"]]), message, technicalApproval: false };
}
