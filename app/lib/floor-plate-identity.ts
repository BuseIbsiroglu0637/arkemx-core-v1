type Plate = {level:number;id?:string};
const validId=(id:unknown):id is string=>typeof id==="string"&&id.length>0&&id.trim()===id;
function check<T extends Plate>(plates:T[]){
 const levels=new Set<number>(),ids=new Set<string>();
 for(const p of plates){if(!Number.isInteger(p.level)||p.level<1||levels.has(p.level))throw Error("Döşeme katları geçersiz veya tekrarlı.");levels.add(p.level);
  if(p.id!==undefined){if(!validId(p.id)||ids.has(p.id))throw Error("Döşeme kimliği geçersiz veya tekrarlı.");ids.add(p.id);}}
}
/** Explicit legacy migration only. Geometry and existing identities are preserved. */
export function migrateFloorPlateIds<T extends Plate>(plates:T[],projectId:string):Array<T&{id:string}>{
 if(!validId(projectId))throw Error("Döşeme kimliği için proje kimliği gerekiyor.");check(plates);
 const result=plates.map(p=>({...p,id:p.id??"PLATE:"+encodeURIComponent(projectId)+":LEGACY:K"+p.level}));check(result);return result;
}
/** Rebuilding the same floors retains IDs. A removed floor recreated later gets a new ID. */
export function reconcileFloorPlateIds<T extends Plate>(plates:T[],previous:Plate[],newId:()=>string=()=>"PLATE:"+crypto.randomUUID()):Array<T&{id:string}>{
 check(plates);check(previous);
 const result=plates.map(p=>({...p,id:p.id??previous.find(old=>old.level===p.level)?.id??newId()}));check(result);if(result.some(p=>!validId(p.id)))throw Error("Yeni döşeme kimliği oluşturulamadı.");return result;
}
