import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(root, 'app/data/project-presentations.json'), 'utf8'));
const publicPath = url => {
  assert.match(url, /^\/(references\/2026-10|projects\/v32)\/[a-z0-9/_\-.]+$/i);
  const resolved = path.resolve(root, 'public', '.' + url);
  assert.ok(resolved.startsWith(path.join(root, 'public') + path.sep));
  return resolved;
};

test('reference catalog has unique identities, source labels and honest boundaries', () => {
  assert.equal(data.length, 26);
  assert.equal(new Set(data.map(x => x.slug)).size, data.length);
  assert.equal(data.filter(x => x.model).length, 18);
  for (const item of data) {
    assert.ok(item.title.length > 2 && item.summary.length > 15);
    assert.ok(item.scopeNote.length > 30);
    assert.ok(item.package && item.gallery.length);
    assert.ok(item.gallery.some(image => image.src === item.cover.src));
    for (const image of item.gallery) {
      assert.ok(['photo', 'model', 'drawing'].includes(image.kind));
      assert.ok(image.alt && image.caption);
      assert.ok(fs.statSync(publicPath(image.src)).size > 0);
    }
  }
});

test('uncertain identities, oversized model and ambiguous floor areas stay unpublished', () => {
  assert.equal(data.find(x => x.slug === 'viakasta').model, undefined);
  assert.ok(data.find(x => x.slug === 'viakasta').gallery.every(x => x.kind === 'photo'));
  assert.equal(data.find(x => x.slug === 'ahir-projesi-04').model, undefined);
  assert.ok(data.find(x => x.slug === 'ahir-projesi-04').modelNotice);
  assert.equal(data.some(x => ['bayram-cebecioglu', 'susa-kubbe'].includes(x.slug)), false);
  assert.doesNotMatch(JSON.stringify(data.find(x => x.slug === 'isil-kilic-hafif-celik-villa').facts), /222|193[.,]4/);
  assert.doesNotMatch(JSON.stringify(data.find(x => x.slug === 'ahir-projesi-07').facts), /100|112/);
});

test('public selection contains only curated media, not private documents or package executables', () => {
  for (const file of fs.readdirSync(path.join(root, 'public/references/2026-10'), { recursive: true, withFileTypes: true })) {
    if (file.isDirectory()) continue;
    assert.match(file.name, /\.(webp|jpg|png|glb)$/);
    assert.ok(fs.statSync(path.join(file.parentPath, file.name)).size <= 20_000_000);
  }
  assert.doesNotMatch(JSON.stringify(data), /C:\\\\Users|api[_-]?key|password|TC Kimlik|telefon numarası/i);
});

for (const project of data) for (const model of [project.model, ...(project.additionalModels || [])].filter(Boolean)) {
  test(`GLTFLoader opens ${project.slug}: ${model.label} with finite world bounds`, async () => {
    const binary = fs.readFileSync(publicPath(model.src));
    assert.equal(binary.byteLength, model.bytes);
    assert.equal(binary.readUInt32LE(0), 0x46546c67);
    assert.equal(binary.readUInt32LE(4), 2);
    assert.equal(binary.readUInt32LE(8), binary.byteLength);
    const doc = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)).toString('utf8'));
    for (const entry of [...doc.buffers || [], ...doc.images || []]) if (entry.uri) assert.match(entry.uri, /^data:/);
    const gltf = await new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength), '');
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene, true);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.toArray().every(n => Number.isFinite(n) && n > 0));
    let meshes = 0;
    gltf.scene.traverse(object => { if (object.isMesh) { meshes++; object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } });
    assert.ok(meshes > 0);
  });
}

test('viewer code defers heavy resources and disposes when closed', () => {
  const component = fs.readFileSync(path.join(root, 'app/components/ReferenceModel.tsx'), 'utf8');
  const viewer = fs.readFileSync(path.join(root, 'app/lib/reference-model-viewer.ts'), 'utf8');
  assert.match(component, /if \(!requested/);
  assert.match(component, /import\('\.\.\/lib\/reference-model-viewer'\)/);
  assert.match(component, /controller\.abort\(\)/);
  assert.match(viewer, /new GLTFLoader\(\)\.parseAsync/);
  assert.match(viewer, /modelFitDistance/);
  assert.match(viewer, /webglcontextlost/);
  assert.doesNotMatch(viewer, /setInterval|setAnimationLoop/);
});
