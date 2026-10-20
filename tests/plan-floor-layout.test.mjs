import assert from 'node:assert/strict';
import test from 'node:test';
import {planFloorLayout} from '../app/lib/plan-floor-layout.ts';
import {planCellConflicts} from '../app/lib/plan-geometry.ts';
const rooms=[{id:'S',name:'Salon',count:4},{id:'Y',name:'Yatak odası',count:8},{id:'M',name:'Mutfak',count:4},{id:'B',name:'Banyo',count:4},{id:'G',name:'Ortak giriş',count:1}];
function fixture(){
  const elements=rooms.flatMap(r=>Array.from({length:r.count},(_,i)=>({id:r.id+i,type:'space',label:r.name,sourceSpaceId:r.id,level:1,x:0,y:0,load:2,custom:{keep:true}})));
  elements.forEach((e,i)=>{e.x=i%6;e.y=Math.floor(i/6);});
  return [...elements,{id:'core1',type:'core',label:'Çekirdek',level:1,x:2,y:1},{id:'core2',type:'core',label:'Çekirdek',level:2,x:2,y:1}];
}
const grid={floors:2,x:6,y:4};
test('Balances every room type and keeps one shared entry on K1, without collisions',()=>{
  const source=fixture(),before=structuredClone(source),out=planFloorLayout(source,rooms,grid);
  assert.equal(out.valid,true);assert.deepEqual(out.floors,[{level:1,rooms:11},{level:2,rooms:10}]);
  assert.equal(planCellConflicts(out.elements),0);assert.deepEqual(source,before);
  assert.equal(out.elements.find(e=>e.sourceSpaceId==='G').level,1);
  for(const r of rooms.slice(0,4))for(const floor of [1,2])assert.equal(out.elements.filter(e=>e.sourceSpaceId===r.id&&e.level===floor).length,r.count/2);
  assert.equal(out.elements.length,source.length);
  out.elements.forEach((e,i)=>{
    if(e.type!=='space')assert.equal(e,source[i]);
    assert.deepEqual({...e,level:0,x:0,y:0},{...source[i],level:0,x:0,y:0});
  });
});
test('Reapplying a stable layout makes no further moves, including after JSON persistence',()=>{
  const a=planFloorLayout(fixture(),rooms,grid);
  const b=planFloorLayout(JSON.parse(JSON.stringify(a.elements)),rooms,grid);
  assert.equal(b.moved,0);assert.deepEqual(b.elements,a.elements);
});
test('Capacity failure is atomic and does not change existing objects',()=>{
  const source=fixture(),out=planFloorLayout(source,rooms,{floors:2,x:2,y:2});
  assert.equal(out.valid,false);assert.equal(out.elements,source);
});
test('Unknown/manual objects remain fixed and block candidate cells',()=>{
  const manual={id:'manual',type:'space',label:'Özel oda',level:2,x:0,y:0};
  const source=[...fixture(),manual],out=planFloorLayout(source,rooms,grid);
  assert.equal(out.valid,true);assert.equal(out.elements.at(-1),manual);assert.equal(planCellConflicts(out.elements),0);
});
test('Missing, excess, ambiguous source rooms and duplicate object IDs block the draft',()=>{
  const source=fixture();
  for(const input of [source.slice(1),[...source,source[0]],[...source,{...source[0],id:'extra'}]]){
    assert.equal(planFloorLayout(input,rooms,grid).valid,false);
  }
  assert.equal(planFloorLayout(source,[...rooms,rooms[0]],grid).valid,false);
  assert.equal(planFloorLayout(source,rooms,{...grid,floors:0}).valid,false);
});
test('Source IDs retain a manually renamed room; legacy exact names still match',()=>{
  const source=fixture();source[0]={...source[0],label:'Kullanıcı salonu'};delete source[1].sourceSpaceId;
  const out=planFloorLayout(source,rooms,grid);
  assert.equal(out.valid,true);assert.equal(out.elements[0].label,'Kullanıcı salonu');
});
