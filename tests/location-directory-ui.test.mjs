import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fetchTkgmJson} from '../app/lib/tkgm-client.ts';
import {createParcelRecord} from '../app/lib/parcel-record.ts';

const studio=fs.readFileSync(new URL('../app/components/GeoParcelStudio.tsx',import.meta.url),'utf8');
const form=fs.readFileSync(new URL('../app/components/ParcelLocationStep.tsx',import.meta.url),'utf8');
test('guided location directory no longer requests rejected TKGM child directories',()=>{
 assert.match(studio,/loadLocationDistricts\(province, controller.signal\)/);
 assert.match(studio,/loadLocationNeighborhoods\(districtId, controller.signal\)/);
 assert.doesNotMatch(studio,/fetchTkgmJson\(`idariYapi\/(?:ilceListe|mahalleListe)/);
 assert.match(studio,/matches.length !== 1/);
});
test('continue requires current selections and queries the parcel while file upload remains optional',()=>{
 assert.match(form,/field.options.some\(option => option.id === field.value\)/);
 assert.match(form,/props.identityReady && currentSelections/);
 assert.match(form,/Parseli haritada göster/);
 assert.match(form,/Parsel sınırı otomatik sorgulanır/);
 assert.match(form,/isteğe bağlı uzman seçenekleri/);
 assert.doesNotMatch(form,/Sınır dosyası ekleyerek devam et|TKGM otomatik sınır bağlantısı şu anda kullanılamıyor|hasOfficialIds/);
 assert.doesNotMatch(form,/mahalle \/ köy · TKGM kaynak listesi/);
});

test('parcel query resolves selected raw names before transport and does not replace visible selection labels',()=>{
 const lookup=studio.slice(studio.indexOf('  const locateOfficialParcel ='),studio.indexOf('  const handleFile ='));
 assert.match(lookup,/locationDirectoryLookupName\(districtOptions.find\(option => option.id === districtId\), 'district'\)/);
 assert.match(lookup,/locationDirectoryLookupName\(neighborhoodOptions.find\(option => option.id === neighborhoodId\), 'neighborhood'\)/);
 assert.match(lookup,/lookupTkgmParcel\(\{ province, district: districtName, neighborhood: neighborhoodName, block, parcelNo \}\)/);
 assert.ok(lookup.indexOf('locationDirectoryLookupName')<lookup.indexOf('await lookupTkgmParcel'));
 assert.doesNotMatch(lookup,/setNeighborhood\(neighborhoodName\)|setDistrict\(districtName\)/);
});
test('directory identifiers cannot be sent to the cadastral API',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('no network expected');};
 try {await assert.rejects(fetchTkgmJson('parsel/directory-neighborhood-54-2071-61592/418/10'),/Geçersiz/);assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test('a completed name-only selection does not create cadastral geometry or official evidence',()=>{
 const r=createParcelRecord({identity:{province:'Sakarya',district:'Serdivan',neighborhood:'Bahçelievler',block:'418',parcelNo:'10'},geometry:[],source:{kind:'sample',authority:'',label:'No source boundary',capturedAt:'',url:''}});
 assert.equal(r.projectEligible,false);assert.equal(r.geometry.valid,false);assert.equal(r.evidence.officialCadastre,false);
});
