import { createB06CoordinationFixture, refreshCoordinationSource } from './b06-coordination-project.mjs';
import { migrateFloorPlateIds } from '../../app/lib/floor-plate-identity.ts';
import { floorCoordinationBasis } from '../../app/lib/floor-coordination.ts';
import { createProjectShellDraft } from '../../app/lib/project-shell-source.ts';

// Explicit synthetic input declarations; never a real project or technical approval.
export function createProjectShellFixture({ legacy = false } = {}) {
  const project = createB06CoordinationFixture(), plan = project.modules['plan-editor'];
  plan.example = 'ARKEM-SYNTHETIC-B06/1.0';
  if (!legacy) {
    plan.floorPlates = migrateFloorPlateIds(plan.floorPlates, project.id);
    plan.floorCoordination.basis = floorCoordinationBasis(plan);
  }
  return refreshCoordinationSource(project);
}
export function createProjectShellFixtureSource(project, level = 1) {
  const plan = project.modules['plan-editor'], plate = plan.floorPlates.find(p => p.level === level);
  const source = createProjectShellDraft(project, plate.id);
  const position = plan.floorCoordination.placements.find(p => p.level === level);
  return { ...source,
    provenance: { kind: 'synthetic-project', reference: 'ARKEMX S4-A01 synthetic two-floor fixture / 2026-10-10' },
    midSurfaceReference: { datum: 'floor-placement', offsetZ: 0 },
    plate: { ...source.plate, origin: [position.x, position.y, position.z], thickness: .2 },
    material: { id: 'C30-PILOT', name: 'Synthetic elastic material', E: 30_000_000, nu: .2, unitWeight: 25 },
    mesh: { nx: level === 1 ? 8 : 16, ny: 8 }, supports: { preset: 'SS-H' },
    loads: { slabSelfWeight: true, superDeadLoad: 1.5, liveLoad: 3.5, benchmarkLoad: 1 },
    sourceElementIds: [level === 1 ? 'L-A' : 'U-A'],
  };
}
