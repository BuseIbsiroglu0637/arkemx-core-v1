import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';
import {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createProjectShellFixture,createProjectShellFixtureSource}=await import('./fixtures/project-shell-project.mjs');
const {recordProjectShellCalculation}=await import('../app/lib/project-shell-calculation.ts');
const {createProjectShellArtifact,readProjectShellPackage,verifyProjectShellDocument}=await import('../app/lib/project-shell-documents.ts');
const {traceJson,traceSha256}=await import('../app/lib/structural-traceability.ts');
const project=createProjectShellFixture(),sources=[1,2].map(l=>createProjectShellFixtureSource(project,l));
const records=await Promise.all(sources.map(s=>recordProjectShellCalculation(project,s)));
const viewFor=r=>({caseId:'G',field:'Mxx',magnification:100,elementId:r.content.sourceRecord.content.model.elements[0].id});
const assets={regularFont:new Uint8Array(fs.readFileSync('public/fonts/ArkemSans-Regular.ttf')),boldFont:new Uint8Array(fs.readFileSync('public/fonts/ArkemSans-Bold.ttf'))};
const out=path.resolve('test-artifacts/project-shell-documents');fs.mkdirSync(out,{recursive:true});
test('A04 two floors export full portable project and raw cases with distinct source/calculation identities',async()=>{
 for(let i=0;i<2;i++){
  const a=await createProjectShellArtifact(project,sources[i],records[i],'JSON',viewFor(records[i])),pkg=await readProjectShellPackage(a.bytes,project,sources[i]);
  assert.deepEqual(pkg.calculation,records[i]);assert.deepEqual(pkg.manifest.source,sources[i]);
  assert.equal(pkg.project.modules['plan-editor'].projectShellSources[sources[i].sourcePlateId].sourcePlateId,sources[i].sourcePlateId);
  assert.equal(pkg.manifest.provenance.kind,'synthetic-project');assert.equal(pkg.technicalApproval,false);assert.equal(pkg.fullBuildingAnalysis,false);
  assert.ok(await verifyProjectShellDocument(a.document,project,sources[i],records[i],a.bytes));
  assert.equal(await verifyProjectShellDocument(a.document,project,sources[i],records[i],a.bytes+' '),false);
  fs.writeFileSync(path.join(out,'floor-'+(i+1)+'.json'),a.bytes);fs.writeFileSync(path.join(out,'floor-'+(i+1)+'-JSON.proof.json'),JSON.stringify(a.document,null,2));
 }
 assert.notEqual(records[0].id,records[1].id);assert.notEqual(sources[0].sourcePlateId,sources[1].sourcePlateId);
});
test('A04 PDF retains project provenance, embeds a verifiable complete package and paginates both floors',async()=>{
 for(let i=0;i<2;i++){
  const a=await createProjectShellArtifact(project,sources[i],records[i],'PDF',viewFor(records[i]),assets),pdf=await PDFDocument.load(a.bytes);
  assert.ok(pdf.getPageCount()>=6);
  const names=pdf.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict).lookup(PDFName.of('Names'),PDFArray);
  assert.equal(names.lookup(0).decodeText(),'arkemx-project-shell-package.json');
  const stream=names.lookup(1,PDFDict).lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'),PDFRawStream);
  const pkg=await readProjectShellPackage(new TextDecoder().decode(decodePDFRawStream(stream).decode()));
  assert.deepEqual(pkg.calculation,records[i]);assert.equal(pkg.manifest.format,'PDF');assert.equal(pkg.manifest.sourcePlateId,sources[i].sourcePlateId);
  fs.writeFileSync(path.join(out,'floor-'+(i+1)+'.pdf'),a.bytes);fs.writeFileSync(path.join(out,'floor-'+(i+1)+'-PDF.proof.json'),JSON.stringify(a.document,null,2));
 }
});
test('A04 DXF binds project element IDs, uses metres and preserves actual upper-floor Z',async()=>{
 const a=await createProjectShellArtifact(project,sources[1],records[1],'DXF',viewFor(records[1])),pairs=a.bytes.split('\r\n').filter(Boolean);
 assert.match(a.bytes,/\$INSUNITS\r\n70\r\n6/);assert.match(a.bytes,/30\r\n3\.4000000000/);
 let inside=false,meta='',faces=0;
 for(let i=0;i<pairs.length;i+=2){if(pairs[i]==='0'&&pairs[i+1]==='3DFACE')faces++;if(pairs[i]==='999'){if(pairs[i+1]==='ARKEMX_SHELL_TRACE_BEGIN')inside=true;else if(pairs[i+1]==='ARKEMX_SHELL_TRACE_END')inside=false;else if(inside){assert.ok(Buffer.byteLength(pairs[i+1])<=220);meta+=pairs[i+1];}}}
 const m=JSON.parse(meta);assert.equal(m.sourcePlateId,sources[1].sourcePlateId);assert.deepEqual(m.sourceElementIds,['U-A']);assert.equal(m.calculationId,records[1].id);assert.equal(faces,256);
 assert.ok(await verifyProjectShellDocument(a.document,project,sources[1],records[1],a.bytes));fs.writeFileSync(path.join(out,'floor-2.dxf'),a.bytes);
});
test('A04 forged numerical fields remain rejected even after attacker recomputes calculation and manifest hashes',async()=>{
 const a=await createProjectShellArtifact(project,sources[0],records[0],'JSON',viewFor(records[0])),p=JSON.parse(a.bytes);
 p.calculation.content.cases[0].centerUz=123;p.calculation.sha256=await traceSha256(traceJson(p.calculation.content));p.calculation.id='PROJECT-SHELL-CALC-'+p.calculation.sha256;
 p.manifest.calculationId=p.calculation.id;p.manifest.calculationSha256=p.calculation.sha256;
 await assert.rejects(readProjectShellPackage(JSON.stringify(p)),/yeniden hesaplanan/);
});
test('A04 changed provenance, project data, source links and approval claims never import',async()=>{
 const a=await createProjectShellArtifact(project,sources[0],records[0],'JSON',viewFor(records[0]));
 for(const mutate of [p=>p.technicalApproval=true,p=>p.fullBuildingAnalysis=true,p=>p.manifest.technicalApproval=true,p=>p.manifest.sourceElementIds=['U-A'],p=>p.project.name='tampered',p=>p.schema='future',p=>p.extra=true,p=>p.manifest.provenance.kind='user-declared-project']){
  const p=JSON.parse(a.bytes);mutate(p);await assert.rejects(readProjectShellPackage(JSON.stringify(p)));
 }
});
test('A04 wrong selected floor, live source edits and project revision changes block restoration and exports',async()=>{
 const a=await createProjectShellArtifact(project,sources[0],records[0],'JSON',viewFor(records[0]));
 await assert.rejects(readProjectShellPackage(a.bytes,project,sources[1]),/seçili döşeme/);
 const s=structuredClone(sources[0]);s.loads.liveLoad+=1;await assert.rejects(readProjectShellPackage(a.bytes,project,s),/seçili döşeme/);
 const p=structuredClone(project);p.revision='P03';await assert.rejects(readProjectShellPackage(a.bytes,p,sources[0]));
 for(const format of ['JSON','PDF','DXF'])await assert.rejects(createProjectShellArtifact(project,s,records[0],format,viewFor(records[0]),assets),/eşleşmiyor/);
});
test('A04 mutable callers cannot change source, project, view or calculation after export starts',async()=>{
 const p=structuredClone(project),s=structuredClone(sources[0]),r=structuredClone(records[0]),v=viewFor(r),promise=createProjectShellArtifact(p,s,r,'JSON',v);
 p.name='later';s.loads.liveLoad=999;v.field='Uz';r.content.cases[0].centerUz=999;
 const a=await promise,pkg=await readProjectShellPackage(a.bytes);assert.equal(pkg.project.name,project.name);assert.deepEqual(pkg.calculation,records[0]);assert.equal(pkg.manifest.view.field,'Mxx');
});
test('A04 invalid selection and unsupported format reject before producing document bytes',async()=>{
 for(const v of [{...viewFor(records[0]),elementId:'foreign'},{...viewFor(records[0]),magnification:NaN}])await assert.rejects(createProjectShellArtifact(project,sources[0],records[0],'JSON',v),/Geçersiz/);
 await assert.rejects(createProjectShellArtifact(project,sources[0],records[0],'SVG',viewFor(records[0])),/biçimi/);
 await assert.rejects(readProjectShellPackage('null'),/şeması/);
});

test('A04 explicitly declared project provenance is retained rather than relabeled synthetic',async()=>{
 const p=structuredClone(project);delete p.modules['plan-editor'].example;
 const s=createProjectShellFixtureSource(p);s.provenance={kind:'user-declared-project',reference:'Software fixture of explicit user declaration; not an actual construction project'};
 const r=await recordProjectShellCalculation(p,s),a=await createProjectShellArtifact(p,s,r,'DXF',viewFor(r));
 assert.equal(a.document.manifest.provenance.kind,'user-declared-project');assert.match(a.bytes,/BEYAN EDİLEN PROJE/);assert.equal(a.bytes.includes('SENTETİK PROJE'),false);
 assert.equal(a.document.manifest.coordinateReference,p.coordinateReference);
});
