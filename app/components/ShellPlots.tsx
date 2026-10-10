"use client";
import {memo} from "react";
import type {ShellCalculationRecord} from "../lib/shell-solver";
import {shellCase,shellCellValues,shellFieldValues,shellColor,shellFieldUnit,type ShellView} from "../lib/shell-view";
export const ShellPlots=memo(function ShellPlots({record,view}:{record:ShellCalculationRecord;view:ShellView}){
 const c=shellCase(record,view),s=record.content.prepared.source,p=s.plate,model=record.content.prepared.model;
 const raw=shellFieldValues(c,view.field),norm=Math.max(...raw.map(Math.abs)),cells=shellCellValues(c,view.field,s.mesh.nx),fit=Math.min(620/p.width,320/p.depth),width=p.width*fit,height=p.depth*fit;
 const projection=(i:number,factor:number)=>{const n=model.nodes[i],u=c.nodes[i].displacements;return {x:n.x-p.origin[0]+factor*u[0]-.35*(n.y-p.origin[1]+factor*u[1]),y:.18*(n.x-p.origin[0]+n.y-p.origin[1]+factor*(u[0]+u[1]))-factor*u[2]};};
 const points=model.nodes.flatMap((_,i)=>[projection(i,0),projection(i,view.magnification)]),minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y)),isoFit=Math.min(620/Math.max(1,maxX-minX),320/Math.max(1,maxY-minY)),ids=new Map(model.nodes.map((n,i)=>[n.id,i]));
 return <div className="shell-plots">
  <figure><figcaption>{view.field} haritası ({shellFieldUnit(view.field)}) · {c.id}</figcaption>
   <svg viewBox="0 0 700 380" role="img" aria-label="Kabuk sonuç alanı haritası">{cells.map((v,i)=>{const color=shellColor(v,norm).map(v=>Math.round(v*255));return <rect key={i} x={40+i%s.mesh.nx*width/s.mesh.nx} y={30+height-(Math.floor(i/s.mesh.nx)+1)*height/s.mesh.ny} width={width/s.mesh.nx} height={height/s.mesh.ny} fill={`rgb(${color.join(",")})`} stroke="#819297" strokeWidth=".2"><title>{model.elements[i].id}: hücre ortalaması {v.toExponential(5)} {shellFieldUnit(view.field)}</title></rect>;})}<text x="40" y="370">X →; Y ↑; {p.width} × {p.depth} m; Z={p.origin[2]} m</text></svg>
   <p>Ham min / max: {Math.min(...raw).toExponential(5)} / {Math.max(...raw).toExponential(5)} {shellFieldUnit(view.field)}. Mavi: negatif; bakır: pozitif; açık renk: sıfır. Renkler yeterlilik kararı değildir.</p>
   <p>{view.field==="Uz"?"Dört köşe düğümünün hücre ortalaması":"Dört Gauss noktasının hücre ortalaması"}. Ham değerler aşağıdaki tablolarda ve JSON’da korunur.</p>
  </figure>
  <figure><figcaption>Deforme ağ · büyütme ×{view.magnification}</figcaption><svg viewBox="0 0 700 380" role="img" aria-label="Büyütülmüş kabuk deformasyonu">{[0,view.magnification].flatMap(factor=>model.elements.map(e=><polygon key={factor+e.id} points={e.nodeIds.map(id=>{const p=projection(ids.get(id)!,factor);return `${40+(p.x-minX)*isoFit},${35+(p.y-minY)*isoFit}`;}).join(" ")} fill="none" stroke={factor===0?"#9badb1":"#b96637"} strokeWidth={factor===0?.4:.8}/>))}</svg><p>Gri kaynak ağ, bakır deforme ağ. Şematik izdüşüm; gerçek öteleme m, dönme rad birimindedir.</p></figure>
 </div>;
});
