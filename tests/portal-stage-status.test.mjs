import test from 'node:test';
import assert from 'node:assert/strict';
import {portalStageStatus} from '../app/lib/portal-stage-status.ts';
const journey=()=>({completed:Array(7).fill(false),achieved:Array(7).fill(false)});
const thread=()=>({nodes:[{id:'architectural-program',active:true,milestoneComplete:false},{id:'plan-editor',active:true,milestoneComplete:false},{id:'digital-delivery-scope',active:true,milestoneComplete:false}],metrics:{critical:0}});
test('seeded architecture and delivery records are not ready or approved',()=>{
 const j=journey();j.achieved[2]=true;const s=portalStageStatus(thread(),j,0);
 assert.equal(s.architectureReady,false);assert.equal(s.deliveryReady,false);
 assert.equal(s.stages[2].label,'Çalışıldı · kontrol bekliyor');
 assert.equal(s.stages[6].label,'Teslim kontrolü ve onay bekleniyor');
 assert.equal(s.stages.some(v=>v.label==='Onaylı paket'),false);
});
test('architecture needs both own milestones and sequential project gates',()=>{
 const t=thread(),j=journey();j.completed[2]=true;t.nodes[0].milestoneComplete=true;
 assert.equal(portalStageStatus(t,j,0).architectureReady,false);
 t.nodes[1].milestoneComplete=true;assert.equal(portalStageStatus(t,j,0).architectureReady,true);
 j.completed[2]=false;assert.equal(portalStageStatus(t,j,0).architectureReady,false);
});
test('four approval declarations cannot replace delivery scope or upstream controls',()=>{
 const t=thread(),j=journey();j.completed.fill(true);
 assert.equal(portalStageStatus(t,j,4).deliveryReady,false);
 t.nodes[2].milestoneComplete=true;assert.equal(portalStageStatus(t,j,4).deliveryReady,true);
 assert.equal(portalStageStatus(t,j,4).stages[6].label,'Kontroller tamamlandı');
 j.completed[1]=false;assert.equal(portalStageStatus(t,j,4).deliveryReady,false);
 j.completed[1]=true;t.metrics.critical=1;assert.equal(portalStageStatus(t,j,4).deliveryReady,false);
 t.metrics.critical=0;assert.equal(portalStageStatus(t,j,3).deliveryReady,false);
});
