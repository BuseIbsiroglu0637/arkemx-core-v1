import { traceJson, traceSha256 } from "./structural-traceability.ts";

export const SHELL_UNITS = Object.freeze({ length: "m", force: "kN", stress: "kN/m²", areaLoad: "kN/m²", unitWeight: "kN/m³", rotation: "rad" } as const);
export type ShellSource = {
  schema: "ARKEM-SHELL-SOURCE/1.0" | "ARKEM-SHELL-SOURCE/1.1";
  projectId: string; revision: string; fixture: "synthetic";
  units: typeof SHELL_UNITS;
  plate: { id: string; sourceLevel: number; origin: [number, number, number]; width: number; depth: number; thickness: number };
  material: { id: string; name: string; E: number; nu: number; unitWeight: number };
  mesh: { nx: number; ny: number };
  supports: { preset: "SS-H" | "CL" };
  loads: { slabSelfWeight: boolean; superDeadLoad: number; liveLoad: number; benchmarkLoad: number };
  fullBuildingAnalysis: false; technicalApproval: false;
};
export type ShellNode = { id: string; x: number; y: number; z: number };
export type ShellSupport = { nodeId: string; fixed: [boolean, boolean, boolean, boolean, boolean, boolean] };
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;
const identifier = (v: unknown) => typeof v === "string" && v.trim().length > 0 && v.trim() === v;
function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(label + ": nesne gerekiyor.");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(k => !Object.hasOwn(row, k)) || Object.keys(row).some(k => !keys.includes(k))) throw Error(label + ": eksik veya desteklenmeyen alan.");
  return row;
}

/** Only declarations for the isolated rectangular pilot. No stiffness solve or engineering approval. */
export function validateShellSource(value: unknown): asserts value is ShellSource {
  const s = object(value, ["schema", "projectId", "revision", "fixture", "units", "plate", "material", "mesh", "supports", "loads", "fullBuildingAnalysis", "technicalApproval"], "Kabuk kaynağı");
  if (!["ARKEM-SHELL-SOURCE/1.0","ARKEM-SHELL-SOURCE/1.1"].includes(s.schema as string) || s.fixture !== "synthetic" || !identifier(s.projectId) || !identifier(s.revision) || s.fullBuildingAnalysis !== false || s.technicalApproval !== false) throw Error("Yalnız açık proje/revizyonlu sentetik kaynak; analiz veya teknik onay beyan edilemez.");
  validateRectangularShellPhysical({units:s.units,plate:s.plate,material:s.material,mesh:s.mesh,supports:s.supports,loads:s.loads},s.schema==="ARKEM-SHELL-SOURCE/1.1");
}

export type RectangularShellPhysical=Pick<ShellSource,"units"|"plate"|"material"|"mesh"|"supports"|"loads">;
/** Physical declaration checks only; this grants neither source provenance nor solver eligibility. */
export function validateRectangularShellPhysical(value:unknown,refined=false):asserts value is RectangularShellPhysical {
  const s=object(value,["units","plate","material","mesh","supports","loads"],"Dikdörtgen kabuk girdisi");
  const units = object(s.units, Object.keys(SHELL_UNITS), "Birimler");
  if (traceJson(units) !== traceJson(SHELL_UNITS)) throw Error("Kabuk birimleri m / kN / kN/m² / kN/m³ / rad olmalı.");
  const p = object(s.plate, ["id", "sourceLevel", "origin", "width", "depth", "thickness"], "Plaka");
  if (!identifier(p.id) || !finite(p.sourceLevel) || !Number.isInteger(p.sourceLevel) || p.sourceLevel < 1 || p.sourceLevel > 50 || !Array.isArray(p.origin) || p.origin.length !== 3 || !Array.from(p.origin).every(finite) || !positive(p.width) || !positive(p.depth) || !positive(p.thickness) || p.thickness > Math.min(p.width, p.depth)) throw Error("Plaka kimliği, katı, XYZ başlangıcı, boyut veya kalınlığı geçersiz.");
  const m = object(s.material, ["id", "name", "E", "nu", "unitWeight"], "Malzeme");
  if (!identifier(m.id) || !identifier(m.name) || !positive(m.E) || !finite(m.nu) || m.nu < 0 || m.nu >= .5 || !positive(m.unitWeight)) throw Error("Malzeme: pozitif E/γ ve 0≤ν<0,5 gerekiyor; G bunlardan türetilir.");
  const mesh = object(s.mesh, ["nx", "ny"], "Ağ");
  const maxSide=refined?64:32,maxCells=refined?2048:512,maxNodes=refined?2145:561;
  if (!finite(mesh.nx) || !finite(mesh.ny) || !Number.isInteger(mesh.nx) || !Number.isInteger(mesh.ny) || mesh.nx < 2 || mesh.ny < 2 || mesh.nx > maxSide || mesh.ny > maxSide || mesh.nx * mesh.ny > maxCells || (mesh.nx + 1) * (mesh.ny + 1) > maxNodes) throw Error("Pilot ağ sınırı aşıldı: kaynak 1.0 / 1.1 sınırını kontrol edin.");
  const supports = object(s.supports, ["preset"], "Mesnet");
  if (supports.preset !== "SS-H" && supports.preset !== "CL") throw Error("Açık SS-H veya CL kenar mesneti gerekiyor; noktasal kolon desteği bu pilotta yok.");
  const loads = object(s.loads, ["slabSelfWeight", "superDeadLoad", "liveLoad", "benchmarkLoad"], "Yük bileşenleri");
  if (typeof loads.slabSelfWeight !== "boolean" || [loads.superDeadLoad, loads.liveLoad, loads.benchmarkLoad].some(v => !finite(v) || v < 0)) throw Error("Öz ağırlık seçimi boolean; alan yükleri sonlu ve sıfır veya pozitif olmalı.");
}

export function prepareShellSource(value: unknown) {
  validateShellSource(value);
  const source = JSON.parse(traceJson(value)) as ShellSource;
  const { plate: p, mesh, material: m } = source;
  const area = p.width * p.depth, dx = p.width / mesh.nx, dy = p.depth / mesh.ny;
  const nodes: ShellNode[] = [], elements: Array<{id:string; sourcePlateId:string; nodeIds:[string,string,string,string]; materialId:string; thickness:number}> = [], supports: ShellSupport[] = [];
  const nodeId = (i: number, j: number) => p.id + ":N:" + i + ":" + j;
  for (let j = 0; j <= mesh.ny; j++) for (let i = 0; i <= mesh.nx; i++) {
    const node = { id: nodeId(i,j), x: p.origin[0] + p.width*i/mesh.nx, y: p.origin[1] + p.depth*j/mesh.ny, z: p.origin[2] };
    if (![node.x,node.y,node.z].every(finite) || (i > 0 && node.x <= nodes.at(-1)!.x) || (j > 0 && node.y <= nodes[(j-1)*(mesh.nx+1)+i].y)) throw Error("Ağ koordinatları sonlu veya birbirinden ayırt edilebilir değil.");
    nodes.push(node);
    const edgeX = i === 0 || i === mesh.nx, edgeY = j === 0 || j === mesh.ny;
    const fixed: ShellSupport["fixed"] = [i===0&&j===0, j===0&&(i===0||i===mesh.nx), edgeX||edgeY, source.supports.preset==="CL"?(edgeX||edgeY):edgeX, source.supports.preset==="CL"?(edgeX||edgeY):edgeY, false];
    if (fixed.some(Boolean)) supports.push({nodeId:node.id,fixed});
    if (i < mesh.nx && j < mesh.ny) elements.push({id:p.id+":Q:"+i+":"+j,sourcePlateId:p.id,nodeIds:[nodeId(i,j),nodeId(i+1,j),nodeId(i+1,j+1),nodeId(i,j+1)],materialId:m.id,thickness:p.thickness});
  }
  const slab = source.loads.slabSelfWeight ? m.unitWeight*p.thickness : 0;
  const components = [
    {id:"G_SW",kind:"slab-self-weight",areaLoad:slab},
    {id:"G_SUP",kind:"superimposed-dead",areaLoad:source.loads.superDeadLoad},
    {id:"Q",kind:"live",areaLoad:source.loads.liveLoad},
    {id:"BENCH",kind:"benchmark",areaLoad:source.loads.benchmarkLoad},
  ];
  const cases = [...components.map(c=>({id:c.id,componentIds:[c.id],areaLoad:c.areaLoad})),{id:"G",componentIds:["G_SW","G_SUP"],areaLoad:slab+source.loads.superDeadLoad}].map(c=>({
    ...c,direction:[0,0,-1] as [number,number,number],totalVerticalForce:-c.areaLoad*area,
  }));
  const G = m.E/(2*(1+m.nu)), elementArea = dx*dy;
  if (![area,dx,dy,elementArea,G,slab,...cases.flatMap(c=>[c.areaLoad,c.totalVerticalForce])].every(finite) || area<=0 || elementArea<=0 || G<=0 || (source.loads.slabSelfWeight && slab<=0) || cases.some(c=>c.areaLoad>0 && c.totalVerticalForce>=0)) throw Error("Ağ veya yük türevleri sonlu ve pozitif değil.");
  return {
    schema:"ARKEM-SHELL-PREPARED-SOURCE/1.0" as const,source,
    scope:"independent-flat-rectangular-shell-source" as const,
    status:"source-ready-analysis-pending" as const,
    conventions:{plane:"XY",surface:"mid-surface",normal:[0,0,1],dofOrder:["ux","uy","uz","rx","ry","rz"],rotation:"physical-right-hand",areaLoadMagnitude:"nonnegative-downward"} as const,
    area,model:{nodes,elements,supports,material:{...m,G},loadComponents:components,loadCases:cases},
    loadPolicy:{frameAllowance:"excluded",frameLoads:"excluded",G:"derived-case-not-additional-component"} as const,
    meshCounts:{nodes:nodes.length,elements:elements.length},
    calculation:null,fullBuildingAnalysis:false as const,technicalApproval:false as const,
  };
}

export type ShellPreparedSource = ReturnType<typeof prepareShellSource>;
export type ShellSourceRecord = { schema:"ARKEM-SHELL-SOURCE-RECORD/1.0";id:string;sha256:string;content:ShellPreparedSource };
export async function recordShellSource(value: unknown): Promise<ShellSourceRecord> {
  const content = prepareShellSource(value), sha256 = await traceSha256(traceJson(content));
  return {schema:"ARKEM-SHELL-SOURCE-RECORD/1.0",id:"SHELL-SOURCE-"+sha256,sha256,content};
}
export async function verifyShellSourceRecord(record: ShellSourceRecord, currentSource: unknown) {
  try {
    const current=prepareShellSource(currentSource),sha256=await traceSha256(traceJson(record.content));
    return record.schema==="ARKEM-SHELL-SOURCE-RECORD/1.0" && record.id==="SHELL-SOURCE-"+sha256 && record.sha256===sha256 && traceJson(current)===traceJson(record.content);
  } catch { return false; }
}
