import type { FrameRecord } from "./frame-documents.ts";
import type { TechnicalCalculationTable } from "./technical-sheet.ts";

/** Visible results from the same verified record embedded in the document. */
export function frameCalculationTables(record: FrameRecord | null): TechnicalCalculationTable[] {
  if (!record) return [];
  const number = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value).toExponential(5);
  const forceHeaders = ["Düğüm", "Fx (kN)", "Fy (kN)", "Fz (kN)", "Mx (kNm)", "My (kNm)", "Mz (kNm)"];
  const accounting=record.content.loadAccounting;
  const gravityTables:TechnicalCalculationTable[]=accounting?[{
    title:"G — Sabit yük bileşenleri",
    context:"kN · Götürü taşıyıcı payı çıkarılmıştır; açık kolon/kiriş öz ağırlığı bunun yerine uygulanır.",
    headers:["Bileşen","Yük (kN)","Hesaba katılım"],
    rows:[
      ["Döşeme öz ağırlığı",number(accounting.floors.reduce((s,f)=>s+f.slabSelfWeight,0)),"Dahil"],
      ["Ek sabit yük",number(accounting.floors.reduce((s,f)=>s+f.superDeadLoad,0)),"Dahil"],
      ["Götürü taşıyıcı payı",number(accounting.floors.reduce((s,f)=>s+f.omittedFrameAllowance,0)),"Hariç"],
      ["Açık kolon/kiriş öz ağırlığı",number(accounting.members.reduce((s,m)=>s+m.weight,0)),"Dahil"],
      ["Uygulanan toplam G",number(accounting.floors.reduce((s,f)=>s+f.appliedAreaLoad,0)+accounting.members.reduce((s,m)=>s+m.weight,0)),"Toplam"],
    ],
  }]:[];
  return [...gravityTables,...record.content.result.cases.flatMap(result => {
    const source = record.content.model.cases.find(c => c.id === result.id)!;
    const supports = new Set(record.content.model.supports.filter(s => s.fixed.some(Boolean)).map(s => s.nodeId));
    const context = `Yük durumu: ${result.id} · Denge artığı: ${result.relativeResidual.toExponential(3)} · Küresel eksenler`;
    return [
      { title: `${result.id} — Uygulanan düğüm yükleri`, context, headers: forceHeaders, rows: source.loads.map(n => [n.nodeId, ...n.values.map(number)]) },
      ...(source.memberLoads?.length ? [{ title: `${result.id} — Düzgün yayılı eleman yükleri`, context: `Yük durumu: ${result.id} · Elemanın yerel x/y/z eksenleri`, headers: ["Eleman", "qx (kN/m)", "qy (kN/m)", "qz (kN/m)"], rows: source.memberLoads.map(l=>[l.memberId,...l.values.map(number)]) }] : []),
      { title: `${result.id} — Mesnet reaksiyonları`, context, headers: forceHeaders, rows: result.nodes.filter(n => supports.has(n.id)).map(n => [n.id, ...n.reactions.map(number)]) },
      { title: `${result.id} — Düğüm ötelenmeleri ve dönmeleri`, context, headers: ["Düğüm", "Ux (m)", "Uy (m)", "Uz (m)", "Rx (rad)", "Ry (rad)", "Rz (rad)"], rows: result.nodes.map(n => [n.id, ...n.displacements.map(number)]) },
    ];
  })];
}
