import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECT_VAULT_KEY,hasCurrentProjectBackup,preserveProjectSwitchBackup} from '../app/lib/project-switch-backup.ts';
const project=()=>({schema:'ARKEM-PROJECT/1.0',id:'TEST',name:'Sentetik proje',revision:'P01',modules:{plan:{width:10}},events:[]});
function storage(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
test('backup is saved, read back and survives remount without a login',()=>{
 const s=storage(),p=project();assert.equal(hasCurrentProjectBackup(s,p),false);
 preserveProjectSwitchBackup(s,p);assert.equal(hasCurrentProjectBackup(s,JSON.parse(JSON.stringify(p))),true);
 assert.deepEqual(JSON.parse(s.getItem(PROJECT_VAULT_KEY))[0].data,p);
 preserveProjectSwitchBackup(s,p);assert.equal(JSON.parse(s.getItem(PROJECT_VAULT_KEY)).length,1);
});
test('same revision edits and foreign identities invalidate old preservation evidence',()=>{
 const s=storage(),p=project();preserveProjectSwitchBackup(s,p);
 for(const change of [v=>v.modules.plan.width=11,v=>v.revision='P02',v=>v.id='OTHER',v=>v.events.push({id:'edit'})]){
  const next=structuredClone(p);change(next);assert.equal(hasCurrentProjectBackup(s,next),false);
 }
});
test('new backup preserves older snapshots instead of replacing them',()=>{
 const s=storage(),p=project();preserveProjectSwitchBackup(s,p);p.modules.plan.width=11;preserveProjectSwitchBackup(s,p);
 assert.equal(JSON.parse(s.getItem(PROJECT_VAULT_KEY)).length,2);
 assert.equal(JSON.parse(s.getItem(PROJECT_VAULT_KEY))[1].data.modules.plan.width,10);
});
test('corrupt vault, storage denial or ignored write never unlock the flow',()=>{
 const p=project(),s=storage();s.setItem(PROJECT_VAULT_KEY,'{broken');assert.equal(hasCurrentProjectBackup(s,p),false);assert.throws(()=>preserveProjectSwitchBackup(s,p));assert.equal(s.getItem(PROJECT_VAULT_KEY),'{broken');
 for(const failing of [{getItem:()=>null,setItem:()=>{throw Error('quota');}},{getItem:()=>null,setItem:()=>{}}]){
  assert.throws(()=>preserveProjectSwitchBackup(failing,p));assert.equal(hasCurrentProjectBackup(failing,p),false);
 }
});
