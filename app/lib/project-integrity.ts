import { inspectStructuralSourceReferences } from "./source-reference-integrity";
type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => v && typeof v === "object" && !Array.isArray(v) ? v as RecordValue : {};
export const PLAN_UNITS = { schema: "ARKEM-UNITS/1.0", length: "m", area: "m2", force: "kN", surfaceLoad: "kN/m2", coordinates: "grid-bay" } as const;
export function declaredModuleUnits(key: string) {
  if (key === "plan-editor") return PLAN_UNITS;
  if (["architectural-program", "structural-concept", "engineering-coordination"].includes(key)) return { ...PLAN_UNITS, coordinates: "m" };
  return undefined;
}
export function projectIntegrityIssues(value: unknown): string[] {
  const p = record(value), modules = record(p.modules), issues: string[] = [];
  for (const [key, value] of Object.entries(modules)) {
    const moduleValue = record(value), stamp = record(moduleValue._kernel);
    if (stamp.schema !== "ARKEM-MODULE-LINK/1.0") issues.push(key + ": source stamp missing or unsupported");
    else if (stamp.projectId !== p.id || stamp.projectRevision !== p.revision) issues.push(key + ": project/revision conflict");
    const expected = declaredModuleUnits(key);
    if (expected && Object.entries(expected).some(([name, unit]) => record(moduleValue.units)[name] !== unit)) issues.push(key + ": dimensional units missing or unsupported (no implicit conversion)");
    if (key === "plan-editor" && Array.isArray(moduleValue.elements)) {
      const ids = new Set<string>();
      for (const e of moduleValue.elements.map(record)) {
        if (typeof e.id !== "string" || !e.id.trim() || e.id !== e.id.trim() || ids.has(e.id)) issues.push(key + ": element identity missing or duplicated");
        if (!["manual", "program", "program-derived"].includes(String(e.provenance))) issues.push(key + ": element provenance missing or unsupported");
        if (e.provenance === "program" && (typeof e.sourceSpaceId !== "string" || !e.sourceSpaceId.trim())) issues.push(key + ": program source identity missing");
        if (e.provenance === "program-derived" && (!Number.isInteger(e.sourceFloorLevel) || !Array.isArray(e.derivedFromSpaceIds))) issues.push(key + ": derived geometry source missing");
        if (typeof e.id === "string") ids.add(e.id);
      }
    }
    if (key === "architectural-program" && Array.isArray(moduleValue.spaces)) {
      const ids = moduleValue.spaces.map(v => record(v).id);
      if (ids.some(id => typeof id !== "string" || !id.trim() || id !== id.trim()) || new Set(ids).size !== ids.length) issues.push(key + ": program identity missing or duplicated");
    }
    if (key === "plan-editor") {
      try { resolvePlanHandoffGeometry(moduleValue); } catch (error) { issues.push(key + ": " + (error instanceof Error ? error.message : "floor geometry unsupported")); }
    }
    if (key === "project-os") {
      const clashes = record(record(moduleValue.coordination).bimCoordination).clashes;
      if (Array.isArray(clashes)) {
        const ids = clashes.map(v => record(v).guid);
        if (ids.some(id => typeof id !== "string" || !id.trim() || id !== id.trim()) || new Set(ids).size !== ids.length) issues.push(key + ": clash identity missing or duplicated");
      }
    }
  }
  if (modules["structural-concept"]) {
    const refs = inspectStructuralSourceReferences(p);
    if (refs.status === "invalid") issues.push(...refs.issues.map(issue => "structural-concept: " + issue));
  }
  return issues;
}
export function resolvePlanHandoffGeometry(value: unknown) {
  const rawPlates = record(value).floorPlates;
  if (rawPlates !== undefined && rawPlates !== null && !Array.isArray(rawPlates)) throw new Error("Floor geometry collection unsupported");
  const p = record(value), plates = Array.isArray(p.floorPlates) ? p.floorPlates.map(record) : [];
  const level = typeof p.level === "number" ? p.level : 1;
  const matches = plates.filter(f => f.level === level);
  if (plates.length && matches.length !== 1) throw new Error("Selected floor geometry missing or duplicated");
  const finitePositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
  const selected = matches[0];
  if (plates.some(plate => !finitePositive(plate.width) || !finitePositive(plate.depth) || !Number.isInteger(plate.level) || Number(plate.level) < 1) || new Set(plates.map(plate => plate.level)).size !== plates.length) throw new Error("Floor geometry invalid or duplicated");
  const width = selected ? selected.width : Number(p.baysX) * Number(p.spanX);
  const depth = selected ? selected.depth : Number(p.baysY) * Number(p.spanY);
  if (!finitePositive(width) || !finitePositive(depth)) throw new Error("Selected floor geometry invalid");
  return { width, depth, selectedLevel: level, floorPlates: p.floorPlates ?? [], geometrySource: selected ? "selected-floor-plate" : "declared-grid", fullBuildingAnalysis: false as const };
}
