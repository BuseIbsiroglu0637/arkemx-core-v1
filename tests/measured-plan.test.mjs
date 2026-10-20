import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeasuredPlan,measuredCurrent,rectOverlap} from '../app/lib/measured-plan.ts';
import {planFloorLayout} from '../app/lib/plan-floor-layout.ts';
const rooms=[{id:'S',name:'Salon',count:4,unitArea:30},{id:'Y',name:'Yatak odası',count:8,unitArea:16},{id:'M',name:'Mutfak',count:4,unitArea:14},{id:'B',name:'Banyo',count:4,unitArea:5},{id:'G',name:'Ortak giriş',count:1,unitArea:12}];
const source={spaces:rooms},grid={floors:2,baysX:6,baysY:4,spanX:4.933,spanY:4.72,corridorWidth:1.2};
function fixture(){
 const es=rooms.flatMap(r=>Array.from({length:r.count},(_,i)=>({id:r.id+i,label:r.name,type:'space',sourceSpaceId:r.id,level:1,x:0,y:0,load:2,fire:'İncelenecek',custom:'koru'})));
 es.forEach((e,i)=>{e.x=i%6;e.y=Math.floor(i/6);});
 es.push(...[1,2].map(level=>({id:'C'+level,type:'core',label:'Çekirdek',level,x:2,y:1})));
 return planFloorLayout(es,rooms,{floors:2,x:6,y:4}).elements;
}
test('All 21 real room areas fit within the plate, with no overlaps and fixed core locations',()=>{
 const es=fixture(),before=structuredClone(es),out=createMeasuredPlan(es,source,grid);
 assert.equal(out.valid,true);assert.deepEqual(es,before);assert.equal(out.elements.length,23);
 let area=0;
 for(const floor of [1,2]){
  const list=out.elements.filter(e=>e.level===floor),core=list.find(e=>e.type==='core'),corridor=core.corridorGeometry;
  const coreRect={x:core.x*grid.spanX,y:core.y*grid.spanY,width:grid.spanX,depth:grid.spanY};
  const rs=list.filter(e=>e.type==='space');
  for(const e of rs){
   const r=e.roomGeometry;
   assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=grid.spanX*6+1e-7&&r.y+r.depth<=grid.spanY*4+1e-7);
   assert.ok(Math.abs(r.width*r.depth-r.area)<1e-8);area+=r.area;
   assert.equal(rectOverlap(r,coreRect),false);assert.equal(rectOverlap(r,corridor),false);
   for(const other of rs.filter(o=>o.id!==e.id))assert.equal(rectOverlap(r,other.roomGeometry),false);
  }
 }
 assert.equal(area,336);
 out.elements.forEach((e,i)=>{const {roomGeometry,corridorGeometry,...old}=e;assert.deepEqual(old,es[i]);});
});
test('Every room door reaches the same-floor core through a continuous orthogonal corridor route',()=>{
 const out=createMeasuredPlan(fixture(),source,grid);
 for(const e of out.elements.filter(e=>e.type==='space')){
  const r=e.roomGeometry,c=out.elements.find(x=>x.level===e.level&&x.type==='core').corridorGeometry;
  assert.equal(r.route[0].x,r.x+r.width/2);
  assert.equal(r.route[0].y,r.side==='bottom'?r.y+r.depth:r.y);
  assert.deepEqual(r.route.at(-1),{x:c.doorX,y:c.y});
  for(const p of r.route)assert.ok(p.x>=c.x&&p.x<=c.x+c.width&&p.y>=c.y-1e-7&&p.y<=c.y+c.depth+1e-7);
  r.route.slice(1).forEach((p,i)=>assert.ok(p.x===r.route[i].x||p.y===r.route[i].y));
 }
});
test('Width/door overrides preserve programme area and survive JSON',()=>{
 const es=fixture();es[0]={...es[0],roomWidth:5,doorWidth:1};
 const out=createMeasuredPlan(es,source,grid),r=out.elements[0].roomGeometry;
 assert.equal(out.valid,true);assert.equal(r.width,5);assert.equal(r.depth,6);assert.equal(r.doorWidth,1);
 assert.equal(measuredCurrent(JSON.parse(JSON.stringify(out.elements)),source,grid),true);
});
test('Changed source area, axes, floor assignment, door and corridor settings invalidate saved geometry',()=>{
 const out=createMeasuredPlan(fixture(),source,grid);
 assert.equal(measuredCurrent(out.elements,source,grid),true);
 const alteredSource=structuredClone(source);alteredSource.spaces[0].unitArea=31;
 assert.equal(measuredCurrent(out.elements,alteredSource,grid),false);
 for(const g of [{...grid,spanX:5},{...grid,corridorWidth:1.3}])assert.equal(measuredCurrent(out.elements,source,g),false);
 for(const patch of [{doorWidth:1},{level:2},{roomWidth:5}]){
  const es=structuredClone(out.elements);Object.assign(es[0],patch);assert.equal(measuredCurrent(es,source,grid),false);
 }
 const tampered=structuredClone(out.elements);tampered[0].roomGeometry.x=999;
 assert.equal(measuredCurrent(tampered,source,grid),false);
});
test('Capacity, missing cores, source mismatch, invalid dimensions and unknown rooms fail atomically',()=>{
 for(const setup of [
  es=>es.filter(e=>e.id!=='C2'),
  es=>es.map((e,i)=>i===0?{...e,roomWidth:100}:e),
  es=>es.map((e,i)=>i===0?{...e,doorWidth:3}:e),
  es=>es.map((e,i)=>i===0?{...e,roomWidth:NaN}:e),
  es=>[...es,{id:'unknown',label:'Manuel mahal',type:'space',level:1,x:0,y:0}],
  es=>es.slice(1)
 ]){
  const es=setup(fixture()),before=structuredClone(es),out=createMeasuredPlan(es,source,grid);
  assert.equal(out.valid,false);assert.equal(out.elements,es);assert.deepEqual(es,before);
 }
 assert.equal(createMeasuredPlan(fixture(),{...source,needsReview:true},grid).valid,false);
 assert.equal(createMeasuredPlan(fixture(),source,{...grid,corridorWidth:0}).valid,false);
});
test('Fixed walls crossing the corridor block the layout rather than claiming connection',()=>{
 const es=[...fixture(),{id:'wall',type:'wall',orientation:'y',level:1,x:0,y:2,label:'Sabit duvar'}];
 assert.equal(createMeasuredPlan(es,source,grid).valid,false);
});
