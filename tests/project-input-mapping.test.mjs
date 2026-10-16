import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionAssistantInput, deliveryUsageKey, projectUsageKey } from '../app/lib/project-input-mapping.ts';

test('guided residential intake maps to decision forms without inventing documents or system approval',()=>{
  const raw={projectType:'new',usage:'residential',targetArea:1000,system:'undecided',location:'TEST',
    priorities:['safety','cost','carbon','operation'],documents:[]};
  const copy=structuredClone(raw), mapped=decisionAssistantInput(raw);
  assert.deepEqual(mapped,{goal:'konut',stage:'fikir',system:'kararsiz',location:'TEST',area:'1000',
    priorities:['guvenlik','butce','karbon','isletme'],documents:[]});
  assert.deepEqual(raw,copy);
  assert.equal(deliveryUsageKey(raw.usage),'konut');
});
test('current form values survive migration; duplicate and unknown enums cannot inflate scoring',()=>{
  const mapped=decisionAssistantInput({goal:'sanayi',usage:'residential',stage:'on-proje',area:'',targetArea:1000,
    system:'celik',priorities:['cost','butce','unsafe'],documents:['soil','zemin','unsupported']});
  assert.equal(mapped.goal,'sanayi');assert.equal(mapped.stage,'on-proje');assert.equal(mapped.area,'');
  assert.deepEqual(mapped.priorities,['butce']);assert.deepEqual(mapped.documents,['zemin']);
});
test('usage adapters handle English and Turkish source enums, and leave unknown uses unresolved',()=>{
  for(const value of ['residential','Konut / karma yaşam','Konut / Villa'])assert.equal(deliveryUsageKey(value),'konut');
  assert.equal(deliveryUsageKey('commercial'),'ticari');assert.equal(deliveryUsageKey('storage'),'sanayi');
  assert.equal(projectUsageKey('agricultural'),'tarimsal');assert.equal(deliveryUsageKey('unknown'),undefined);
});
