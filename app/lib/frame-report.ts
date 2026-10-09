import type { FrameRecord } from "./frame-documents.ts";
import type { TechnicalCalculationTable } from "./technical-sheet.ts";

/** Visible results from the same verified record embedded in the document. */
export function frameCalculationTables(record: FrameRecord | null): TechnicalCalculationTable[] {
  if (!record) return [];
  const number = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value).toExponential(5);
  const forceHeaders = ["Düğüm", "Fx (kN)", "Fy (kN)", "Fz (kN)", "Mx (kNm)", "My (kNm)", "Mz (kNm)"];
  return record.content.result.cases.flatMap(result => {
    const source = record.content.model.cases.find(c => c.id === result.id)!;
    const supports = new Set(record.content.model.supports.filter(s => s.fixed.some(Boolean)).map(s => s.nodeId));
    const context = `Yük durumu: ${result.id} · Denge artığı: ${result.relativeResidual.toExponential(3)} · Küresel eksenler`;
    return [
      { title: `${result.id} — Uygulanan düğüm yükleri`, context, headers: forceHeaders, rows: source.loads.map(n => [n.nodeId, ...n.values.map(number)]) },
      { title: `${result.id} — Mesnet reaksiyonları`, context, headers: forceHeaders, rows: result.nodes.filter(n => supports.has(n.id)).map(n => [n.id, ...n.reactions.map(number)]) },
      { title: `${result.id} — Düğüm ötelenmeleri ve dönmeleri`, context, headers: ["Düğüm", "Ux (m)", "Uy (m)", "Uz (m)", "Rx (rad)", "Ry (rad)", "Rz (rad)"], rows: result.nodes.map(n => [n.id, ...n.displacements.map(number)]) },
    ];
  });
}
