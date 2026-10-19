import { createSafeCsv } from './safe-csv.ts';
export type ProgrammeSpace = { id:string; code:string; name:string; zone:string; count:number; unitArea:number; density:number; daylight:boolean; accessible:boolean };
export type ProgrammeRelationship = { id:string; from:string; to:string; priority:'Zorunlu'|'Tercih'; confirmed:boolean };
export function programmeIssues(spaces:ProgrammeSpace[]) {
 const names=spaces.map(s=>s.name.trim().toLocaleLowerCase('tr-TR'));
 return spaces.flatMap((s,i)=>!names[i]?[`${s.code}: mahal adı gerekli.`]:names.indexOf(names[i])!==i?[`${s.code}: mahal adları farklı olmalı.`]:[]);
}
export function nextProgrammeCode(spaces:ProgrammeSpace[]) {
 let index=1; const used=new Set(spaces.map(s=>s.code));
 while(used.has(`A-${String(index).padStart(3,'0')}`))index++;
 return `A-${String(index).padStart(3,'0')}`;
}
export function renameProgrammeRelationships(spaces:ProgrammeSpace[], relationships:ProgrammeRelationship[], id:string, name:string){
 const old=spaces.find(s=>s.id===id);
 if(!old||spaces.filter(s=>s.name===old.name).length!==1)return relationships;
 return relationships.map(r=>({...r,from:r.from===old.name?name:r.from,to:r.to===old.name?name:r.to}));
}
export function removeProgrammeSpace(spaces:ProgrammeSpace[],relationships:ProgrammeRelationship[],id:string){
 const space=spaces.find(s=>s.id===id);
 const remaining=spaces.filter(s=>s.id!==id);
 const removed=space&&!remaining.some(s=>s.name===space.name)?relationships.filter(r=>r.from===space.name||r.to===space.name):[];
 return {spaces:remaining,relationships:relationships.filter(r=>!removed.includes(r)),deleted:space?{space,index:spaces.indexOf(space),relationships:removed}:null};
}
export function programmeCsv(spaces:ProgrammeSpace[]) {
 return createSafeCsv([['code','name','zone','count','unit_area_m2','total_area_m2','occupancy_density_m2_person','daylight','accessible'],...spaces.map(s=>[s.code,s.name,s.zone,s.count,s.unitArea.toFixed(2),(s.count*s.unitArea).toFixed(2),s.density.toFixed(2),s.daylight,s.accessible])]);
}
export function restoreProgrammeSpace(spaces:ProgrammeSpace[],relationships:ProgrammeRelationship[],deleted:ReturnType<typeof removeProgrammeSpace>['deleted']) {
 if(!deleted||spaces.some(s=>s.id===deleted.space.id))return {spaces,relationships};
 const restored={...deleted.space,code:spaces.some(s=>s.code===deleted.space.code)?nextProgrammeCode(spaces):deleted.space.code};
 const next=[...spaces];next.splice(Math.min(deleted.index,next.length),0,restored);
 return {spaces:next,relationships:[...relationships,...deleted.relationships.filter(r=>!relationships.some(item=>item.id===r.id))]};
}
