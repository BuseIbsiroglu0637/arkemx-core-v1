import { briefSiteContext } from './brief-site-context.ts';
import { createParcelRecord, parcelIdentityKey, type ParcelIdentity, type ParcelSourceKind } from './parcel-record.ts';
import { planningForParcel, restorePlanningScopes } from './parcel-zoning-scope.ts';
import { zoningReviewMissing } from './zoning-review.ts';
import { createParcelConcept } from './parcel-concept.ts';
import { createZoningMassingModel, type ParcelFrontEdge } from './zoning-massing.ts';
import type { GeoPoint } from './geo.ts';
const object = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
export function massingContext(projectId: string, modules: Record<string, unknown>) {
 const brief = briefSiteContext(projectId, modules), geo = object(modules['geo-parcel']), raw = object(geo.parcelRecord), evidence = object(raw.evidence);
 const identity = Object.fromEntries(['province','district','neighborhood','block','parcelNo'].map(k=>[k,typeof geo[k]==='string'?geo[k]:''])) as ParcelIdentity;
 const points = geo.parcel;
 const kind = evidence.sourceKind;
 const sourceIdentity = object(evidence.sourceIdentity);
 const sourceIdentityReady = ['province','district','neighborhood','block','parcelNo'].every(k=>typeof sourceIdentity[k]==='string');
 const pointValid = (p: unknown): p is GeoPoint => {const v=object(p);return typeof v.lat==='number' && Number.isFinite(v.lat) && Math.abs(v.lat)<=90 && typeof v.lng==='number' && Number.isFinite(v.lng) && Math.abs(v.lng)<=180 && (v.alt===undefined || typeof v.alt==='number' && Number.isFinite(v.alt));};
 let record: ReturnType<typeof createParcelRecord> | null = null;
 if (Object.values(identity).every(v=>v.trim().length>0) && raw.projectEligible===true && geo.needsReview!==true && evidence.identityMatches!==false && ['EPSG:4326 / WGS84','WGS84 / EPSG:4326','EPSG:4326'].includes(String(geo.sourceCrs)) && ['tkgm-open-service','user-file','manual-drawing'].includes(String(kind)) && Array.isArray(points) && points.length<=400 && points.every(pointValid)
  && parcelIdentityKey(identity)===parcelIdentityKey(object(raw.identity) as ParcelIdentity)
  && JSON.stringify(points)===JSON.stringify(object(raw.geometry).points)
  && (kind!=='tkgm-open-service' || sourceIdentityReady)) {
   const candidate=createParcelRecord({identity,geometry:points,source:{kind:kind as ParcelSourceKind,authority:String(evidence.authority??''),label:String(evidence.label??''),capturedAt:String(evidence.capturedAt??''),url:String(evidence.url??''),...(sourceIdentityReady?{identity:sourceIdentity as ParcelIdentity}:{})}});
   if(candidate.projectEligible && candidate.geometry.valid) record=candidate;
 }
 const draft=planningForParcel(restorePlanningScopes(geo.planningScopes),parcelIdentityKey(identity));
 const geometryKey=JSON.stringify([geo.sourceCrs,kind,evidence.capturedAt,points]);
 const zoningReady=Boolean(record && draft.mode!=='concept' && zoningReviewMissing(draft,geometryKey).length===0);
 const usage=typeof geo.usage==='string' && geo.usage ? geo.usage : brief?.usage || 'Belirtilmedi';
 const system=typeof geo.system==='string' && geo.system ? geo.system : brief?.system || 'Karar Bekleniyor';
 const floorHeight=typeof geo.floorHeight==='number' && geo.floorHeight>=2.6 && geo.floorHeight<=12?geo.floorHeight:3.4;
 const frontEdge:ParcelFrontEdge=['north','east','south','west'].includes(String(geo.frontEdge))?geo.frontEdge as ParcelFrontEdge:'north';
 const signature=JSON.stringify([projectId,brief?.signature??null,record?.identity??null,record?.geometry.points??null,[geo.selectedMassingId??null,geo.building??null,geo.floors??null],evidence.sourceKind??null,evidence.capturedAt??null,draft,usage,system,floorHeight,frontEdge]);
 return {projectId,brief,record,draft,zoningReady,usage,system,floorHeight,floorHeightAssumed:!(typeof geo.floorHeight==='number' && geo.floorHeight>=2.6 && geo.floorHeight<=12),frontEdge,signature, gisPlacement:record && geo.hasPlacedModel===true && typeof object(geo.metrics).gross==='number'?Number(object(geo.metrics).gross):null};
}
export type MassingContext = ReturnType<typeof massingContext>;
export type MassingMode = 'concept' | 'zoning';
export function massingAlternatives(context:MassingContext, mode:MassingMode, floorHeight:number, frontEdge:ParcelFrontEdge) {
 if(!context.record || !Number.isFinite(floorHeight) || floorHeight<2.6 || floorHeight>12 || !['north','east','south','west'].includes(frontEdge) || !['concept','zoning'].includes(mode) || mode==='zoning'&&!context.zoningReady) return null;
 const {reference,geometry}=context.record;
 return mode==='concept'?createParcelConcept(reference,geometry.points,floorHeight,frontEdge):createZoningMassingModel({reference,parcel:geometry.points,zoning:context.draft.zoning,netPlotArea:context.draft.netPlotArea,floorHeight,frontEdge});
}
export function restoreMassingSelection(value:unknown,context:MassingContext) {
 const raw=object(value),input=object(raw.input);
 if(raw.schema!=='ARKEM-MAS/1' || raw.projectId!==context.projectId || raw.sourceSignature!==context.signature || raw.authoritative!==false || !['concept','zoning'].includes(String(input.mode)) || typeof input.floorHeight!=='number') return null;
 const mode=input.mode as MassingMode, floorHeight=Number(input.floorHeight),frontEdge=input.frontEdge as ParcelFrontEdge;
 const model=massingAlternatives(context,mode,floorHeight,frontEdge);
 const choice=model?.alternatives.find(a=>a.id===input.selectedId && a.status==='fits');
 const result=object(raw.result),source=object(raw.source);
 if(!choice || raw.zoningPending!==(mode==='concept') || result.valid!==true || result.gross!==choice.grossArea || result.footprint!==choice.footprint || result.floors!==choice.floors || result.plot!==context.record?.geometry.computedArea || JSON.stringify(result.polygon)!==JSON.stringify(savedPoints(choice.polygon)) || source.reference!==context.record?.reference || JSON.stringify(source.points)!==JSON.stringify(savedPoints(context.record?.geometry.points??[]))) return null;
 return {mode,floorHeight,frontEdge,selectedId:choice.id};
}
const savedPoints=(points:GeoPoint[])=>points.map(p=>({lat:p.lat,lng:p.lng,...(typeof p.alt==='number'&&Number.isFinite(p.alt)?{alt:p.alt}:{})}));
export function massingSnapshot(context:MassingContext,input:{mode:MassingMode;floorHeight:number;frontEdge:ParcelFrontEdge;selectedId:string}) {
 const model=massingAlternatives(context,input.mode,input.floorHeight,input.frontEdge);
 const choice=model?.alternatives.find(a=>a.id===input.selectedId && a.status==='fits');
 if(!context.record || !model || !choice) return null;
 return {schema:'ARKEM-MAS/1',projectId:context.projectId,sourceSignature:context.signature,authoritative:false,status:'massing-draft',
  input:{...input,use:context.usage,system:context.system,width:null,depth:null,setback:null,slope:null,orientation:choice.rotation,floors:choice.floors,scheme:choice.label,planning:input.mode==='zoning'?{maxCoverage:context.draft.zoning.taks,maxFar:context.draft.zoning.kaks,maxHeight:context.draft.zoning.hmax}:null},
  source:{reference:context.record.reference,kind:context.record.evidence.sourceKind,capturedAt:context.record.evidence.capturedAt,area:context.record.geometry.computedArea,points:savedPoints(context.record.geometry.points)},
  result:{valid:true,plot:context.record.geometry.computedArea,footprint:choice.footprint,gross:choice.grossArea,floors:choice.floors,width:choice.width,depth:choice.depth,polygon:savedPoints(choice.polygon)},
  zoningPending:input.mode==='concept',limitations:model.limitations};
}
