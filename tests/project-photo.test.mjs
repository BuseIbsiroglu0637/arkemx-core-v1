import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { projectPhotoWindows, projectVisualKind, selectProjectPhoto } from '../app/lib/project-photo.ts';

test('new media stays unclassified until its source type has been reviewed', () => {
  for (const name of ['cihan-tamamlanan', 'cihan-tasiyici', 'viakasta', 'yapikur-montaj', 'yapikur-temel']) assert.equal(projectVisualKind(`/projects/v32/${name}.webp`), 'photo');
  assert.equal(projectVisualKind('/projects/v32/devrekani-3b.webp'), 'model');
  for (const name of ['/new-render.jpg', '/new-photo.webp', 'constructor', '__proto__']) assert.equal(projectVisualKind(name), 'unknown');
});

test('photo windows stay wholly inside the existing 1600 by 1000 archive files', () => {
  for (const [src, crop] of Object.entries(projectPhotoWindows)) {
    assert.ok(fs.existsSync(new URL(`../public${src}`, import.meta.url)), src);
    assert.ok(crop.x >= 0 && crop.y >= 0 && crop.size > 0, src);
    assert.ok(crop.x + crop.size <= 1600 && crop.y + crop.size <= 1000, src);
  }
});

test('only supplied image records can be chosen and later original photos remain unframed', () => {
  const photos = [
    { href: '/projects/v32/cihan-tasiyici.webp', contentType: 'image/webp' },
    { href: '/projects/v32/cihan-tamamlanan.webp', contentType: 'image/webp' },
  ];
  assert.equal(selectProjectPhoto('cihan-tat', photos), photos[1]);
  assert.equal(selectProjectPhoto('cihan-tat', photos.slice(0, 1)), photos[0]);
  assert.equal(selectProjectPhoto('new-project', [{ href: '/movie.mp4', contentType: 'video/mp4' }]), undefined);
  const original = { href: '/projects/new-original.jpg', contentType: 'image/jpeg' };
  assert.equal(selectProjectPhoto('new-project', [original]), original);
  assert.equal(projectPhotoWindows[original.href], undefined);
});
