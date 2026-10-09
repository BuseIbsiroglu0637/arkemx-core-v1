// Synthetic software fixture. No prior browser output or engineering approval.
import { stampProjectModule } from '../../app/lib/project-core.ts';
import { buildProgramPlanElements } from '../../app/lib/plan-program.ts';

export function createG05ReviewFixture() {
  const id = 'G05-BROWSER', revision = 'P02', time = '2026-10-09T00:00:00.000Z';
  const units = { schema: 'ARKEM-UNITS/1.0', length: 'm', area: 'm2', force: 'kN', surfaceLoad: 'kN/m2', coordinates: 'm' };
  const stamp = (key, value) => stampProjectModule(value, { projectId: id, projectRevision: revision, sourceModule: key, recordedAt: time, action: 'updated' });
  const spaces = [{ id: 'A', code: 'A-1', name: 'SYNTHETIC-A', count: 2, unitArea: 20, liveLoad: 3.5 }, { id: 'B', code: 'B-1', name: 'SYNTHETIC-B', count: 1, unitArea: 30, liveLoad: 3.5 }];
  const plates = [{ level: 1, width: 10, depth: 10, grossArea: 100, netArea: 40 }, { level: 2, width: 20, depth: 10, grossArea: 200, netArea: 30 }];
  const geometry = { level: 2, floorCount: 2, baysX: 2, baysY: 2, spanX: 5, spanY: 5, floorPlates: plates };
  const elements = buildProgramPlanElements(spaces, 2, 2, 2, 3.5, 5, 5, [], plates);
  return {
    schema: 'ARKEM-PROJECT/1.0', id, name: 'G05 SENTETİK REGRESYON', revision, phase: 'Ön fizibilite', coordinateReference: 'LOCAL TEST ONLY', updatedAt: time,
    experience: { mode: 'technical', autoHandoff: true, lastSynchronizedAt: '' }, events: [], modules: {
      'architectural-program': stamp('architectural-program', { units: { ...units }, input: { floors: 2, targetGross: 300, netRatio: 78, aspect: 1 }, result: { liveLoad: 3.5, grossDemand: 300 }, spaces, relationships: [] }),
      'plan-editor': stamp('plan-editor', { ...structuredClone(geometry), units: { ...units, coordinates: 'grid-bay' }, elements }),
      'structural-concept': stamp('structural-concept', {
        units: { ...units }, sourceRevision: revision, inputElementIds: elements.map(element => element.id), inputElementSnapshot: structuredClone(elements), inputGeometrySnapshot: structuredClone(geometry),
        calculationId: null, referenceStatus: 'pending-calculation', result: null, alternatives: [], structuralStudio: null,
        input: { width: 20, depth: 10, floors: 2, floorHeight: 3.4, baysX: 2, baysY: 2, usage: 'industrial', liveLoad: 3.5 },
        modelContext: { floorPlates: structuredClone(plates), selectedLevel: 2, planRevision: revision },
        geometrySupport: { status: 'unsupported-nonuniform-floor-analysis', fullBuildingAnalysis: false, technicalApproval: false },
        handoff: { id: 'H-03', source: 'plan-editor', target: 'structural-concept', synchronizedAt: time, state: 'synchronized' },
      }),
      'project-os': stamp('project-os', { coordination: { bimCoordination: { schema: 'ARKEM-BIM-COORDINATION/3.0', clashes: [{ guid: 'A', title: 'SYNTHETIC-RFI-A', severity: 'high' }, { guid: 'B', title: 'SYNTHETIC-RFI-B', severity: 'high' }] } }, workItems: [] }),
    },
  };
}
