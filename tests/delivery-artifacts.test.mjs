import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { deliveryDigest, deliverySourceKey, inspectDeliveryArtifact, validateDeliveryArtifacts } from '../app/lib/delivery-artifacts.ts';

const files=[{format:'JSON',name:'TEST-P01.json',sourceModule:'client-portal'}];
const project={id:'TEST',revision:'P01',modules:{a:{value:1}}};
const sourceKey=deliverySourceKey(project);
const expected={projectId:'TEST',revision:'P01',sourceKey};
const json=JSON.stringify({schema:'ARKEM-DELIVERY/2.0',project:{id:'TEST',revision:'P01'},modules:[{id:'a'}]});

test('declarations and positive byte counts cannot validate missing files',()=>{
  const declared=validateDeliveryArtifacts([{...files[0],bytes:1,revision:'P01'}]);
  assert.equal(declared.summary.valid,0);
  assert.equal(declared.checks[0].status,'Oluşturulmadı');
  assert.equal(validateDeliveryArtifacts(files,{JSON:{sourceKey,content:json}},sourceKey).checks[0].status,'Kontrol bekliyor');
});
test('real JSON parses, binds current project and rejects corruption, empty data and altered contents',async()=>{
  const validation=await inspectDeliveryArtifact('JSON',json,{...expected,text:json});
  assert.equal(validation.valid,true);
  assert.equal(validation.bytes,new TextEncoder().encode(json).length);
  assert.match(validation.sha256,/^[a-f0-9]{64}$/);
  assert.equal(validateDeliveryArtifacts(files,{JSON:{sourceKey,content:json,validation}},sourceKey).summary.valid,1);
  for(const content of ['', '{broken',json.replace('TEST','OTHER'),json.replace('"a"','"b"')])
    assert.equal((await inspectDeliveryArtifact('JSON',content,{...expected,text:json})).valid,false);
  assert.equal((await inspectDeliveryArtifact('JSON',json,{...expected,revision:'P02',text:json})).valid,false);
});
test('source changes invalidate same-revision artifacts and errors stay visible',async()=>{
  const validation=await inspectDeliveryArtifact('JSON',json,{...expected,text:json});
  const artifacts={JSON:{sourceKey,content:json,validation}};
  const changed=deliverySourceKey({...project,modules:{a:{value:2}}});
  assert.equal(validateDeliveryArtifacts(files,artifacts,changed).checks[0].status,'Güncel değil');
  assert.equal(validateDeliveryArtifacts(files,artifacts,changed).summary.valid,0);
  assert.equal(validateDeliveryArtifacts(files,{JSON:{sourceKey,error:'Disk üretim hatası'}},sourceKey).checks[0].status,'Hatalı');
  assert.equal(validateDeliveryArtifacts(files,{},sourceKey).summary.valid,0);
});
test('CSV checks identity, headers and actual module rows',async()=>{
  const csv='\uFEFF"Proje";"Revizyon";"Kod";"Modül"\n"TEST";"P01";"A";"Mimari"\n"TEST";"P01";"B";"Taşıyıcı"';
  assert.equal((await inspectDeliveryArtifact('CSV',csv,{...expected,text:csv})).valid,true);
  for(const actual of ['',csv.replace('"A"','"X"'),csv.replaceAll('P01','P02')])
    assert.equal((await inspectDeliveryArtifact('CSV',actual,{...expected,text:csv})).valid,false);
  const bad='"Kod"\n"TEST"\n"TEST"';
  assert.equal((await inspectDeliveryArtifact('CSV',bad,{...expected,text:bad})).valid,false);
});
test('PDF parses real bytes and requires pages, content and current project binding',async()=>{
  const pdf=await PDFDocument.create();pdf.setTitle('TEST - Yönetici Özeti');
  pdf.setSubject(JSON.stringify({projectId:'TEST',revision:'P01',sourceDigest:await deliveryDigest(sourceKey)}));
  pdf.addPage().drawText('TEST P01 preliminary report');
  const bytes=await pdf.save();
  assert.equal((await inspectDeliveryArtifact('PDF',bytes,expected)).valid,true);
  assert.equal((await inspectDeliveryArtifact('PDF',bytes,{...expected,sourceKey:sourceKey+'changed'})).valid,false);
  assert.equal((await inspectDeliveryArtifact('PDF',bytes.slice(0,80),expected)).valid,false);
  assert.equal((await inspectDeliveryArtifact('PDF',new Uint8Array(),expected)).valid,false);
  const blank=await PDFDocument.create();blank.addPage();blank.setTitle(pdf.getTitle());blank.setSubject(pdf.getSubject());
  assert.equal((await inspectDeliveryArtifact('PDF',await blank.save(),expected)).valid,false);
  assert.equal((await inspectDeliveryArtifact('DXF','not-a-drawing',expected)).valid,false);
});
