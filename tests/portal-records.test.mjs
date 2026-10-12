import test from 'node:test';
import assert from 'node:assert/strict';
import {portalRecords,nextPortalDecisionId,recordPortalApproval} from '../app/lib/portal-records.ts';
const decision = id => ({id,text:'Test',owner:'Test',status:'Açık',createdAt:'2026-10-11T00:00:00Z'});
test('P01 approval is excluded from P02 and a new review cannot renew other gates',()=>{
 let portal=recordPortalApproval({},'scope','Onaylandı','P01','Test','2026-10-11T00:00:00Z');
 portal={...portal,...recordPortalApproval(portal,'delivery','Onaylandı','P01','Test','2026-10-11T00:00:01Z')};
 assert.equal(portalRecords(portal,'P01').approvals.scope,'Onaylandı');
 assert.equal(portalRecords(portal,'P02').approvals.scope,'Bekliyor');
 assert.deepEqual(portalRecords(portal,'P02').staleApprovals,['scope','delivery']);
 portal={...portal,...recordPortalApproval(portal,'scope','İncelemede','P02','Test','2026-10-11T00:00:02Z')};
 assert.equal(portalRecords(portal,'P02').approvals.scope,'İncelemede');
 assert.equal(portalRecords(portal,'P02').approvals.delivery,'Bekliyor');
 assert.equal(portal.approvalRecords.delivery.revision,'P01');assert.equal(portal.approvalHistory.length,3);
 assert.equal(portal.approvalHistory[0].state,'Onaylandı');
});
test('unbound legacy approvals remain visible as stale even after unrelated module restamping',()=>{
 const portal={approvals:{scope:'Onaylandı'},_kernel:{projectRevision:'P02'}};
 const read=portalRecords(portal,'P02');
 assert.equal(read.approvals.scope,'Bekliyor');assert.deepEqual(read.staleApprovals,['scope']);
 assert.equal(portal.approvals.scope,'Onaylandı');
 assert.equal(recordPortalApproval(portal,'scope','İncelemede','','Test','now'),null);
 assert.equal(portalRecords({approvals:{scope:'Onaylandı'},approvalRecords:{scope:{revision:'P02',state:'Bekliyor'}}},'P02').approvals.scope,'Bekliyor');
});
test('late-loaded and replaced project records remain authoritative',()=>{
 assert.equal(portalRecords(undefined).approvals.scope,'Bekliyor');
 const stored={approvals:{scope:'İncelemede',delivery:'Onaylandı'},decisions:[decision('DEC-002')]};
 assert.equal(portalRecords(stored).approvals.scope,'İncelemede');
 assert.deepEqual(portalRecords(stored).decisions,stored.decisions);
 assert.equal(portalRecords({}).approvals.delivery,'Bekliyor');
 assert.deepEqual(portalRecords({}).decisions,[]);
});
test('malformed persisted values do not grant approval or crash decision rendering',()=>{
 const records=portalRecords({approvals:{scope:'approved',system:null},decisions:[null,{},decision('DEC-001')]});
 assert.equal(records.approvals.scope,'Bekliyor');assert.equal(records.approvals.system,'Bekliyor');
 assert.equal(records.decisions.length,1);
});
test('more than twenty decisions are retained and next identity cannot reuse a retained number',()=>{
 const decisions=Array.from({length:25},(_,i)=>decision(`DEC-${String(i+10).padStart(3,'0')}`));
 assert.equal(portalRecords({decisions}).decisions.length,25);
 assert.equal(nextPortalDecisionId(decisions),'DEC-035');
 assert.equal(nextPortalDecisionId([decision('DEC-001'),decision('DEC-003')]),'DEC-004');
 assert.equal(nextPortalDecisionId([]),'DEC-001');
});
