import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright';
const base=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187',out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER});const page=await browser.newPage();const checks=[];
try {
 await page.goto(base+'/ornek-kat-modeli');
 const normal=await page.evaluate(async()=>{
  const {createShellExamples}=await import('/app/lib/shell-example.ts');
  const {calculateShellInWorker}=await import('/app/lib/shell-worker-client.ts');
  const source=createShellExamples('CL','refined')[1],before=JSON.stringify(source),start=performance.now();let ticks=0;
  const timer=setInterval(()=>ticks++,10);
  try {
   const record=await calculateShellInWorker(source),durationMs=performance.now()-start;
   const {traceJson,traceSha256}=await import('/app/lib/structural-traceability.ts');
   return {ticks,durationMs,diagnostics:record.diagnostics,caseCount:record.content.cases.length,centerUz:record.content.cases.find(c=>c.id==='BENCH').centerUz,
     technicalApproval:record.content.technicalApproval,fullBuildingAnalysis:record.content.fullBuildingAnalysis,sourceUnchanged:before===JSON.stringify(source),
     sourceSchema:source.schema,sealMatches:record.sha256===await traceSha256(traceJson(record.content)),id:record.id};
  } finally {clearInterval(timer);}
 });
 assert.ok(normal.ticks>2,'main thread stayed responsive');assert.ok(normal.durationMs<30000);assert.ok(normal.diagnostics.factorStorageBytes<120e6);
 assert.equal(normal.caseCount,5);assert.equal(normal.technicalApproval,false);assert.equal(normal.fullBuildingAnalysis,false);assert.ok(normal.sourceUnchanged&&normal.sealMatches);assert.equal(normal.sourceSchema,'ARKEM-SHELL-SOURCE/1.1');checks.push({name:'maximum refined plate worker, responsiveness and sealed result',pass:true,...normal});
 const aborted=await page.evaluate(async()=>{
  const {createShellExamples}=await import('/app/lib/shell-example.ts');const {calculateShellInWorker}=await import('/app/lib/shell-worker-client.ts');
  const controller=new AbortController();const started=performance.now(),pending=calculateShellInWorker(createShellExamples('CL','refined')[1],{signal:controller.signal});setTimeout(()=>controller.abort(),100);
  try {await pending;return {returnedResult:true};}catch(e){return {name:e.name,durationMs:performance.now()-started,returnedResult:false};}
 });
 assert.equal(aborted.name,'AbortError');assert.equal(aborted.returnedResult,false);assert.ok(aborted.durationMs<3000);checks.push({...aborted,errorName:aborted.name,name:'terminate in-flight calculation without results',pass:true});
 const failures=await page.evaluate(async()=>{
  const {createShellExamples}=await import('/app/lib/shell-example.ts');const {calculateShellInWorker}=await import('/app/lib/shell-worker-client.ts');const messages=[];
  for(const options of [{drillingFactor:0},{timeoutMs:100}]){try {await calculateShellInWorker(createShellExamples('CL','refined')[1],options);messages.push('unexpected result');}catch(e){messages.push(e.message);}}
  const ac=new AbortController();ac.abort();let preAbort;try{await calculateShellInWorker(createShellExamples()[0],{signal:ac.signal});}catch(e){preAbort=e.name;}
  return {messages,preAbort};
 });
 assert.match(failures.messages[0],/drilling/);checks.push({name:'invalid stiffness refused inside worker',pass:true});
 assert.match(failures.messages[1],/zaman/);checks.push({name:'time limit terminates without accepted results',pass:true});
 assert.equal(failures.preAbort,'AbortError');checks.push({name:'pre-aborted request creates no calculation',pass:true});
 fs.writeFileSync(path.join(out,'shell-worker-browser-result.json'),JSON.stringify({executedAt:new Date().toISOString(),fixture:'synthetic',pass:checks.length,fail:0,checks,technicalApproval:false},null,2));
 console.log(JSON.stringify({suite:'shell-worker-browser',pass:checks.length,fail:0}));
} finally {await browser.close();}
