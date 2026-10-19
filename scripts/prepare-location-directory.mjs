/**
 * Build the public administrative directory from an immutable MIT source.
 * Raw input is retained separately; never uses or translates TKGM identifiers.
 * Usage: node scripts/prepare-location-directory.mjs --raw-dir <new output folder>
 * Existing raw input is reused only after hash verification against raw-source.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = 'a0ad8351cb52153e7a92aa7ba9a5bc1e3294da8d';
const BASE = `https://raw.githubusercontent.com/ubeydeozdmr/turkiye-api/${COMMIT}`;
const KINDS = ['provinces', 'districts', 'neighborhoods', 'villages'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const argIndex = process.argv.indexOf('--raw-dir');
if (argIndex < 0 || !process.argv[argIndex + 1]) throw new Error('Supply --raw-dir for retained source inputs.');
const rawDir = path.resolve(process.argv[argIndex + 1]);
const manifestPath = path.join(rawDir, 'raw-source.json');
await fs.mkdir(rawDir, {recursive:true});
let rawSource;
try { rawSource = JSON.parse(await fs.readFile(manifestPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (rawSource && rawSource.commit !== COMMIT) throw new Error('Raw source commit mismatch.');
const raw = {};
const sources = [];
for (const kind of [...KINDS, 'LICENSE']) {
  const file = kind === 'LICENSE' ? 'LICENSE.txt' : `${kind}.json`;
  const url = `${BASE}/${kind === 'LICENSE' ? 'LICENSE' : `datasets/2025/${kind}.json`}`;
  let bytes;
  if (rawSource) {
    const expected = rawSource.sources.find(item => item.file === file);
    bytes = await fs.readFile(path.join(rawDir, file));
    if (!expected || expected.url !== url || expected.sha256 !== sha256(bytes)) throw new Error(`Raw integrity mismatch: ${file}`);
  } else {
    const response = await fetch(url, {redirect:'error', signal:AbortSignal.timeout(30_000)});
    if (!response.ok) throw new Error(`Source failed: ${kind} (${response.status}); no alternate access attempted.`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 30_000_000) throw new Error(`Source too large: ${kind}`);
    await fs.writeFile(path.join(rawDir, file), bytes, {flag:'wx'});
  }
  raw[kind] = kind === 'LICENSE' ? bytes.toString('utf8') : JSON.parse(bytes.toString('utf8'));
  sources.push({file,url,sha256:sha256(bytes),bytes:bytes.length});
}
const capturedAt = rawSource?.capturedAt ?? new Date().toISOString();
if (!rawSource) await fs.writeFile(manifestPath, JSON.stringify({commit:COMMIT,capturedAt,sources},null,2)+'\n',{flag:'wx'});
const expectedCounts = {provinces:81,districts:973,neighborhoods:32254,villages:18183};
const positiveInt = value => Number.isSafeInteger(value) && value > 0;
const validName = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 140 && !/[\u0000-\u001f\u007f]/u.test(value);
for (const kind of KINDS) {
  if (!Array.isArray(raw[kind]) || raw[kind].length !== expectedCounts[kind]) throw new Error(`Unexpected ${kind} count.`);
  const ids = new Set();
  for (const row of raw[kind]) {
    if (!positiveInt(row.id) || ids.has(row.id) || !validName(row.name)) throw new Error(`Invalid ${kind} identity or label.`);
    ids.add(row.id);
  }
}
if (!raw.LICENSE.includes('MIT License') || !raw.LICENSE.includes('Copyright (c) 2022-2026 Ubeyde Emir Özdemir')) throw new Error('Unexpected source license.');
const provinces = new Map(raw.provinces.map(row=>[row.id,row]));
if (Array.from({length:81},(_,i)=>i+1).some(id=>!provinces.has(id))) throw new Error('Incomplete province plate-code set.');
const districts = new Map(raw.districts.map(row=>[row.id,row]));
for (const district of districts.values()) if (!provinces.has(district.provinceId)) throw new Error('Orphan district.');
for (const kind of ['neighborhoods','villages']) {
  for (const row of raw[kind]) if (!provinces.has(row.provinceId) || districts.get(row.districtId)?.provinceId !== row.provinceId) throw new Error(`Orphan or mismatched ${kind} parent.`);
}
const publicDir = path.join(ROOT,'public/data/location-directory');
await fs.mkdir(path.join(publicDir,'2025'),{recursive:true});
const provinceIndex = [];
for (const province of raw.provinces.toSorted((a,b)=>a.id-b.id)) {
  const districtRows = raw.districts.filter(row=>row.provinceId===province.id).map(row=>[row.id,row.provinceId,row.name]);
  const settlementRows = ['neighborhoods','villages'].flatMap(kind=>raw[kind].filter(row=>row.provinceId===province.id).map(row=>[row.id,row.provinceId,row.districtId,kind==='villages'?'v':'n',row.name]));
  const shard = {schemaVersion:1,datasetVersion:'2025',province:{id:province.id,name:province.name},districts:districtRows,settlements:settlementRows};
  const bytes = Buffer.from(JSON.stringify(shard)+'\n');
  const hash = sha256(bytes);
  const file = `2025/${province.id}.${hash.slice(0,12)}.json`;
  if (bytes.length > 2*1024*1024) throw new Error('Province shard exceeds browser bound.');
  await fs.writeFile(path.join(publicDir,file),bytes);
  provinceIndex.push({id:province.id,name:province.name,file,sha256:hash,districtCount:districtRows.length,settlementCount:settlementRows.length});
}
const source = {
  name:'TurkiyeAPI bağımsız yerleşim dizini',
  url:'https://docs.turkiyeapi.dev/tr/v2/guide/datasets',
  datasetVersion:'2025',
  capturedAt,
  counts:{...expectedCounts,settlements:raw.neighborhoods.length+raw.villages.length},
  license:'MIT',
  copyright:'Copyright (c) 2022-2026 Ubeyde Emir Özdemir',
  licenseUrl:`${BASE}/LICENSE`,
  localLicenseUrl:'/data/location-directory/LICENSE.txt',
  manifestUrl:'/data/location-directory/source.json',
  sourceCommit:COMMIT,
  notice:'Bağımsız idari yerleşim dizinidir; resmî TKGM parsel kimliği, sınırı veya güncel imar bilgisi değildir.',
  sources
};
await fs.writeFile(path.join(publicDir,'LICENSE.txt'),raw.LICENSE);
await fs.writeFile(path.join(publicDir,'source.json'),JSON.stringify({...source,shards:provinceIndex},null,2)+'\n');
// Generated metadata is derived mechanically from the validated immutable input.
await fs.writeFile(path.join(ROOT,'app/data/location-directory-source.ts'),
  `// Generated by scripts/prepare-location-directory.mjs. Do not hand-edit.\n// Independent MIT directory IDs are NOT TKGM cadastral IDs.\nexport const LOCATION_DIRECTORY_SOURCE = ${JSON.stringify(source,null,2)} as const;\n\nexport const LOCATION_DIRECTORY_PROVINCES = ${JSON.stringify(provinceIndex,null,2)} as const;\n`);
const shardBytes = await Promise.all(provinceIndex.map(async row=>(await fs.stat(path.join(publicDir,row.file))).size));
console.log(JSON.stringify({capturedAt,counts:source.counts,publicDir,shards:provinceIndex.length,maxShardBytes:Math.max(...shardBytes)},null,2));
