import test from 'node:test';
import assert from 'node:assert/strict';
import { planProgramSync } from '../app/lib/plan-program-sync.ts';
const source={spaces:[{id:'S',name:'Salon',count:2},{id:'B',name:'Banyo',count:2},{id:'G',name:'Ortak giriş',count:1}]};
const grid={floors:2,x:3,y:2};
const old=[{id:'manual',type:'space',level:1,x:0,y:0,label:'Elle düzenlendi',sourceSpaceId:'S',extra:'koru'},
  {id:'legacy',type:'space',level:1,x:1,y:0,label:'Salon'},
  {id:'core',type:'core',level:1,x:2,y:0,label:'Çekirdek'},
  {id:'hole',type:'opening',level:1,x:0,y:1,label:'Boşluk'}];
test('Adds only deficits and keeps all existing objects byte-for-byte',()=>{
  const before=structuredClone(old),result=planProgramSync(source,old,grid);
  assert.equal(result.missing,3);assert.equal(result.additions.length,3);
  assert.deepEqual(old,before);
  assert.equal(result.summary[0].placed,2);
  assert.deepEqual(result.additions.map(e=>e.label),['Banyo','Banyo','Ortak giriş']);
  const blocked=new Set(old.map(e=>[e.level,e.x,e.y].join(':')));
  for(const e of result.additions) assert.ok(!blocked.has([e.level,e.x,e.y].join(':')));
});
test('Repeat after save/JSON round trip does not duplicate rooms',()=>{
  const first=planProgramSync(source,old,grid);
  const saved=JSON.parse(JSON.stringify([...old,...first.additions]));
  const second=planProgramSync(source,saved,grid);
  assert.equal(second.missing,0);assert.equal(second.canApply,false);assert.deepEqual(second.additions,[]);
});
test('Insufficient capacity does not produce a partial import',()=>{
  const result=planProgramSync(source,old,{floors:1,x:2,y:1});
  assert.equal(result.canApply,false);assert.deepEqual(result.additions,[]);
});
test('Invalid, ambiguous and review-blocked programmes do not propose additions',()=>{
  for(const s of [{}, {...source,needsReview:true}, {spaces:[...source.spaces,source.spaces[0]]},
    {spaces:[{id:'S',name:'Salon',count:-1}]}, {spaces:[{id:'S',name:'Salon',count:1.5}]}]){
    const result=planProgramSync(s,old,grid);assert.equal(result.valid,false);assert.deepEqual(result.additions,[]);
  }
});
test('Extra and unmatched objects remain; matching identity takes precedence over renamed label',()=>{
  const elements=[...old,{id:'extra',type:'space',level:2,x:1,y:0,label:'Salon',sourceSpaceId:'S'},
    {id:'other',type:'space',level:2,x:2,y:0,label:'Banyo',sourceSpaceId:'OTHER'}];
  const result=planProgramSync(source,elements,grid);
  assert.equal(result.summary[0].extra,1);assert.equal(result.summary[1].placed,0);
  assert.equal(elements.length,6);
});
test('Generated IDs do not collide and additions stay on available floors',()=>{
  const result=planProgramSync(source,[...old,{id:'arc-add-B-1',type:'column',level:1,x:0,y:0,label:'Kolon'}],grid);
  assert.ok(!result.additions.some(e=>e.id==='arc-add-B-1'));
  assert.equal(new Set(result.additions.map(e=>e.id)).size,3);
  assert.ok(result.additions.every(e=>e.level>=1&&e.level<=2&&e.x<3&&e.y<2));
});
