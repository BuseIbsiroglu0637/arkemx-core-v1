import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {decodeProjectShellStorage,PROJECT_SHELL_STORAGE_SCHEMA,PROJECT_SHELL_MAX_BYTES}=await import('../app/lib/project-shell-storage.ts');
const sha='a'.repeat(64),session={key:'fixture-source-key',projectId:'FIXTURE',epoch:0};
const record={schema:'ARKEM-PROJECT-SHELL-CALCULATION-RECORD/1.0',id:'PROJECT-SHELL-CALC-'+sha,sha256:sha,content:{unverified:true}};
const entry={schema:PROJECT_SHELL_STORAGE_SCHEMA,key:session.key,projectId:session.projectId,savedAt:'2026-10-10T00:00:00.000Z',json:JSON.stringify(record)};
test('Storage envelope is only a parse/identity gate; it does not confer numerical verification',()=>{const r=decodeProjectShellStorage(entry,session);assert.deepEqual(r.record,record);assert.equal(r.savedAt,entry.savedAt);});
test('Foreign keys/projects, malformed JSON, unsupported schema/date and invalid calculation identities are rejected',()=>{
 for(const changed of [{key:'other'},{projectId:'other'},{schema:'ARKEM-PROJECT-SHELL-STORAGE/2.0'},{savedAt:'invalid'},{json:'{broken'},{json:'null'},{json:JSON.stringify({...record,sha256:'invalid'})},{json:JSON.stringify({...record,id:'FOREIGN'})},{json:JSON.stringify({...record,schema:'FUTURE'})}])assert.throws(()=>decodeProjectShellStorage({...entry,...changed},session));
 assert.throws(()=>decodeProjectShellStorage(null,session));
});
test('Storage input budget is checked in UTF-8 bytes before parsing and accepts no oversized payload',()=>{
 assert.throws(()=>decodeProjectShellStorage({...entry,json:'a'.repeat(PROJECT_SHELL_MAX_BYTES+1)},session));
 assert.throws(()=>decodeProjectShellStorage({...entry,json:'ğ'.repeat(PROJECT_SHELL_MAX_BYTES/2+1)},session));
});
