import assert from 'node:assert/strict';
import test from 'node:test';
import {planGrossArea} from '../app/lib/plan-area.ts';
import {createTrackingWork, trackingEvidence, earnedValueFromProgress, restoreRegisterRows} from '../app/lib/tracking-register.ts';
import {createProjectOperatingModel, operatingHealthGates, restoreOperatingWorkStates} from '../app/lib/project-os-2.ts';

test('different plates determine gross area even when repeated active metrics conflict',()=>{
 assert.equal(planGrossArea({floorCount:3,metrics:{floorArea:1000},floorPlates:[{width:20,depth:30},{width:10,depth:30},{width:10,depth:10}]}),1000);
 assert.equal(planGrossArea({floorCount:3,metrics:{floorArea:100}}),300);
 assert.equal(planGrossArea({floorCount:3,metrics:{floorArea:100},floorPlates:[{width:-10,depth:30}]}),0);
});
test('generated dates and absent owners are suggestions and cannot pass ownership gate',()=>{
 const m=createProjectOperatingModel({projectId:'P',projectRevision:'P01',bimCoordination:{schema:'ARKEM-BIM-COORDINATION/3.0',clashes:[{guid:'G'}]}});
 assert.equal(m.workItems[0].ownerSuggested,true); assert.equal(m.workItems[0].dueDateSuggested,true);
 assert.equal(operatingHealthGates(m.workItems,true)[0].status,'attention');
});
test('manual work requires a source and closure restores only matching revision',()=>{
 const draft={title:'Task',owner:'Owner',due:'2026-10-15',source:'Minutes',revision:'P01',impact:''};
 assert.throws(()=>createTrackingWork({...draft,source:''},'T'));
 const item=createTrackingWork(draft,'T');
 assert.equal(restoreOperatingWorkStates([{...item,status:'closed'}],[item]).T,'closed');
 assert.deepEqual(restoreOperatingWorkStates([{...item,status:'closed'}],[{...item,revision:'P02'}]),{});
});
test('approval and closure require person, reason and evidence',()=>{
 assert.throws(()=>trackingEvidence({actor:'A',reason:' ',evidence:'Doc',revision:'P01'}));
 assert.deepEqual(trackingEvidence({actor:' A ',reason:' Reviewed ',evidence:' Doc ',revision:'P01'},'2026-10-11T00:00:00Z'),{actor:'A',reason:'Reviewed',evidence:'Doc',revision:'P01',at:'2026-10-11T00:00:00Z'});
});
test('missing progress, actual zero and undefined cost ratios remain distinct',()=>{
 assert.equal(earnedValueFromProgress(null),null);
 const input={actual:0,planned:0,budget:10,actualCost:0,week:0};
 const zero=earnedValueFromProgress(input); assert.equal(zero.actual,0); assert.equal(zero.spi,null); assert.equal(zero.cpi,null); assert.equal(zero.eac,null);
 const value=earnedValueFromProgress({...input,actual:40,planned:50,actualCost:5}); assert.equal(value.spi,.8); assert.equal(value.cpi,.8); assert.equal(value.eac,12.5);
 assert.throws(()=>earnedValueFromProgress({...input,actual:101}));
});

test("register restore retains object records and their evidence",()=>{const rows=[{code:"D",approval:{actor:"A",evidence:"E"}}];assert.deepEqual(restoreRegisterRows(rows),rows);assert.deepEqual(restoreRegisterRows(null),[]);});
