import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIORITY_ZONING_REGIONS, normalizeZoningPlace } from '../app/data/zoning-regions.ts';
import { resolveZoningPortal, resolveZoningAuthority } from '../app/data/zoning-authorities.ts';
import { resolveParcelSourceNetwork } from '../app/lib/parcel-record.ts';

test('five priority source directories contain exactly 130 unique, named districts', () => {
  assert.deepEqual(PRIORITY_ZONING_REGIONS.map(region => [region.province, region.districts.length]), [['İstanbul',39],['Ankara',25],['İzmir',30],['Sakarya',16],['Kastamonu',20]]);
  const keys = PRIORITY_ZONING_REGIONS.flatMap(region => region.districts.map(district => `${region.province}/${normalizeZoningPlace(district)}`));
  assert.equal(keys.length, 130);
  assert.equal(new Set(keys).size, 130);
});

test('regional research sources resolve only for regions with a shared research scope', () => {
  for (const region of PRIORITY_ZONING_REGIONS.filter(region => region.routingScope === 'regional-research')) for (const district of region.districts) {
    const portal = resolveZoningPortal(region.province, district);
    assert.ok(portal, `${region.province}/${district}`);
    assert.equal(portal.province, region.province);
  }
});

test('district-specific sources outrank metropolitan fallback even when it comes first', () => {
  assert.equal(resolveZoningPortal('Sakarya', 'Serdivan').id, 'serdivan-keos');
  assert.equal(resolveZoningPortal('Sakarya', 'Adapazarı').id, 'adapazari-e-devlet-imar');
  assert.equal(resolveZoningPortal('Sakarya', 'Sapanca').id, 'sapanca-e-devlet-imar');
  assert.equal(resolveZoningPortal('Sakarya', 'Hendek').id, 'sakarya-kent-rehberi');
});

test('Turkish and ASCII place names normalize without losing province scope', () => {
  assert.equal(resolveZoningPortal(' ISTANBUL ', ' KADIKOY ').id, 'istanbul-plan-aski');
  assert.equal(resolveZoningPortal('izmir', 'Karsiyaka').id, 'izmir-kent-rehberi');
  assert.equal(resolveZoningPortal(' ANKARA ', 'Kahramankazan').id, 'ankara-eimar');
  assert.equal(resolveZoningAuthority(' IZMiR ').province, 'İzmir');
});

test('unrecognized districts or provinces do not falsely claim verified coverage', () => {
  assert.equal(resolveZoningPortal('İzmir', 'Hayali ilçe'), null);
  assert.equal(resolveZoningPortal('Ankara', 'Kadıköy'), null);
  assert.equal(resolveZoningPortal('Bilinmeyen', 'Merkez'), null);
});

test('source handoff is explicitly not an authorized API or a certified document', () => {
  const portals = [
    ...PRIORITY_ZONING_REGIONS.filter(region => region.routingScope === 'regional-research').map(region => resolveZoningPortal(region.province)),
    resolveZoningPortal('Kastamonu', 'Merkez', 'Budamış'),
    resolveZoningPortal('İstanbul', 'Beşiktaş', 'Yıldız'),
  ];
  for (const portal of portals) {
    assert.equal(portal.integrationMode, 'official-source-handoff');
    assert.equal(portal.authorizedApi, 'not-verified');
    assert.equal(portal.certifiedDocument, 'not-verified');
    assert.ok(portal.verification.length > 30);
    assert.ok(portal.limitation.length > 30);
  }
});

test('priority sources use HTTPS official domains, with traceable dated source pages', () => {
  for (const region of PRIORITY_ZONING_REGIONS) {
    for (const value of [region.href, region.sourcePage, region.districtSource]) {
      const url = new URL(value);
      assert.equal(url.protocol, 'https:');
      assert.match(url.hostname, /(?:\.gov\.tr|\.bel\.tr|\.ibb\.gov\.tr|ibb\.istanbul)$/);
    }
    assert.match(region.verifiedAt, /^2026-10-(0[34]|1[01])$/);
  }
});

test('Budamış municipal route needs matching province, district and settlement', () => {
  for (const neighborhood of ['Budamış', ' Budamış Mahallesi ', 'BUDAMIS MAH.', 'budamis mah']) {
    const portal = resolveZoningPortal(' KASTAMONU ', ' MERKEZ ', neighborhood);
    assert.equal(portal.id, 'kastamonu-belediyesi');
    assert.equal(portal.authority, 'Kastamonu Belediyesi');
    assert.equal(portal.href, 'https://www.kastamonu.bel.tr/e-uygulama/');
    assert.equal(portal.portalHref, 'https://keos.kastamonu.bel.tr:1443/imardurumu/');
  }
  assert.equal(resolveZoningPortal('Kastamonu', 'Araç', 'Budamış'), null);
  assert.equal(resolveZoningPortal('Kastamonu', 'Merkez', 'Budamış Köyü'), null);
  assert.equal(resolveZoningPortal('Bilinmeyen', 'Merkez', 'Budamış'), null);
});

test('unknown Kastamonu settlements are not routed province-wide to the special administration', () => {
  for (const district of PRIORITY_ZONING_REGIONS.find(region => region.province === 'Kastamonu').districts) {
    assert.equal(resolveZoningPortal('Kastamonu', district), null);
    assert.equal(resolveZoningPortal('Kastamonu', district, 'Yetkisi bilinmeyen köy'), null);
  }
  assert.equal(resolveZoningPortal('Kastamonu'), null);
  assert.equal(resolveZoningAuthority('Kastamonu', 'Merkez').localSourceState, 'adapter-required');
});

test('Beşiktaş district source outranks metropolitan plan search without certifying special-zone jurisdiction', () => {
  const portal = resolveZoningPortal('Istanbul', 'Besiktas', 'Yildiz');
  assert.equal(portal.id, 'besiktas-keos');
  assert.equal(portal.href, 'https://besiktas.bel.tr/');
  assert.equal(portal.sourcePage, 'https://besiktas.bel.tr/');
  assert.match(portal.limitation, /Boğaziçi/);
  const authority = resolveZoningAuthority('İstanbul', 'Beşiktaş', 'Yıldız');
  assert.equal(authority.primaryAuthority, 'Beşiktaş Belediyesi');
  assert.equal(authority.jurisdictionVerified, false);
});

test('source network uses the matched municipality and preserves unresolved jurisdiction', () => {
  const budamis = resolveParcelSourceNetwork('Kastamonu', 'Merkez', 'Budamış Mahallesi');
  assert.match(budamis.authority, /^Kastamonu Belediyesi/);
  assert.ok(budamis.sources.some(source => source.id === 'kastamonu-belediyesi' && source.state === 'matched'));
  assert.ok(budamis.sources.every(source => source.id !== 'kastamonu-ozel-idare'));
  const unknown = resolveParcelSourceNetwork('Kastamonu', 'Merkez', 'Başka köy');
  assert.equal(unknown.sources.find(source => source.id === 'local-authority').state, 'verification-required');
  assert.ok(unknown.sources.every(source => source.id !== 'kastamonu-ozel-idare'));
  const yildiz = resolveParcelSourceNetwork('İstanbul', 'Beşiktaş', 'Yıldız');
  assert.match(yildiz.authority, /^Beşiktaş Belediyesi/);
  assert.ok(yildiz.sources.some(source => source.id === 'besiktas-keos'));
});
