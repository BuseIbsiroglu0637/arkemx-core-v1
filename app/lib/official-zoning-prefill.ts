import type { ZoningForm } from './zoning.ts';
import type { OfficialZoningResult } from './kastamonu-zoning.ts';
import type { LandZoningDeclaration } from './land-zoning-declaration.ts';
const sourceUrl='https://e-imar.kastamonuozelidare.gov.tr/arcgis/rest/services/IDARE_PUBLIC/IMAR_PUBLIC/FeatureServer/1826';
export function officialZoningPrefill(current:ZoningForm,result:OfficialZoningResult,listing?:LandZoningDeclaration|null):ZoningForm|null {
  if(result.schema!=='ARKEM-OFFICIAL-ZONING/1.0'||result.status!=='found'||!result.conditions||result.source?.url!==sourceUrl||!result.source.planId||result.source.planStatus!=='Onaylandi'||!/^\d{4}-\d{2}-\d{2}$/.test(result.source.approvalDate)) return null;
  if(current.expertReviewStatus!=='not-reviewed'||current.sourceDocument||!['user-declared','municipal-viewer'].includes(current.verification)) return null;
  const numbers=['taks','kaks','hmax','frontSetback','sideSetback','rearSetback'] as const;
  const empty=!current.sourceType&&!current.sourceUrl&&!current.sourceNote&&numbers.every(k=>current[k]<0)&&!current.landUse;
  const untouchedListing=listing&&current.sourceType==='İlan beyanı'&&current.sourceUrl===listing.sourceUrl&&current.sourceNote.startsWith('Otomatik ilan aktarımı')&&['taks','kaks','hmax'].every(key=>{const k=key as 'taks'|'kaks'|'hmax';return current[k]===(listing[k]??-1);})&&current.landUse===listing.landUse&&current.frontSetback<0&&current.sideSetback<0&&current.rearSetback<0;
  if((!empty&&!untouchedListing)||current.planId||current.planName||current.planScale||current.buildingOrder||current.sourceDate||current.planNoteReference) return null;
  const c=result.conditions;
  for(const [value,max] of [[c.taks,1],[c.kaks,10],[c.hmax,250],[c.frontSetback,100],[c.sideSetback,100]]) if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number(max))) return null;
  return {...current,taks:c.taks??-1,kaks:c.kaks??-1,hmax:c.hmax??-1,frontSetback:c.frontSetback??-1,sideSetback:c.sideSetback??-1,rearSetback:-1,landUse:c.landUse,buildingOrder:c.buildingOrder,
    planId:result.source.planId,planName:result.source.planName,planScale:result.source.planScale,sourceType:'Resmî e-İmar servisi',sourceUrl:result.source.url,sourceDate:result.source.approvalDate,
    sourceNote:`${result.source.authority} · kayıt ${result.source.featureId} · otomatik okuma ${result.retrievedAt}. Plan notu ve yetkili idare doğrulaması bekleniyor.`,verification:'municipal-viewer',expertReviewStatus:'not-reviewed'};
}
