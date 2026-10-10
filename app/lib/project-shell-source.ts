import {floorCoordinationBasis,inspectFloorCoordination} from "./floor-coordination.ts";
import {SHELL_UNITS,validateRectangularShellPhysical,type RectangularShellPhysical} from "./shell-source.ts";
import {traceJson} from "./structural-traceability.ts";
import {PLAN_UNITS,projectIntegrityIssues} from "./project-integrity.ts";
type Data=Record<string,unknown>;
const data=(v:unknown):Data=>v&&typeof v==="object"&&!Array.isArray(v)?v as Data:{};
const id=(v:unknown):v is string=>typeof v==="string"&&!!v&&v.trim()===v;
const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
function exact(v:unknown,keys:string[],label:string){const row=data(v);if(!v||Array.isArray(v)||Object.keys(row).length!==keys.length||keys.some(k=>!Object.hasOwn(row,k)))throw Error(label+": eksik veya desteklenmeyen alan.");return row;}
function context(value:unknown){
 const p=data(value),plan=data(data(p.modules)["plan-editor"]),stamp=data(plan._kernel);
 if(p.schema!=="ARKEM-PROJECT/1.0"||!id(p.id)||!id(p.revision)||!id(p.coordinateReference))throw Error("Açık proje/revizyon ve koordinat referansı gerekiyor.");
 if(stamp.schema!=="ARKEM-MODULE-LINK/1.0"||stamp.sourceModule!=="plan-editor"||stamp.projectId!==p.id||stamp.projectRevision!==p.revision)throw Error("Plan proje/revizyon damgası eşleşmiyor.");
 if(traceJson(plan.units)!==traceJson(PLAN_UNITS))throw Error("Plan birimleri desteklenmiyor.");
 const planIssues=projectIntegrityIssues(p).filter(issue=>issue.startsWith("plan-editor:"));
 if(planIssues.length)throw Error("Plan kaynağı geçersiz: "+planIssues.join(" "));
 const plates=Array.isArray(plan.floorPlates)?Array.from(plan.floorPlates,data):[];
 if(!plates.length||plates.some(f=>!id(f.id))||new Set(plates.map(f=>f.id)).size!==plates.length)throw Error("Önce bütün döşemelerin kalıcı kimliklerini oluşturun; tekrarlı kimlik kabul edilmez.");
 const elements=Array.isArray(plan.elements)?Array.from(plan.elements,data):[];
 if(!Array.isArray(plan.elements)||elements.some(e=>!id(e.id))||new Set(elements.map(e=>e.id)).size!==elements.length)throw Error("Plan eleman kimlikleri eksik veya tekrarlı.");
 const coordination=inspectFloorCoordination(plan);
 if(!coordination.geometry)throw Error("Güncel ortak kat koordinatları gerekiyor: "+coordination.issues.join(" "));
 return {p,plan,plates,elements,floors:coordination.geometry.floors};
}
export function projectShellBasis(value:unknown){
 const {p,plan}=context(value),coord=data(plan.floorCoordination);
 const coordination={...coord,placements:(coord.placements as Data[]).toSorted((a,b)=>Number(a.level)-Number(b.level)),beams:(coord.beams as Data[]).toSorted((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0)};
 return traceJson({projectId:p.id,revision:p.revision,coordinateReference:p.coordinateReference,plan:floorCoordinationBasis(plan),coordination});
}
export type ProjectShellSource=RectangularShellPhysical&{
 schema:"ARKEM-PROJECT-SHELL-SOURCE/1.0";projectId:string;revision:string;basis:string;sourcePlateId:string;sourceElementIds:string[];
 provenance:{kind:"synthetic-project"|"user-declared-project";reference:string};
 geometry:{plane:"XY";rotation:0};midSurfaceReference:{datum:"floor-placement";offsetZ:number};
 fullBuildingAnalysis:false;technicalApproval:false;
};
export function createProjectShellDraft(project:unknown,plateId:string){
 const {p,plates,floors}=context(project),plate=plates.find(f=>f.id===plateId),f=floors.find(f=>f.level===plate?.level);
 if(!plate||!f)throw Error("Seçilen kaynak döşemesi projede yok.");
 return {schema:"ARKEM-PROJECT-SHELL-SOURCE/1.0",projectId:p.id,revision:p.revision,basis:projectShellBasis(project),sourcePlateId:plate.id,sourceElementIds:[],
 provenance:{kind:null,reference:null},units:SHELL_UNITS,geometry:{plane:"XY",rotation:0},midSurfaceReference:{datum:"floor-placement",offsetZ:null},
 plate:{id:plate.id,sourceLevel:plate.level,origin:[f.x,f.y,null],width:plate.width,depth:plate.depth,thickness:null},
 material:{id:null,name:null,E:null,nu:null,unitWeight:null},mesh:{nx:null,ny:null},supports:{preset:null},loads:{slabSelfWeight:null,superDeadLoad:null,liveLoad:null,benchmarkLoad:null},
 fullBuildingAnalysis:false,technicalApproval:false};
}
export function validateProjectShellSource(project:unknown,value:unknown):asserts value is ProjectShellSource {
 const {p,plan,plates,elements,floors}=context(project);
 const s=exact(value,["schema","projectId","revision","basis","sourcePlateId","sourceElementIds","provenance","units","geometry","midSurfaceReference","plate","material","mesh","supports","loads","fullBuildingAnalysis","technicalApproval"],"Proje kabuk kaynağı");
 if(s.schema!=="ARKEM-PROJECT-SHELL-SOURCE/1.0"||s.projectId!==p.id||s.revision!==p.revision||s.fullBuildingAnalysis!==false||s.technicalApproval!==false)throw Error("Proje/revizyon veya kaynak kapsamı eşleşmiyor; teknik onay beyan edilemez.");
 if(s.basis!==projectShellBasis(project))throw Error("Plan kaynağı değişti; kabuk kaynağını yeniden bağlayın.");
 const provenance=exact(s.provenance,["kind","reference"],"Kaynak kökeni");
 if(!["synthetic-project","user-declared-project"].includes(provenance.kind as string)||!id(provenance.reference))throw Error("Kaynak kökeni ve dosya/beyan referansı açık olmalı.");
 if(provenance.kind==="synthetic-project"&&plan.example!=="ARKEM-SYNTHETIC-B06/1.0")throw Error("Bu plan sentetik örnek olarak işaretli değil.");
 if(plan.example==="ARKEM-SYNTHETIC-B06/1.0"&&provenance.kind!=="synthetic-project")throw Error("Sentetik proje gerçek proje beyanı olarak kullanılamaz.");
 const geometry=exact(s.geometry,["plane","rotation"],"Kabuk geometrisi");if(geometry.plane!=="XY"||geometry.rotation!==0)throw Error("Yalnız XY'ye paralel, dönmemiş dikdörtgen desteklenir.");
 const mid=exact(s.midSurfaceReference,["datum","offsetZ"],"Orta yüzey kot referansı");if(mid.datum!=="floor-placement"||!finite(mid.offsetZ))throw Error("Orta yüzey kot referansı ve kaçıklık açık sayısal değer olmalı.");
 validateRectangularShellPhysical({units:s.units,plate:s.plate,material:s.material,mesh:s.mesh,supports:s.supports,loads:s.loads},true);
 const physical=s as unknown as ProjectShellSource,plate=plates.find(f=>f.id===s.sourcePlateId),f=floors.find(f=>f.level===plate?.level);
 if(!plate||!f||physical.plate.id!==plate.id||physical.plate.sourceLevel!==plate.level||physical.plate.width!==plate.width||physical.plate.depth!==plate.depth)throw Error("Kabuk plaka kimliği, katı veya boyutları kaynak döşemesiyle eşleşmiyor.");
 if(elements.some(e=>e.level===plate.level&&e.type==="opening"))throw Error("Boşluk içeren kaynak döşemesi bu dikdörtgen pilotta desteklenmiyor.");
 if((plate.rotation!==undefined&&plate.rotation!==0)||["outline","polygon","holes","vertices"].some(key=>plate[key]!==undefined))throw Error("Dikdörtgen dışı veya dönmüş kaynak döşemesi desteklenmiyor.");
 const origin=physical.plate.origin,expectedZ=f.z+mid.offsetZ;
 if(!Number.isFinite(expectedZ)||origin[0]!==f.x||origin[1]!==f.y||origin[2]!==expectedZ||(mid.offsetZ!==0&&expectedZ===f.z))throw Error("Kabuk orta yüzey XYZ kotu açık kat yerleşimi/kaçıklıkla eşleşmiyor.");
 if(!Array.isArray(s.sourceElementIds)||Array.from(s.sourceElementIds).some(v=>!id(v))||new Set(s.sourceElementIds).size!==s.sourceElementIds.length||s.sourceElementIds.some(id=>!elements.some(e=>e.id===id&&e.level===plate.level)))throw Error("Kaynak eleman bağlantısı yabancı, tekrarlı veya başka katta.");
 validateNumerics(physical);
}
// Reject unrepresentable coordinates and load derivatives without creating a mesh or solving.
function validateNumerics(s:RectangularShellPhysical){
 const p=s.plate,m=s.material,mesh=s.mesh,area=p.width*p.depth,cellArea=(p.width/mesh.nx)*(p.depth/mesh.ny),G=m.E/(2*(1+m.nu));
 const slab=s.loads.slabSelfWeight?m.unitWeight*p.thickness:0,loads=[slab,s.loads.superDeadLoad,s.loads.liveLoad,s.loads.benchmarkLoad,slab+s.loads.superDeadLoad];
 if(![area,cellArea,G,slab,...loads,...loads.map(q=>q*area)].every(finite)||area<=0||cellArea<=0||G<=0||(s.loads.slabSelfWeight&&slab<=0)||loads.some(q=>q>0&&q*area<=0))throw Error("Ağ veya yük türevleri sonlu ve pozitif değil.");
 for(const [start,size,n] of [[p.origin[0],p.width,mesh.nx],[p.origin[1],p.depth,mesh.ny]]){
  let previous=start;for(let i=1;i<=n;i++){const next=start+size*i/n;if(!finite(next)||next<=previous)throw Error("Ağ koordinatları sonlu veya birbirinden ayırt edilebilir değil.");previous=next;}
 }
}
export function inspectProjectShellSource(project:unknown,value:unknown){
 try{validateProjectShellSource(project,value);return {status:"source-validated" as const,issues:[] as string[],source:JSON.parse(traceJson(value)) as ProjectShellSource,calculation:null,fullBuildingAnalysis:false,technicalApproval:false};}
 catch(e){return {status:"pending" as const,issues:[e instanceof Error?e.message:"Proje kabuk kaynağı geçersiz."],source:null,calculation:null,fullBuildingAnalysis:false,technicalApproval:false};}
}
