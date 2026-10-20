import test from 'node:test';
import assert from 'node:assert/strict';
import {planCellBounds,planCellConflicts,PLAN_LOCAL_CRS} from '../app/lib/plan-geometry.ts';
test('Top editor row exports to the north/top of a local CAD plan',()=>{
  assert.deepEqual(planCellBounds(1,0,5,4,12),{left:5,right:10,bottom:8,top:12});
  assert.deepEqual(planCellBounds(1,2,5,4,12),{left:5,right:10,bottom:0,top:4});
  for(let y=0;y<3;y++){const c=planCellBounds(0,y,5,4,12);assert.equal(c.top-c.bottom,4);}
  assert.ok(!PLAN_LOCAL_CRS.includes('4326'));
});
test('Conflicts count occupied cells, separating floors and intentional load/column overlays',()=>{
  const base={level:1,x:2,y:1};
  assert.equal(planCellConflicts([{...base,type:'space'},{...base,type:'core'},{...base,type:'space'},{...base,level:2,type:'space'}]),1);
  assert.equal(planCellConflicts([{...base,type:'space'},{...base,type:'column'},{...base,type:'load'}]),0);
  assert.equal(planCellConflicts([{...base,type:'space'},{...base,type:'opening'}]),1);
});
