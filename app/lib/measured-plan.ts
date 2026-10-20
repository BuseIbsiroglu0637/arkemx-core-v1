import type { PlanObject } from "./plan-program-sync";
export type Rect = { x:number; y:number; width:number; depth:number };
export type RoomGeometry = Rect & { area:number; doorWidth:number; side:"top"|"bottom"; signature:string; route:{x:number;y:number}[] };
export type CorridorGeometry = Rect & { doorX:number; doorWidth:number; signature:string };
export type MeasuredElement = PlanObject & { roomWidth?:number; doorWidth?:number; roomGeometry?:RoomGeometry; corridorGeometry?:CorridorGeometry };
export type MeasuredGrid = { floors:number; baysX:number; baysY:number; spanX:number; spanY:number; corridorWidth:number };
type SourceRoom = {id:string;name:string;count:number;unitArea:number};
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"?v as Record<string,unknown>:{};
export function measuredRooms(source:unknown):SourceRoom[] {
  const raw=rec(source); if(raw.needsReview===true||!Array.isArray(raw.spaces))return [];
  return raw.spaces.map(rec).map(r=>({id:String(r.id??""),name:String(r.name??""),count:Number(r.count),unitArea:Number(r.unitArea)}));
}
export function measurementSignature(elements:MeasuredElement[],source:unknown,grid:MeasuredGrid) {
  return JSON.stringify({grid,rooms:measuredRooms(source),objects:elements.map(e=>[e.id,e.type,e.level,e.x,e.y,e.sourceSpaceId??"",e.type==="space"?e.label:"",e.roomWidth??null,e.doorWidth??null])});
}
export function measuredCurrent(elements:MeasuredElement[],source:unknown,grid:MeasuredGrid) {
  const expected=createMeasuredPlan(elements,source,grid);
  return expected.valid && elements.some(e=>e.type==="space") && elements.every((e,i)=>
    JSON.stringify(e.roomGeometry)===JSON.stringify(expected.elements[i].roomGeometry) &&
    JSON.stringify(e.corridorGeometry)===JSON.stringify(expected.elements[i].corridorGeometry));
}
export function rectOverlap(a:Rect,b:Rect) {
  return a.x<b.x+b.width-1e-7&&a.x+a.width>b.x+1e-7&&a.y<b.y+b.depth-1e-7&&a.y+a.depth>b.y+1e-7;
}
export function createMeasuredPlan<T extends MeasuredElement>(elements:T[],source:unknown,grid:MeasuredGrid) {
  const fail=(reason:string)=>({valid:false,reason,elements});
  const rooms=measuredRooms(source);
  if(!rooms.length||new Set(rooms.map(r=>r.id)).size!==rooms.length||new Set(rooms.map(r=>r.name)).size!==rooms.length||
    rooms.some(r=>!r.id||!r.name||!Number.isInteger(r.count)||r.count<1||!Number.isFinite(r.unitArea)||r.unitArea<2||r.unitArea>250))return fail("Geçerli mahal alanı ve adetleri gerekli.");
  if(![grid.floors,grid.baysX,grid.baysY].every(n=>Number.isInteger(n)&&n>0&&n<=30)||
    ![grid.spanX,grid.spanY,grid.corridorWidth].every(n=>Number.isFinite(n)&&n>0)||
    grid.corridorWidth<.9||grid.corridorWidth>3)return fail("Koridor genişliği 0,90–3,00 m ve aks ölçüleri geçerli olmalı.");
  if(new Set(elements.map(e=>e.id)).size!==elements.length)return fail("Nesne kimlikleri benzersiz olmalı.");
  const programme=new Map<string,SourceRoom>();
  for(const r of rooms) {
    const matches=elements.filter(e=>e.type==="space"&&(e.sourceSpaceId?e.sourceSpaceId===r.id:e.label===r.name));
    if(matches.length!==r.count)return fail("Önce program ve plan mahal adetlerini eşleştirin.");
    matches.forEach(e=>programme.set(e.id,r));
  }
  if(elements.some(e=>e.type==="space"&&!programme.has(e.id)))return fail("Alanı bilinmeyen manuel mahali önce mimari programa ekleyin.");
  if(elements.some(e=>!Number.isInteger(e.level)||e.level<1||e.level>grid.floors))return fail("Plan dışında kalan kat nesnelerini düzenleyin.");
  const width=grid.baysX*grid.spanX,depth=grid.baysY*grid.spanY,signature=measurementSignature(elements,source,grid);
  const proposed=new Map<string,T>();
  const fixedRect=(e:T):Rect=> e.type==="column"?{x:e.x*grid.spanX-.25,y:e.y*grid.spanY-.25,width:.5,depth:.5}:
    e.type==="wall"?{x:e.x*grid.spanX-.125,y:e.y*grid.spanY-.125,width:(e as T&{orientation?:string}).orientation==="y"?.25:grid.spanX+.25,depth:(e as T&{orientation?:string}).orientation==="y"?grid.spanY+.25:.25}:
    {x:e.x*grid.spanX,y:e.y*grid.spanY,width:grid.spanX,depth:grid.spanY};
  for(let level=1;level<=grid.floors;level++) {
    const onFloor=elements.filter(e=>e.level===level),cores=onFloor.filter(e=>e.type==="core");
    if(cores.length!==1)return fail("Bu taslak her katta tek çekirdek gerektiriyor. Çekirdek düzenini gözden geçirin.");
    const core=cores[0],coreRect=fixedRect(core),corridorY=coreRect.y+coreRect.depth;
    if(coreRect.width<1.3||coreRect.x<0||coreRect.y<0||coreRect.x+coreRect.width>width||corridorY+grid.corridorWidth>=depth)return fail("Çekirdek kapısı ve altındaki koridor için yeterli alan yok.");
    const corridor:CorridorGeometry={x:0,y:corridorY,width,depth:grid.corridorWidth,doorX:coreRect.x+coreRect.width/2,doorWidth:.9,signature};
    const fixed=onFloor.filter(e=>!programme.has(e.id)&&!["load"].includes(e.type)).map(fixedRect);
    if(fixed.some(r=>rectOverlap(r,corridor)))return fail("Koridor sabit bir nesneyle çakışıyor. Taslak uygulanmadı.");
    const bands=[{side:"bottom" as const,limit:corridorY,start:0,end:corridorY},{side:"top" as const,limit:depth-corridorY-grid.corridorWidth,start:corridorY+grid.corridorWidth,end:depth}];
    const slots:{start:number;end:number;band:number}[]=[];
    bands.forEach((band,i)=>{
      let intervals=[{start:0,end:width}];
      for(const f of fixed.filter(f=>f.y<band.end-1e-7&&f.y+f.depth>band.start+1e-7)) intervals=intervals.flatMap(s=>{
        if(f.x>=s.end||f.x+f.width<=s.start)return [s];
        return [{start:s.start,end:Math.max(s.start,f.x-.15)},{start:Math.min(s.end,f.x+f.width+.15),end:s.end}].filter(p=>p.end-p.start>.1);
      });
      slots.push(...intervals.map(s=>({...s,band:i})));
    });
    const floorRooms=onFloor.filter(e=>programme.has(e.id)).map(e=>{
      const r=programme.get(e.id)!,w=e.roomWidth??Math.min(6,Math.max(2,Math.sqrt(r.unitArea*1.2)));
      return {e,w,d:r.unitArea/w,area:r.unitArea,door:e.doorWidth??.9};
    }).sort((a,b)=>b.w-a.w||a.e.id.localeCompare(b.e.id));
    for(const item of floorRooms) {
      if(![item.w,item.d,item.door].every(Number.isFinite)||item.w<1.2||item.d<1.2||item.d<item.door+.1||item.door<.6||item.door>1.5||item.w<item.door+.4)return fail("Oda eni, derinliği veya kapı ölçüsü yerleşime uygun değil.");
      const candidates=slots.map((s,index)=>({s,index,x:Math.max(s.start,Math.min(item.e.x*grid.spanX,s.end-item.w))}))
        .filter(c=>c.s.end-c.s.start>=item.w-1e-7&&bands[c.s.band].limit>=item.d-1e-7)
        .sort((a,b)=>Math.abs(a.x-item.e.x*grid.spanX)+Math.abs(bands[a.s.band].start-item.e.y*grid.spanY)-
          (Math.abs(b.x-item.e.x*grid.spanX)+Math.abs(bands[b.s.band].start-item.e.y*grid.spanY))||a.index-b.index);
      if(!candidates.length)return fail("Oda ölçüleri mevcut koridor çevresine sığmıyor. Enleri veya aks düzenini gözden geçirin.");
      const c=candidates[0],band=bands[c.s.band],x=c.x,y=band.side==="bottom"?corridorY-item.d:corridorY+grid.corridorWidth;
      const doorX=x+item.w/2,doorY=band.side==="bottom"?corridorY:corridorY+grid.corridorWidth;
      const geometry:RoomGeometry={x,y,width:item.w,depth:item.d,area:item.area,doorWidth:item.door,side:band.side,signature,
        route:[{x:doorX,y:doorY},{x:doorX,y:corridorY+grid.corridorWidth/2},{x:corridor.doorX,y:corridorY+grid.corridorWidth/2},{x:corridor.doorX,y:corridorY}]};
      proposed.set(item.e.id,{...item.e,roomGeometry:geometry});
      slots.splice(c.index,1,...[{start:c.s.start,end:x-.15,band:c.s.band},{start:x+item.w+.15,end:c.s.end,band:c.s.band}].filter(s=>s.end-s.start>.1));
    }
    proposed.set(core.id,{...core,corridorGeometry:corridor});
  }
  return {valid:true,reason:"Program alanları korundu; her kapı koridor üzerinden çekirdeğe bağlandı.",elements:elements.map(e=>proposed.get(e.id)??e)};
}
