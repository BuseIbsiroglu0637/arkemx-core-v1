import type { ShellCalculationRecord } from "./shell-solver.ts";
import type { ShellRenderRecord } from "./shell-render.ts";
export type ShellCase = ShellCalculationRecord["content"]["cases"][number];
export const SHELL_FIELDS = ["Uz","Nx","Ny","Nxy","Mxx","Myy","Mxy","Qx","Qy"] as const;
export type ShellField = typeof SHELL_FIELDS[number];
export type ShellView = {caseId:string;field:ShellField;magnification:number;elementId:string};
export function shellFieldUnit(field:ShellField){return field==="Uz"?"m":field.startsWith("M")?"kNm/m":"kN/m";}
export function validateShellView(record:ShellRenderRecord,view:ShellView){
  if(!record.content.cases.some(c=>c.id===view.caseId)||!SHELL_FIELDS.includes(view.field)||!Number.isFinite(view.magnification)||view.magnification<1||view.magnification>10000||!record.content.prepared.model.elements.some(e=>e.id===view.elementId))throw Error("Geçersiz kabuk sonuç görünümü.");
}
export function shellCase(record:ShellRenderRecord,view:ShellView){validateShellView(record,view);return record.content.cases.find(c=>c.id===view.caseId)!;}
export function shellFieldValues(c:ShellCase,field:ShellField){
  return field==="Uz"?c.nodes.map(n=>n.displacements[2]):c.elements.flatMap(e=>e.points.map(p=>p.resultants[SHELL_FIELDS.indexOf(field)-1]));
}
export function shellCellValues(c:ShellCase,field:ShellField,nx:number){
  if(field!=="Uz")return c.elements.map(e=>e.points.reduce((v,p)=>v+p.resultants[SHELL_FIELDS.indexOf(field)-1]/4,0));
  return c.elements.map((_,k)=>{const i=k%nx,j=Math.floor(k/nx),n=j*(nx+1)+i;return [n,n+1,n+nx+2,n+nx+1].reduce((v,id)=>v+c.nodes[id].displacements[2]/4,0);});
}
export function shellColor(value:number,norm:number):[number,number,number]{
 const t=norm===0?0:Math.max(-1,Math.min(1,value/norm));
 const edge=t<0?[35,90,145]:[190,80,35],r=Math.abs(t);
 return edge.map(v=>(246*(1-r)+v*r)/255) as [number,number,number];
}
