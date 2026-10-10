import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';import {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createShellExamples}=await import('../app/lib/shell-example.ts'),{recordShellCalculation}=await import('../app/lib/shell-solver.ts');
const {createShellArtifact,verifyShellDocument}=await import('../app/lib/shell-documents.ts'),{shellFieldValues,shellCellValues}=await import('../app/lib/shell-view.ts');
const source=createShellExamples('SS-H','coarse')[0],record=await recordShellCalculation(source),view={caseId:'G',field:'Mxx',magnification:100,elementId:'P1:Q:1:1'};
const assets={regularFont:new Uint8Array(fs.readFileSync('public/fonts/ArkemSans-Regular.ttf')),boldFont:new Uint8Array(fs.readFileSync('public/fonts/ArkemSans-Bold.ttf'))};
test('S3 JSON holds current source, every raw case and explicit independent/approval status',async()=>{
 const a=await createShellArtifact(source,record,'JSON',view),p=JSON.parse(a.bytes);
 assert.equal(p.calculation.id,record.id);assert.deepEqual(p.calculation.content,record.content);assert.deepEqual(p.manifest.source,source);assert.equal(p.manifest.view.field,'Mxx');assert.equal(p.technicalApproval,false);assert.equal(p.fullBuildingAnalysis,false);
 assert.ok(await verifyShellDocument(a.document,source,record,a.bytes));assert.equal(await verifyShellDocument(a.document,source,record,a.bytes+' '),false);
});
test('S3 PDF embeds the same source/calculation and paginates visible results',async()=>{
 const a=await createShellArtifact(source,record,'PDF',view,assets),pdf=await PDFDocument.load(a.bytes);
 assert.ok(pdf.getPageCount()>=6);
 const names=pdf.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict).lookup(PDFName.of('Names'),PDFArray),stream=names.lookup(1,PDFDict).lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'),PDFRawStream);
 const p=JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode()));
 assert.equal(p.calculation.id,record.id);assert.deepEqual(p.calculation.content,record.content);assert.equal(p.manifest.format,'PDF');assert.deepEqual(p.manifest.view,view);assert.equal(p.technicalApproval,false);
 assert.ok(await verifyShellDocument(a.document,source,record,a.bytes));
});
test('S3 DXF has explicit metre units, true Z, two meshes, raw values and bounded trace comments',async()=>{
 const s=createShellExamples('CL','coarse')[1],r=await recordShellCalculation(s),v={...view,elementId:'P2:Q:1:1'},a=await createShellArtifact(s,r,'DXF',v),pairs=a.bytes.split('\r\n').filter(Boolean);
 assert.equal(pairs.length%2,0);assert.match(a.bytes,/\$INSUNITS\r\n70\r\n6/);assert.match(a.bytes,/30\r\n3\.4000000000/);
 assert.ok(a.bytes.includes('DEFORMED_MESH')&&a.bytes.includes('RAW_RESULTS')&&a.bytes.includes('SUPPORTS'));
 let meta='',inside=false,faces=0;
 for(let i=0;i<pairs.length;i+=2){if(pairs[i]==='0'&&pairs[i+1]==='3DFACE')faces++;if(pairs[i]==='999'){const v=pairs[i+1];assert.ok(v.length<=255);if(v==='ARKEMX_SHELL_TRACE_BEGIN')inside=true;else if(v==='ARKEMX_SHELL_TRACE_END')inside=false;else if(inside)meta+=v;}}
 const manifest=JSON.parse(meta);assert.equal(manifest.calculationId,r.id);assert.deepEqual(manifest.view,v);assert.equal(faces,s.mesh.nx*s.mesh.ny*2);
 assert.ok(await verifyShellDocument(a.document,s,r,a.bytes));assert.equal(await verifyShellDocument(a.document,s,r,a.bytes.replace('3.4000000000','3.5000000000')),false);
});
test('S3 material load mesh support and geometry changes block each export; forged calculation is refused',async()=>{
 for(const mutate of [s=>s.plate.thickness*=2,s=>s.material.E*=2,s=>s.loads.liveLoad*=2,s=>s.mesh.nx*=2,s=>s.supports.preset='CL',s=>s.plate.width*=2]){
  const s=structuredClone(source);mutate(s);for(const format of ['PDF','DXF','JSON'])await assert.rejects(createShellArtifact(s,record,format,view,assets),/eşleşmiyor/);
 }
 const forged=structuredClone(record);forged.content.cases[0].nodes[0].reactions[2]+=100;await assert.rejects(createShellArtifact(source,forged,'JSON',view),/eşleşmiyor/);
 for(const change of [{caseId:'UNKNOWN'},{field:'BAD'},{magnification:0},{elementId:'P2:Q:0:0'}])await assert.rejects(createShellArtifact(source,record,'JSON',{...view,...change}),/Geçersiz/);
 await assert.rejects(createShellArtifact(source,record,'SVG',view),/biçimi/);
});
test('S3 signed raw field values remain intact while cell means are only visualization data',()=>{
 const c=record.content.cases.find(c=>c.id==='G'),before=JSON.stringify(c),m=shellCellValues(c,'Mxx',source.mesh.nx),raw=shellFieldValues(c,'Mxx');
 assert.equal(raw.length,c.elements.length*4);assert.equal(m[0],c.elements[0].points.reduce((v,p)=>v+p.resultants[3]/4,0));assert.equal(JSON.stringify(c),before);
 const u=shellCellValues(c,'Uz',source.mesh.nx),nx=source.mesh.nx;assert.equal(u[0],[0,1,nx+2,nx+1].reduce((v,i)=>v+c.nodes[i].displacements[2]/4,0));
});
