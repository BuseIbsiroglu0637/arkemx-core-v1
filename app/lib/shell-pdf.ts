import fontkit from "@pdf-lib/fontkit";
import { PDFDocument,rgb,type PDFPage,type PDFFont } from "pdf-lib";
import { shellPackage,type ShellManifest } from "./shell-documents.ts";
import type { ShellCalculationRecord } from "./shell-solver.ts";
import {shellCase,shellCellValues,shellFieldValues,shellColor,shellFieldUnit} from "./shell-view.ts";
export type ShellPdfAssets={regularFont:Uint8Array;boldFont:Uint8Array};
async function assets(){const rows=await Promise.all(["/fonts/ArkemSans-Regular.ttf","/fonts/ArkemSans-Bold.ttf"].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error("Kabuk raporu yazı tipi yüklenemedi.");return new Uint8Array(await r.arrayBuffer());}));return {regularFont:rows[0],boldFont:rows[1]};}
export async function shellPdf(manifest:ShellManifest,record:ShellCalculationRecord,supplied?:ShellPdfAssets){
 return renderShellPdf(manifest,record,{title:"ARKEMX - Örnek kabuk sonuçları",banner:"ÖRNEK MODEL - Gerçek proje, tam bina analizi ve teknik onay değildir.",attachmentName:"arkemx-shell-package.json",package:JSON.stringify(shellPackage(manifest,record)),identityLines:[]},supplied);
}
export async function renderShellPdf(manifest:import("./shell-render.ts").ShellRenderManifest,record:import("./shell-render.ts").ShellRenderRecord,context:{title:string;banner:string;attachmentName:string;package:string;identityLines:string[]},supplied?:ShellPdfAssets){
 const document=await PDFDocument.create();document.registerFontkit(fontkit);
 const a=supplied??await assets(),regular=await document.embedFont(a.regularFont,{subset:true}),bold=await document.embedFont(a.boldFont,{subset:true});
 document.setTitle(context.title);document.setCreationDate(new Date("2000-01-01T00:00:00Z"));document.setModificationDate(new Date("2000-01-01T00:00:00Z"));
 await document.attach(new TextEncoder().encode(context.package),context.attachmentName,{mimeType:"application/json",description:context.banner});
 const c=shellCase(record,manifest.view),s=manifest.source,p=s.plate,model=record.content.prepared.model,W=841.89,H=595.28;
 const number=(v:number)=>v.toExponential(5);
 function text(page:PDFPage,value:string,x:number,y:number,size=10,font:PDFFont=regular,color=rgb(.1,.2,.25)){
  // Wrap every long line without losing the source/calculation identity.
  const width=W-36-x;let line="",yy=y;
  for(const character of value){if(font.widthOfTextAtSize(line+character,size)>width&&line){page.drawText(line,{x,y:yy,size,font,color});line="";yy-=size*1.35;}line+=character;}
  page.drawText(line,{x,y:yy,size,font,color});return yy-size*1.5;
 }
 function page(title:string){const pg=document.addPage([W,H]);pg.drawRectangle({x:0,y:H-72,width:W,height:72,color:rgb(.08,.18,.24)});text(pg,"ARKEMX | "+title,36,H-38,19,bold,rgb(1,1,1));text(pg,context.banner,36,H-95,11,bold,rgb(.65,.24,.12));text(pg,"Hesap: "+record.id,36,28,7);text(pg,"Sayfa "+document.getPageCount(),W-93,28,8);return pg;}
 function table(title:string,headers:string[],rows:string[][]){
  const per=24,col=(W-72)/headers.length;
  for(let offset=0;offset<Math.max(1,rows.length);offset+=per){
   const pg=page(title),start=H-137;pg.drawRectangle({x:36,y:start-6,width:W-72,height:25,color:rgb(.87,.92,.93)});
   headers.forEach((h,i)=>text(pg,h,42+i*col,start,9,bold));
   rows.slice(offset,offset+per).forEach((r,j)=>r.forEach((v,i)=>{let size=9;while(size>6&&regular.widthOfTextAtSize(v,size)>col-12)size-=.25;let label=v,take=Math.floor(v.length/2);while(regular.widthOfTextAtSize(label,size)>col-12&&take>0){label=v.slice(0,take)+"…"+v.slice(-take);take--;}pg.drawText(label,{x:42+i*col,y:start-28-j*15,size,font:regular,color:rgb(.1,.2,.25)});}));
   text(pg,"Yük: "+c.id+" | Satırlar "+(offset+1)+"-"+Math.min(rows.length,offset+per)+" / "+rows.length,36,55,9);
  }
 }
 let pg=page("Kabuk kaynak ve sonuç özeti");let y=H-125;
 const rows=[
  ...context.identityLines,
  "Kaynak: "+s.projectId+" / "+s.revision+" / "+s.schema,
  "Plaka "+p.id+": "+p.width+" x "+p.depth+" m; h="+p.thickness+" m; orta yüzey Z="+p.origin[2]+" m",
  "Malzeme E="+s.material.E+" kN/m²; nu="+s.material.nu+"; gamma="+s.material.unitWeight+" kN/m³",
  "Mesnet "+s.supports.preset+"; ağ "+s.mesh.nx+" x "+s.mesh.ny+"; düğüm/eleman "+model.nodes.length+"/"+model.elements.length,
  "Yük durumu "+c.id+": "+c.areaLoad+" kN/m²; toplam aşağı yük "+(-model.loadCases.find(v=>v.id===c.id)!.totalVerticalForce)+" kN",
  "G_SW: gamma*h; G_SUP: ek sabit; G=G_SW+G_SUP. Çerçeve ağırlığı bu bağımsız plaka kapsamında yok.",
  "Merkez Uz="+number(c.centerUz)+" m; en büyük |Uz|="+number(c.maxAbsUz)+" m",
  "Kuvvet denge artığı="+number(c.equilibrium.forceResidual)+"; moment denge artığı="+number(c.equilibrium.momentResidual),
  "Sonuç alanı "+manifest.view.field+" ("+shellFieldUnit(manifest.view.field)+"); deforme görünüm x"+manifest.view.magnification,
  "Moment işareti M=-D*kappa; öteleme m, dönme rad, reaksiyon kN/kNm. Yüzey normal +Z.",
  "Formülasyon: "+record.content.engine+"; 2x2 Gauss, MITC kesme, 5/6 düzeltme; drilling alpha="+record.content.formulation.drillingFactor,
  "Bu oturumda bağımsız referans veya ağ yakınsaması çalıştırılmadı. Mühendislik değerlendirmesi ayrıca gerekir.",
  "Tam girdi, mesnetler, düğüm/eleman kimlikleri, beş yük durumunun ham sonuçları gömülü JSON ekindedir.",
  "Tablolarda uzun kimlikler … ile kısaltılabilir; tam kimlikler gömülü JSON ekindedir.",
  "Kaynak SHA-256: "+manifest.sourceSha256,
 ];
 rows.forEach(row=>{
  let line="";
  const draw=()=>{if(y<75){pg=page("Kaynak ve sonuç özeti (devam)");y=H-125;}pg.drawText(line,{x:36,y,size:10,font:regular,color:rgb(.1,.2,.25)});y-=15;line="";};
  for(const char of row){if(regular.widthOfTextAtSize(line+char,10)>W-72&&line)draw();line+=char;}
  draw();y-=6;
 });
 const map=page("Seçilen sonuç alanı ve ağ"),values=shellCellValues(c,manifest.view.field,s.mesh.nx),raw=shellFieldValues(c,manifest.view.field),norm=Math.max(...raw.map(Math.abs)),mapFit=Math.min(620/p.width,320/p.depth),dx=p.width*mapFit/s.mesh.nx,dy=p.depth*mapFit/s.mesh.ny,mapLeft=(W-p.width*mapFit)/2;
 values.forEach((v,i)=>{const color=shellColor(v,norm);map.drawRectangle({x:mapLeft+(i%s.mesh.nx)*dx,y:155+Math.floor(i/s.mesh.nx)*dy,width:dx,height:dy,color:rgb(...color),borderColor:rgb(.5,.6,.6),borderWidth:.15});});
 text(map,manifest.view.field+" ("+shellFieldUnit(manifest.view.field)+") | ham min="+number(Math.min(...raw))+" / max="+number(Math.max(...raw)),36,115,10);
 text(map,"Harita: "+(manifest.view.field==="Uz"?"dört köşe düğümünün hücre ortalaması":"dört Gauss noktasının hücre ortalaması")+". Ham değerler JSON ve aşağıdaki tabloda; renkler tasarım yeterliliği göstermez.",36,93,9);
 text(map,"X ->; Y yukarı; görüntü "+p.width+" x "+p.depth+" m. Kaynak plaka: "+p.id,36,65,9);
 const deform=page("Büyütülmüş deformasyon");const scale=manifest.view.magnification,byId=new Map(model.nodes.map((n,i)=>[n.id,{...n,i}]));
 const projection=(n:{x:number;y:number;z:number;i:number},factor:number)=>{const u=c.nodes[n.i].displacements;return {x:n.x-p.origin[0]+factor*u[0]-.35*(n.y-p.origin[1]+factor*u[1]),y:.18*(n.x-p.origin[0]+n.y-p.origin[1]+factor*(u[0]+u[1]))-factor*u[2]};};
 const points=model.nodes.flatMap((n,i)=>[projection({...n,i},0),projection({...n,i},scale)]),minX=Math.min(...points.map(n=>n.x)),maxX=Math.max(...points.map(n=>n.x)),minY=Math.min(...points.map(n=>n.y)),maxY=Math.max(...points.map(n=>n.y)),fit=Math.min(680/Math.max(1,maxX-minX),310/Math.max(1,maxY-minY));
 for(const f of [0,scale])for(const e of model.elements)e.nodeIds.forEach((id,k)=>{const a=projection(byId.get(id)!,f),b=projection(byId.get(e.nodeIds[(k+1)%4])!,f);deform.drawLine({start:{x:80+(a.x-minX)*fit,y:180+(maxY-a.y)*fit},end:{x:80+(b.x-minX)*fit,y:180+(maxY-b.y)*fit},thickness:f===0?.3:.65,color:f===0?rgb(.6,.65,.65):rgb(.72,.33,.12)});});
 text(deform,"Gri: kaynak ağ. Bakır: deforme ağ x"+scale+". Kaynak orta yüzey Z="+p.origin[2]+" m.",36,115,10);
 text(deform,"İzometrik şema; deformasyon büyütülmüştür. Gerçek düğüm ötelemeleri JSON'da m birimindedir.",36,93,10);
 table("Beş ayrı yük durumunun özeti",["Durum","q (kN/m²)","Merkez Uz (m)","Max |Uz| (m)","Kuvvet artığı","Moment artığı"],record.content.cases.map(v=>[v.id,number(v.areaLoad),number(v.centerUz),number(v.maxAbsUz),number(v.equilibrium.forceResidual),number(v.equilibrium.momentResidual)]));
 const supportIds=new Set(model.supports.map(v=>v.nodeId));table("Seçilen yükün mesnet reaksiyonları",["Düğüm","Fx (kN)","Fy (kN)","Fz (kN)","Mx (kNm)","My (kNm)","Mz (kNm)"],c.nodes.filter(v=>supportIds.has(v.id)).map(n=>[n.id,...n.reactions.map(number)]));
 const element=c.elements.find(e=>e.id===manifest.view.elementId)!;table("Seçilen elemanın ham Gauss sonuçları",["GP / xi / eta","Nx (kN/m)","Ny (kN/m)","Nxy (kN/m)","Mxx (kNm/m)","Myy (kNm/m)","Mxy (kNm/m)","Qx (kN/m)","Qy (kN/m)"],element.points.map((v,i)=>[(i+1)+" / "+v.xi.toFixed(3)+" / "+v.eta.toFixed(3),...v.resultants.map(number)]));
 return document.save();
}
