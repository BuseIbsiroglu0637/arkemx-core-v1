import { createG05ReviewFixture } from './g05-review-project.mjs';
import { floorCoordinationBasis } from '../../app/lib/floor-coordination.ts';
import { planGeometrySnapshot } from '../../app/lib/source-reference-integrity.ts';
export function refreshCoordinationSource(p) {
  const plan = p.modules['plan-editor'], s = p.modules['structural-concept'];
  s.inputElementIds = plan.elements.map(e => e.id); s.inputElementSnapshot = structuredClone(plan.elements);
  s.inputGeometrySnapshot = planGeometrySnapshot(plan); s.modelContext.floorPlates = structuredClone(plan.floorPlates);
  if (plan.floorCoordination !== undefined) s.modelContext.floorCoordination = structuredClone(plan.floorCoordination);
  return p;
}
export function createB06CoordinationFixture({ saved = true } = {}) {
  const p = createG05ReviewFixture(), plan = p.modules['plan-editor'];
  p.experience.autoHandoff = false;
  for (const [id, level, x, y] of [['L-A',1,0,0],['L-B',1,1,0],['U-A',2,0,0],['U-B',2,.5,0]]) plan.elements.push({id,type:'column',level,x,y,orientation:'x',label:id,load:0,fire:'REI 60',section:'50x50',provenance:'manual'});
  if (saved) plan.floorCoordination = {schema:'ARKEM-FLOOR-COORDINATION/1.0',basis:floorCoordinationBasis(plan),placements:[{level:1,x:0,y:0,z:0},{level:2,x:0,y:0,z:3.4}],beams:[{id:'B-L',startColumnId:'L-A',endColumnId:'L-B'},{id:'B-U',startColumnId:'U-A',endColumnId:'U-B'}]};
  return refreshCoordinationSource(p);
}
