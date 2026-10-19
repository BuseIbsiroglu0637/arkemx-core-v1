/** Deterministic placement of conceptual room-type symbols; no wall/door or legal clearance model. */
export type LayoutNode = {id:string;name:string;daylightRequired:boolean;position:{x:number;y:number;edge:string};visual:{width:number;height:number}};
type Point={x:number;y:number;edge:string};
type Link={from:string;to:string;priority:string};
const rounded=(v:number)=>Number(v.toFixed(3));
export function symbolsOverlap(a:Point, av:{width:number;height:number}, b:Point,bv:{width:number;height:number},gap=2){
 return Math.abs(a.x-b.x)<(av.width+bv.width)/2+gap-.001&&Math.abs(a.y-b.y)<(av.height+bv.height)/2+gap-.001;
}
function candidates(node:LayoutNode):Point[]{
 const x=node.visual.width/2+2,y=node.visual.height/2+2;
 const points:Point[]=[];
 for(let i=0;i<=12;i++){
  const t=i/12,xx=x+t*(100-2*x),yy=y+t*(100-2*y);
  points.push({x:xx,y,edge:'north'},{x:100-x,y:yy,edge:'east'},{x:xx,y:100-y,edge:'south'},{x,y:yy,edge:'west'});
 }
 if(!node.daylightRequired)for(let row=0;row<7;row++)for(let col=0;col<7;col++)points.push({x:x+col*(100-2*x)/6,y:y+row*(100-2*y)/6,edge:'interior'});
 return points.map(p=>({...p,x:rounded(p.x),y:rounded(p.y)}));
}
export function arrangeArchitecturalNodes(nodes:LayoutNode[],links:Link[],width:number,depth:number,cores:{x:number;y:number}[]){
 if(!nodes.length||nodes.length>40||!(width>0&&depth>0)||!Number.isFinite(width+depth)||new Set(nodes.map(n=>n.id)).size!==nodes.length){return {applied:false,reason:'Yerleştirme için 1–40 farklı mahal ve geçerli plaka boyutları gerekli.',positions:{} as Record<string,Point>};}
 const byName=new Map(nodes.filter(n=>nodes.filter(v=>v.name===n.name).length===1).map(n=>[n.name,n]));
 const edges=links.flatMap(l=>{const a=byName.get(l.from),b=byName.get(l.to);return a&&b&&a.id!==b.id?[{a:a.id,b:b.id,weight:l.priority==='Zorunlu'?2:1,target:Math.hypot(width,depth)*(l.priority==='Zorunlu'?.3:.45)}]:[]});
 const degree=(id:string)=>edges.filter(e=>e.a===id||e.b===id).reduce((sum,e)=>sum+e.weight,0);
 const ordered=[...nodes].sort((a,b)=>degree(b.id)-degree(a.id)||b.visual.width*b.visual.height-a.visual.width*a.visual.height||a.id.localeCompare(b.id));
 const choices=new Map(nodes.map(n=>[n.id,candidates(n)]));
 const placed:Record<string,Point>={};
 const feasible=(node:LayoutNode,p:Point)=>p.x-node.visual.width/2>=0&&p.x+node.visual.width/2<=100&&p.y-node.visual.height/2>=0&&p.y+node.visual.height/2<=100&&nodes.every(n=>n.id===node.id||!placed[n.id]||!symbolsOverlap(p,node.visual,placed[n.id],n.visual))&&cores.every(c=>!symbolsOverlap(p,node.visual,{...c,edge:'core'},{width:8,height:8}));
 const cost=(node:LayoutNode,p:Point)=>{
  let value=Math.hypot(p.x-node.position.x,p.y-node.position.y)*.001;
  for(const edge of edges){const id=edge.a===node.id?edge.b:edge.b===node.id?edge.a:null;if(!id||!placed[id])continue;const q=placed[id];const d=Math.hypot((p.x-q.x)*width/100,(p.y-q.y)*depth/100);value+=edge.weight*(Math.max(0,d-edge.target)**2*1000+d);}
  return value;
 };
 for(const node of ordered){let best:Point|undefined,score=Infinity;for(const p of choices.get(node.id)!){if(!feasible(node,p))continue;const next=cost(node,p);if(next<score){best=p;score=next;}}if(!best)return {applied:false,reason:'Sınır, sembol çakışması ve çekirdek boşluğu korunarak tüm mahaller yerleştirilemedi. Önceki dağılım gösteriliyor; programı gözden geçirin.',positions:{} as Record<string,Point>};placed[node.id]=best;}
 for(let iteration=0;iteration<4;iteration++)for(const node of ordered){let best=placed[node.id],score=cost(node,best);for(const p of choices.get(node.id)!){if(!feasible(node,p))continue;const next=cost(node,p);if(next<score-.00001){best=p;score=next;}}placed[node.id]=best;}
 return {applied:true,reason:'Mahal türü sembolleri yakınlık hedeflerine göre yerleştirildi; ölçülü oda planı değildir.',positions:placed};
}
