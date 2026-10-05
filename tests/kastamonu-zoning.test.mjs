import test from 'node:test';
import assert from 'node:assert/strict';
import {queryKastamonuZoning,KASTAMONU_IMAR_ROOT} from '../app/lib/kastamonu-zoning.ts';
import {officialZoningPrefill} from '../app/lib/official-zoning-prefill.ts';
import {DEFAULT_ZONING,createZoningProvenance} from '../app/lib/zoning.ts';
const input={province:'Kastamonu',district:'Merkez',neighborhood:'Kuzyaka Köyü',neighborhoodId:'123',block:'143',parcelNo:'11'};
const parcel=[[33.5,41.2],[33.501,41.2],[33.501,41.201],[33.5,41.201],[33.5,41.2]];
const boundary=[[33.49,41.19],[33.51,41.19],[33.51,41.21],[33.49,41.21],[33.49,41.19]];
const cadastral={type:'Feature',properties:{ilAd:'Kastamonu',ilceAd:'Merkez',mahalleAd:'Kuzyaka Köyü',adaNo:'143',parselNo:'11'},geometry:{type:'Polygon',coordinates:[parcel]}};
const zone={objectid:42,planid:7,taks:.25,takstip:'Deger',emsalkaks:.75,emsalkakstip:'Deger',yapiyuksekligi:9.5,yapiyuksekligitip:'Deger',onbahcemesafesi:5,yanbahcemesafesi:3,yapiduzeni:'Ayrik'};
const plan={planid:7,planadi:'Sentetik uygulama planı',pinid:'UIP-TEST',planturid:1,planolcegi:'1/1000',plandurumu:'Onaylandi',planonaytarihi:Date.parse('2025-01-01')};
function fixture({cad=cadastral,zones=[{attributes:zone,geometry:{rings:[boundary],spatialReference:{wkid:4326}}}],plans=[{attributes:plan}],zoneError=false,status=200}={}) {
  const calls=[];
  const fetcher=async (url,options)=> {calls.push({url,options});const u=new URL(url);
    if(u.hostname==='cbsapi.tkgm.gov.tr')return Response.json(cad);
    assert.equal(u.origin+'/arcgis/rest/services/IDARE_PUBLIC/IMAR_PUBLIC/FeatureServer',KASTAMONU_IMAR_ROOT);
    assert.equal(options.redirect,'error');assert.ok(options.signal);
    return Response.json(zoneError?{error:{code:400}}:{spatialReference:{wkid:4326},features:u.pathname.includes('/1826/')?zones:plans},{status});
  };
  return {fetcher,calls};
}
test('source adapter re-reads TKGM, uses only current plan layer and scopes full geometry; values carry plan evidence without approval',async()=>{
  const f=fixture({zones:[{attributes:zone,geometry:{rings:[boundary]}}]}),r=await queryKastamonuZoning(input,f.fetcher);
  assert.equal(r.status,'found');assert.equal(f.calls.length,3);
  const u=new URL(f.calls[1].url);assert.ok(u.pathname.includes('/1826/query'));assert.equal(u.searchParams.get('inSR'),'4326');assert.deepEqual(JSON.parse(u.searchParams.get('geometry')).rings,[parcel]);
  assert.equal(r.conditions.taks,.25);assert.equal(r.conditions.kaks,.75);assert.equal(r.source.planId,'UIP-TEST');
  const next=officialZoningPrefill(DEFAULT_ZONING,r);assert.equal(next.sourceDate,'2025-01-01');assert.equal(next.frontSetback,5);assert.equal(next.rearSetback,-1);assert.equal(next.expertReviewStatus,'not-reviewed');assert.equal(createZoningProvenance(next,'143/11').authoritative,false);
});
test('source absence, overlaps, partial coverage and invalid plan status do not produce zoning rights',async()=>{
  assert.equal((await queryKastamonuZoning(input,fixture({zones:[]}).fetcher)).status,'not-found');
  const z={attributes:zone,geometry:{rings:[boundary],spatialReference:{wkid:4326}}};
  assert.equal((await queryKastamonuZoning(input,fixture({zones:[z,z]}).fetcher)).status,'ambiguous');
  const partial=[[33.49,41.19],[33.5005,41.19],[33.5005,41.21],[33.49,41.21],[33.49,41.19]];
  assert.equal((await queryKastamonuZoning(input,fixture({zones:[{...z,geometry:{rings:[partial],spatialReference:{wkid:4326}}}]}).fetcher)).status,'ambiguous');
  for(const override of [{plandurumu:'DevamEdiyor'},{planolcegi:'1/5000'},{planid:8},{planonaytarihi:null}]) assert.equal((await queryKastamonuZoning(input,fixture({plans:[{attributes:{...plan,...override}}]}).fetcher)).status,'ambiguous');
});
test('wrong parcel scope, malformed geometry, errors and restricted access remain explicit failures',async()=>{
  await assert.rejects(queryKastamonuZoning(input,fixture({cad:{...cadastral,properties:{...cadastral.properties,mahalleAd:'Başka Köy'}}}).fetcher),e=>e.code==='parcel-mismatch');
  await assert.rejects(queryKastamonuZoning(input,fixture({cad:{...cadastral,geometry:{type:'Polygon',coordinates:[parcel,parcel]}}}).fetcher),e=>e.code==='geometry-unsupported');
  await assert.rejects(queryKastamonuZoning({...input,neighborhoodId:'123/evil'},fixture().fetcher),e=>e.code==='invalid-input');
  await assert.rejects(queryKastamonuZoning(input,fixture({zoneError:true}).fetcher),e=>e.code==='source-error');
  await assert.rejects(queryKastamonuZoning(input,fixture({status:403}).fetcher),e=>e.code==='access-restricted');
  await assert.rejects(queryKastamonuZoning(input,async()=>{throw Error('network');}),e=>e.code==='unavailable');
  let calls=0;assert.equal((await queryKastamonuZoning({...input,province:'Sakarya'},async()=>{calls++;})).status,'unsupported');assert.equal(calls,0);
});
test('null and non-value fields stay unknown; manual, reviewed and edited listing work is preserved',async()=>{
  const z={attributes:{...zone,taks:null,emsalkakstip:'Serbest',yapiyuksekligitip:'GecerliDegil'},geometry:{rings:[boundary],spatialReference:{wkid:4326}}};
  const r=await queryKastamonuZoning(input,fixture({zones:[z]}).fetcher);assert.equal(r.conditions.taks,null);assert.equal(r.conditions.kaks,null);assert.equal(r.conditions.hmax,null);
  assert.equal(officialZoningPrefill({...DEFAULT_ZONING,taks:.4},r),null);assert.equal(officialZoningPrefill({...DEFAULT_ZONING,expertReviewStatus:'reviewed-consistent'},r),null);
  const listing={taks:.4,kaks:.8,hmax:7.5,landUse:'Konut İmarlı',sourceUrl:'https://www.emlakjet.com/ilan/test-12345678'};
  const current={...DEFAULT_ZONING,...listing,sourceType:'İlan beyanı',sourceNote:'Otomatik ilan aktarımı · örnek'};
  const next=officialZoningPrefill(current,r,listing);assert.equal(next.taks,-1);assert.equal(next.kaks,-1);assert.equal(next.landUse,'Konut Alanı');
  assert.equal(officialZoningPrefill({...current,taks:.5},r,listing),null);
});
