import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PARCEL_BASEMAPS } from '../app/lib/parcel-basemaps.ts';

const studio = readFileSync(new URL('../app/components/GeoParcelStudio.tsx', import.meta.url), 'utf8');
const terrainViewer = readFileSync(new URL('../app/components/GeoTerrainViewer.tsx', import.meta.url), 'utf8');

test('map options include street, satellite and topographic imagery with source attribution', () => {
  assert.deepEqual(Object.keys(PARCEL_BASEMAPS), ['osm', 'satellite', 'topographic']);
  for (const [id, map] of Object.entries(PARCEL_BASEMAPS)) {
    assert.ok(map.label, id);
    assert.match(map.url, /^https:\/\//, id);
    assert.ok(map.attribution, id);
  }
  assert.match(studio, /aria-label="Harita görünümü"/);
  assert.match(studio, /setBasemapMode/);
  assert.match(studio, /Harita görünümü parselin kot veya imar verisini doğrulamaz/);
});

test('guided GIS does not expose the expert mode toggle and keeps file import accessible', () => {
  assert.doesNotMatch(studio, /Uzman araçlarını göster|setExpertMode/);
  assert.match(studio, /onImport=\{\(\) => setActiveStage\('import'\)\}/);
});

test('terrain tab has an explicit missing-boundary state and renders without a placed building', () => {
  assert.match(studio, /terrainPreviewReady = parcelRecord.projectEligible && metrics.geometryValid && parcel.length >= 3/);
  assert.match(studio, /viewMode === "terrain" && \(terrainPreviewReady \?/);
  assert.match(studio, /hasBuilding=\{hasPlacedModel\}/);
  assert.match(studio, /3B arazi için parsel sınırı gerekli/);
  assert.match(terrainViewer, /if \(hasBuilding && layers\["building-mass"\]\)/);
  assert.match(terrainViewer, /const analysis = hasBuilding \?/);
  assert.match(terrainViewer, /Hesaplanmadı/);
});
