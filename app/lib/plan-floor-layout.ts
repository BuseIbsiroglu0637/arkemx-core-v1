import type { PlanObject } from "./plan-program-sync";
type Grid = { floors: number; x: number; y: number };
type ProgrammeRoom = { id: string; name: string; count: number };
const cellKey = (e: { level: number; x: number; y: number }) => `${e.level}:${e.x}:${e.y}`;

/** Proposes a reversible allocation of existing programme objects, never creating or deleting them. */
export function planFloorLayout<T extends PlanObject>(elements: T[], rooms: ProgrammeRoom[], grid: Grid) {
  const fail = (reason: string) => ({ valid: false, reason, elements, moved: 0, floors: [] as {level:number; rooms:number}[] });
  if (![grid.floors,grid.x,grid.y].every(n=>Number.isInteger(n)&&n>0&&n<=30)) return fail("Geçerli kat ve aks düzeni gerekli.");
  if (!rooms.length || new Set(rooms.map(r=>r.id)).size!==rooms.length || new Set(rooms.map(r=>r.name)).size!==rooms.length ||
    rooms.some(r=>!r.id||!r.name||!Number.isInteger(r.count)||r.count<1)) return fail("Mahal programı belirsiz.");
  if(new Set(elements.map(e=>e.id)).size!==elements.length) return fail("Tekrarlanan nesne kimliği var.");
  const assignments = new Map<string,number>();
  const totals = Array<number>(grid.floors).fill(0);
  for (const room of rooms) {
    const matches = elements.filter(e=>e.type==="space" && (e.sourceSpaceId ? e.sourceSpaceId===room.id : e.label===room.name));
    if(matches.length!==room.count) return fail("Program ve plan adetlerini önce eşleştirin.");
    const perType = Array<number>(grid.floors).fill(0);
    for(const e of matches) {
      // A single shared entry stays on the first floor; other types are balanced across floors.
      let floor=0;
      if(!(room.name.toLocaleLowerCase("tr-TR")==="ortak giriş"&&room.count===1)) {
        floor=Array.from({length:grid.floors},(_,i)=>i).sort((a,b)=>perType[a]-perType[b]||totals[a]-totals[b]||a-b)[0];
      }
      assignments.set(e.id,floor+1);perType[floor]++;totals[floor]++;
    }
  }
  const fixed = elements.filter(e=>!assignments.has(e.id));
  const occupied=new Set(fixed.filter(e=>["space","core","opening"].includes(e.type)).map(cellKey));
  const proposed = new Map<string,T>();
  // Keep objects already assigned to their existing floor ahead of incoming objects.
  const movable=elements.filter(e=>assignments.has(e.id)).sort((a,b)=>Number(assignments.get(b.id)===b.level)-Number(assignments.get(a.id)===a.level));
  for(const e of movable) {
    const level=assignments.get(e.id)!;
    const cells:{level:number;x:number;y:number}[]=[];
    for(let y=0;y<grid.y;y++)for(let x=0;x<grid.x;x++) if(!occupied.has(cellKey({level,x,y})))cells.push({level,x,y});
    if(!cells.length) return fail("Bir katta yeterli boş hücre yok. Aksları veya kat sayısını gözden geçirin.");
    cells.sort((a,b)=>(a.x-e.x)**2+(a.y-e.y)**2-((b.x-e.x)**2+(b.y-e.y)**2)||a.y-b.y||a.x-b.x);
    const cell=cells[0];occupied.add(cellKey(cell));proposed.set(e.id,{...e,...cell});
  }
  const next=elements.map(e=>proposed.get(e.id)??e);
  const moved=next.filter((e,i)=>e.level!==elements[i].level||e.x!==elements[i].x||e.y!==elements[i].y).length;
  return {valid:true,reason:"Mahal türleri katlara dengeli paylaştırılır; tek ortak giriş K1'de kalır. Çekirdekler ve diğer nesneler sabittir.",elements:next,moved,floors:totals.map((rooms,i)=>({level:i+1,rooms}))};
}
