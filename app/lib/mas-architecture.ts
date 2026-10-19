import { massingContext, massingSnapshot, massingAlternatives, restoreMassingSelection } from './massing-workspace.ts';
const object=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
export type ArchitectureUse='industrial'|'office'|'residential'|'education';
export function architectureUse(usage:string):ArchitectureUse|null {
 const text=usage.toLocaleLowerCase('tr-TR');
 if(text.includes('konut'))return 'residential';
 if(text.includes('ofis')||text.includes('ticari'))return 'office';
 if(text.includes('eğitim')||text.includes('sosyal'))return 'education';
 if(text.includes('sanayi')||text.includes('depo'))return 'industrial';
 return null;
}
export function masArchitectureOffer(projectId:string,modules:Record<string,unknown>){
 const context=massingContext(projectId,modules),raw=modules['quick-site-scenario'];
 if(!raw)return {state:'missing' as const,reason:'Önce MAS’ta bir yerleşim seçip projeye kaydedin.',value:null};
 const selected=restoreMassingSelection(raw,context);
 const snapshot=selected?massingSnapshot(context,selected):null;
 const model=selected?massingAlternatives(context,selected.mode,selected.floorHeight,selected.frontEdge):null;
 if(!selected||!snapshot||!model)return {state:'stale' as const,reason:'MAS kaydı güncel proje, brief veya parsel ile eşleşmiyor. MAS’ta seçimi yenileyin.',value:null};
 const aspect=snapshot.result.width/snapshot.result.depth;
 if(snapshot.result.gross<100||snapshot.result.gross>200000||snapshot.result.floors>30||selected.floorHeight>10||aspect<.5||aspect>4)return {state:'unsupported' as const,reason:'Seçilen alan, kat yüksekliği veya plaka oranı mimari programın giriş aralığı dışında. MAS seçimini kontrol edin; değerler otomatik kırpılmadı.',value:null};
 const signature=JSON.stringify([projectId,context.signature,selected]);
 const receipt={schema:'ARKEM-MAS-ARC/1',projectId,signature,reference:snapshot.source.reference,selectedId:selected.selectedId,label:snapshot.input.scheme,mode:selected.mode,zoningPending:snapshot.zoningPending,authoritative:false};
 return {state:'ready' as const,reason:'Kaydedilmiş MAS seçimi güncel.',value:{
  targetGross:snapshot.result.gross,floors:snapshot.result.floors,floorHeight:selected.floorHeight,aspect,use:architectureUse(context.usage),usage:context.usage,
  siteContext:{massingModel:JSON.parse(JSON.stringify(model)) as unknown,selectedMassingId:selected.selectedId,parcelReference:snapshot.source.reference,masHandoff:receipt},
 }};
}
export function applyMasArchitectureInput(current:Record<string,unknown>,value:NonNullable<ReturnType<typeof masArchitectureOffer>['value']>){
 return {...current,targetGross:value.targetGross,floors:value.floors,floorHeight:value.floorHeight,aspect:value.aspect,...(value.use?{use:value.use}:{}),siteContext:{...object(current.siteContext),...value.siteContext}};
}
export function masArchitectureLinkState(projectId:string,modules:Record<string,unknown>,input:Record<string,unknown>){
 const site=object(input.siteContext),raw=site.masHandoff;
 if(!raw)return {linked:false,stale:false,edited:false};
 const receipt=object(raw),offer=masArchitectureOffer(projectId,modules),value=offer.value;
 const basis=(model:unknown)=>{const m=object(model);return JSON.stringify([m.schema,m.envelope,m.limits,m.alternatives,m.source,m.conceptOnly??false,m.entitlementAvailable??false]);};
 const modelChanged=Boolean(value&&basis(site.massingModel)!==basis(value.siteContext.massingModel));
 const stale=modelChanged||receipt.schema!=='ARKEM-MAS-ARC/1'||receipt.projectId!==projectId||receipt.authoritative!==false||!value||receipt.signature!==value.siteContext.masHandoff.signature||receipt.mode!==value.siteContext.masHandoff.mode||receipt.zoningPending!==value.siteContext.masHandoff.zoningPending||site.selectedMassingId!==value.siteContext.selectedMassingId;
 const edited=!stale&&value!==null&&(['targetGross','floors','floorHeight','aspect'] as const).some(key=>typeof input[key]!=='number'||Math.abs(Number(input[key])-value[key])>.00001)||!stale&&Boolean(value?.use&&input.use!==value.use);
 return {linked:true,stale,edited};
}

export function masArchitectureHandoffPolicy(projectId:string,modules:Record<string,unknown>,input:Record<string,unknown>){
 const link=masArchitectureLinkState(projectId,modules,input);
 return {allowGISReplace:!link.linked,allowArchitecturePropagation:!link.stale};
}
