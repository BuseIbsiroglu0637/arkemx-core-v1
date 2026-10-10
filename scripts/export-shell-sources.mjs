import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createShellExamples}=await import('../app/lib/shell-example.ts');
const {recordShellSource,verifyShellSourceRecord}=await import('../app/lib/shell-source.ts');
const sources=createShellExamples(),records=[];
for(const source of sources){
 const record=await recordShellSource(source);
 if(!await verifyShellSourceRecord(record,source))throw Error('Shell source seal failed');
 records.push(record);
}
const output=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'b06-shell-sources.json'),JSON.stringify(sources,null,2));
fs.writeFileSync(path.join(output,'shell-source-records.json'),JSON.stringify({
 exportedAt:new Date().toISOString(),fixture:'synthetic',status:'source-ready-analysis-pending',
 shellAnalysisRun:false,fullBuildingAnalysis:false,technicalApproval:false,records,
},null,2));
console.log(JSON.stringify({suite:'shell-source-export',sources:records.length,shellAnalysisRun:false}));
