import { planGeometrySnapshot } from "./source-reference-integrity.ts";
import { traceJson } from "./structural-traceability.ts";

type Data = Record<string, unknown>;
const data = (v: unknown): Data => v && typeof v === "object" && !Array.isArray(v) ? v as Data : {};
const rows = (v: unknown) => Array.isArray(v) ? v.map(data) : [];
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const byId = (a: Data, b: Data) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
export type FloorPlacement = { level: number; x: number; y: number; z: number };
export type FloorBeam = { id: string; startColumnId: string; endColumnId: string };
export type FloorCoordinationSource = { schema: "ARKEM-FLOOR-COORDINATION/1.0"; basis: string; placements: FloorPlacement[]; beams: FloorBeam[] };

// Ignore the coordination itself and UI-selected floor in its source binding.
export function floorCoordinationBasis(value: unknown) {
  const plan = data(value);
  const { level: _level, ...geometry } = planGeometrySnapshot({ ...plan, floorCoordination: undefined });
  void _level;
  return traceJson({ projectId: data(plan._kernel).projectId, revision: data(plan._kernel).projectRevision, units: plan.units, geometry, elements: rows(plan.elements).sort(byId) });
}

export function inspectFloorCoordination(value: unknown) {
  const plan = data(value), source = data(plan.floorCoordination), issues: string[] = [];
  const plates = rows(plan.floorPlates).sort((a, b) => Number(a.level) - Number(b.level));
  const placements = rows(source.placements).sort((a, b) => Number(a.level) - Number(b.level));
  const elements = rows(plan.elements).sort(byId), columnElements = elements.filter(e => e.type === "column");
  const beams = rows(source.beams).sort(byId);
  if (source.schema !== "ARKEM-FLOOR-COORDINATION/1.0") issues.push("Ortak kat koordinatları henüz kaydedilmedi.");
  try { if (source.basis !== floorCoordinationBasis(plan)) issues.push("Plan geometrisi veya elemanlar değişti; kat koordinatları ve kiriş bağlantıları yeniden doğrulanmalı."); }
  catch { issues.push("Koordinasyon kaynağı okunamadı."); }
  if (!Number.isInteger(plan.floorCount) || Number(plan.floorCount) < 1 || Number(plan.floorCount) > 50 || plates.length !== plan.floorCount || plates.some((p, i) => p.level !== i + 1 || !finite(p.width) || p.width <= 0 || !finite(p.depth) || p.depth <= 0)) issues.push("Kat plaka listesi geçersiz.");
  if (placements.length !== plates.length || placements.some((p, i) => p.level !== plates[i]?.level || !finite(p.x) || !finite(p.y) || !finite(p.z) || (i > 0 && Number(p.z) <= Number(placements[i - 1].z)))) issues.push("Her kat için sonlu X/Y/kot gerekiyor; kotlar kat sırasıyla artmalı.");
  if (data(plan.units).length !== "m" || data(plan.units).coordinates !== "grid-bay") issues.push("Koordinasyon m ve grid-bay kaynak birimlerini gerektirir.");
  if (placements.some(p => p.rotation !== undefined && p.rotation !== 0)) issues.push("Döndürülmüş kat plakası desteklenmiyor.");
  if (!Number.isInteger(plan.baysX) || Number(plan.baysX) < 1 || Number(plan.baysX) > 16 || !Number.isInteger(plan.baysY) || Number(plan.baysY) < 1 || Number(plan.baysY) > 16) issues.push("Aks adetleri geçersiz.");
  if (elements.some(e => typeof e.id !== "string" || !e.id.trim()) || new Set(elements.map(e => e.id)).size !== elements.length) issues.push("Kaynak eleman kimlikleri geçersiz veya tekrarlı.");
  if (columnElements.some(e => !plates.some(p => p.level === e.level) || !finite(e.x) || !finite(e.y) || e.x < 0 || e.y < 0 || e.x > Number(plan.baysX) || e.y > Number(plan.baysY))) issues.push("Kolon katı veya aks koordinatı geçersiz.");
  if (!Array.isArray(source.beams) || new Set(beams.map(b => b.id)).size !== beams.length || beams.some(b => typeof b.id !== "string" || !b.id.trim())) issues.push("Kiriş kimlikleri geçersiz veya tekrarlı.");
  const pairKeys = new Set<string>();
  for (const beam of beams) {
    const a = columnElements.find(e => e.id === beam.startColumnId), b = columnElements.find(e => e.id === beam.endColumnId);
    const pair = [String(beam.startColumnId), String(beam.endColumnId)].sort().join("\u0000");
    if (!a || !b || a.id === b.id || a.level !== b.level || pairKeys.has(pair)) issues.push(`Kiriş ${String(beam.id)} iki farklı, aynı kattaki gerçek kolona bağlanmalı; bağlantı tekrarlanamaz.`);
    pairKeys.add(pair);
  }
  const base = { schema: "ARKEM-FLOOR-COORDINATION-REPORT/1.0", toleranceM: .001, fullBuildingAnalysis: false, technicalApproval: false };
  if (issues.length) return { ...base, status: "pending" as const, issues, geometry: null };
  const floors = plates.map(p => { const o = placements.find(o => o.level === p.level)!; return { level: Number(p.level), x: Number(o.x), y: Number(o.y), z: Number(o.z), width: Number(p.width), depth: Number(p.depth) }; });
  if (floors.some(f => !Number.isFinite(f.x + f.width) || !Number.isFinite(f.y + f.depth) || f.x + f.width === f.x || f.y + f.depth === f.y)) return { ...base, status: "pending" as const, issues: ["Ortak koordinatlarda plaka sınırları sayısal olarak temsil edilemiyor."], geometry: null };
  const columns = columnElements.map(e => {
    const f = floors.find(f => f.level === e.level)!;
    return { id: String(e.id), level: f.level, x: f.x + Number(e.x) * f.width / Number(plan.baysX), y: f.y + Number(e.y) * f.depth / Number(plan.baysY), z: f.z, provenance: e.provenance ?? "unspecified" };
  });
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) <= .001;
  const segments = beams.map(b => ({ id: String(b.id), start: columns.find(c => c.id === b.startColumnId)!, end: columns.find(c => c.id === b.endColumnId)! }));
  if (columns.some(c => ![c.x, c.y, c.z].every(Number.isFinite)) || segments.some(s => near(s.start, s.end))) return { ...base, status: "pending" as const, issues: ["Kolon koordinatı sonlu değil veya kiriş uzunluğu 1 mm toleransından küçük."], geometry: null };
  const warnings: string[] = [];
  for (const f of floors) if (!columns.some(c => c.level === f.level)) warnings.push(`K${f.level}: kolon kaynağı yok.`);
  if (!segments.length) warnings.push("Kiriş bağlantısı tanımlanmadı; kiriş sürekliliği incelenemiyor.");
  if (columns.some(c => c.provenance === "conceptual-seed")) warnings.push("Temsilî kolonlar var; geometrik eşleşme gerçek taşıyıcı kabulü değildir.");
  const columnLinks = columns.filter(c => c.level > 1).map(upper => {
    const candidates = columns.filter(lower => lower.level === upper.level - 1 && near(lower, upper));
    const ambiguousUpper = columns.filter(c => c.level === upper.level && near(c, upper)).length > 1;
    const transferBeamIds = segments.filter(s => {
      if (s.start.level !== upper.level - 1) return false;
      const dx = s.end.x - s.start.x, dy = s.end.y - s.start.y, length2 = dx * dx + dy * dy;
      const t = ((upper.x - s.start.x) * dx + (upper.y - s.start.y) * dy) / length2;
      return t >= 0 && t <= 1 && near(upper, { x: s.start.x + t * dx, y: s.start.y + t * dy });
    }).map(s => s.id);
    const status = ambiguousUpper || candidates.length > 1 ? "ambiguous" : candidates.length === 1 ? "aligned-candidate" : transferBeamIds.length ? "transfer-review" : "no-support-source";
    if (status !== "aligned-candidate") warnings.push(`${upper.id}: ${status === "ambiguous" ? "birden fazla kolon eşleşmesi" : status === "transfer-review" ? "alt kiriş üzerinde; transfer incelemesi gerekli" : "alt katta destek kaynağı yok"}; taşıyıcı sürekliliği doğrulanmalı.`);
    return { upperColumnId: upper.id, lowerColumnIds: candidates.map(c => c.id), transferBeamIds, status };
  });
  const terminatedColumnIds = columns.filter(c => c.level < Number(plan.floorCount) && !columns.some(upper => upper.level === c.level + 1 && near(upper, c))).map(c => c.id);
  if (terminatedColumnIds.length) warnings.push(`Üst katta eşleşmeyen kolonlar: ${terminatedColumnIds.join(", ")}.`);
  const beamLinks = segments.filter(s => s.start.level > 1).map(upper => {
    const lowerBeamIds = segments.filter(lower => lower.start.level === upper.start.level - 1 && ((near(lower.start, upper.start) && near(lower.end, upper.end)) || (near(lower.start, upper.end) && near(lower.end, upper.start)))).map(s => s.id);
    const status = lowerBeamIds.length === 1 ? "aligned-candidate" : lowerBeamIds.length > 1 ? "ambiguous" : "no-matching-beam-source";
    if (status !== "aligned-candidate") warnings.push(`${upper.id}: ${status === "ambiguous" ? "birden fazla kiriş eşleşmesi" : "alt katta eşleşen kiriş yok"}; kiriş düzeni doğrulanmalı.`);
    return { upperBeamId: upper.id, lowerBeamIds, status };
  });
  return { ...base, status: "geometry-only" as const, issues: warnings, geometry: { floors, columns, beams: segments, columnLinks, beamLinks, terminatedColumnIds } };
}
