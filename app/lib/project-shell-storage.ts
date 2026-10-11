import { canonicalProjectShellSource } from "./project-shell-calculation.ts";
import type { ProjectShellCalculationRecord } from "./project-shell-calculation.ts";
import { traceJson, traceSha256 } from "./structural-traceability.ts";

export const PROJECT_SHELL_DB = "arkem-project-shell-calculations-v1";
export const PROJECT_SHELL_STORAGE_SCHEMA = "ARKEM-PROJECT-SHELL-STORAGE/1.0";
export const PROJECT_SHELL_MAX_BYTES = 32 * 1024 * 1024;
const RECORDS = "records", EPOCHS = "epochs", TIMEOUT = 10000;
export type ShellStorageSession = { key:string; projectId:string; epoch:number };
type Entry = {schema:string;key:string;projectId:string;savedAt:string;json:string};

function aborted(signal?:AbortSignal) { if(signal?.aborted)throw new DOMException("İşlem iptal edildi.","AbortError"); }
function openDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(Error("Kalıcı kabuk deposu bu tarayıcıda kullanılamıyor."));return;}
    let settled=false;
    const fail=(error:unknown)=>{if(!settled){settled=true;clearTimeout(timer);reject(error);}};
    const timer=setTimeout(()=>fail(Error("Kalıcı kabuk deposu açılma zaman aşımı.")),TIMEOUT);
    let request:IDBOpenDBRequest;
    try{request=indexedDB.open(PROJECT_SHELL_DB,1);}catch(e){fail(e);return;}
    request.onupgradeneeded=event=>{
      if(event.oldVersion===0){
        request.result.createObjectStore(RECORDS,{keyPath:"key"}).createIndex("projectId","projectId");
        request.result.createObjectStore(EPOCHS);
      }
    };
    request.onerror=()=>fail(request.error??Error("Kalıcı kabuk deposu açılamadı."));
    request.onblocked=()=>fail(Error("Kalıcı kabuk deposu başka bir sekmede kilitli; sekmeyi kapatıp tekrar deneyin."));
    request.onsuccess=()=>{
      const db=request.result;db.onversionchange=()=>db.close();
      if(settled){db.close();return;}
      if(!db.objectStoreNames.contains(RECORDS)||!db.objectStoreNames.contains(EPOCHS)){
        db.close();fail(Error("Kabuk deposu şeması desteklenmiyor."));return;
      }
      settled=true;clearTimeout(timer);resolve(db);
    };
  });
}

async function transaction<T>(mode:IDBTransactionMode,run:(tx:IDBTransaction,finish:(value:T)=>void,fail:(e:unknown)=>void)=>void,signal?:AbortSignal):Promise<T> {
  aborted(signal);const db=await openDatabase();
  try{
    aborted(signal);
    return await new Promise<T>((resolve,reject)=>{
      const tx=db.transaction([RECORDS,EPOCHS],mode);let value:T,error:unknown;
      const abort=()=>{error=new DOMException("İşlem iptal edildi.","AbortError");try{tx.abort();}catch{/* Already completed. */}};
      const timer=setTimeout(()=>{error=Error("Kalıcı kabuk deposu işlem zaman aşımı.");try{tx.abort();}catch{/* Already completed. */}},TIMEOUT);
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener("abort",abort);};
      tx.oncomplete=()=>{cleanup();resolve(value);};
      tx.onabort=()=>{cleanup();reject(error??tx.error??new DOMException("Kabuk kaydı işlemi geri alındı.","AbortError"));};
      tx.onerror=()=>{error??=tx.error;};
      signal?.addEventListener("abort",abort,{once:true});
      const fail=(e:unknown)=>{error=e;try{tx.abort();}catch{/* Already aborted. */}};
      try{run(tx,v=>{value=v;},fail);}catch(e){fail(e);}
    });
  }finally{db.close();}
}
function epoch(value:unknown):number {
  if(value===undefined)return 0;
  if(!Number.isSafeInteger(value)||Number(value)<0)throw Error("Kabuk deposu silme geçmişi geçersiz.");
  return Number(value);
}
export function decodeProjectShellStorage(value:unknown,session:ShellStorageSession):{record:ProjectShellCalculationRecord;savedAt:string} {
  const entry=value as Entry;
  if(!entry||entry.schema!==PROJECT_SHELL_STORAGE_SCHEMA||entry.key!==session.key||entry.projectId!==session.projectId||
    typeof entry.savedAt!=="string"||!Number.isFinite(Date.parse(entry.savedAt))||typeof entry.json!=="string"||
    entry.json.length>PROJECT_SHELL_MAX_BYTES||new TextEncoder().encode(entry.json).byteLength>PROJECT_SHELL_MAX_BYTES)throw Error("Kalıcı kabuk kaydı bozuk veya desteklenmeyen sürümde.");
  const record=JSON.parse(entry.json) as ProjectShellCalculationRecord;
  if(record?.schema!=="ARKEM-PROJECT-SHELL-CALCULATION-RECORD/1.0"||typeof record.sha256!=="string"||
    !/^[a-f0-9]{64}$/.test(record.sha256)||record.id!=="PROJECT-SHELL-CALC-"+record.sha256)throw Error("Kalıcı kabuk hesap kimliği geçersiz.");
  return {record,savedAt:entry.savedAt}; // Numerical integrity is verified in a worker before display.
}
export async function readProjectShellStorage(project:unknown,source:unknown,signal?:AbortSignal) {
  const canonical=canonicalProjectShellSource(project,source);
  const digest=await traceSha256(traceJson(canonical));aborted(signal);
  const projectId=canonical.projectId,key=traceJson([projectId,canonical.revision,canonical.sourcePlateId,digest]);
  const result=await transaction<{session:ShellStorageSession;entry:unknown}>("readonly",(tx,finish,fail)=>{
    const er=tx.objectStore(EPOCHS).get(projectId),rr=tx.objectStore(RECORDS).get(key);
    rr.onsuccess=()=>{try{finish({session:{key,projectId,epoch:epoch(er.result)},entry:rr.result});}catch(e){fail(e);}};
  },signal);
  try{return {session:result.session,stored:result.entry===undefined?null:decodeProjectShellStorage(result.entry,result.session),error:""};}
  catch(e){return {session:result.session,stored:null,error:e instanceof Error?e.message:"Kalıcı kabuk kaydı geçersiz."};}
}
export async function saveProjectShellStorage(session:ShellStorageSession,record:ProjectShellCalculationRecord,signal?:AbortSignal) {
  aborted(signal);const json=JSON.stringify(record);
  if(new TextEncoder().encode(json).byteLength>PROJECT_SHELL_MAX_BYTES)throw Error("Kabuk kaydı 32 MiB saklama sınırını aşıyor.");
  const entry:Entry={schema:PROJECT_SHELL_STORAGE_SCHEMA,key:session.key,projectId:session.projectId,savedAt:new Date().toISOString(),json};
  decodeProjectShellStorage(entry,session);
  const source=record.content.sourceRecord.content.source;
  const canonical=JSON.parse(traceJson(source));canonical.sourceElementIds.sort();
  const expectedKey=traceJson([source.projectId,source.revision,source.sourcePlateId,await traceSha256(traceJson(canonical))]);
  if(session.projectId!==source.projectId||session.key!==expectedKey)throw Error("Hesap kaydı bu proje ve kaynak deposuyla eşleşmiyor.");
  // All puts and epoch checks share one transaction: a failed write preserves the previous record.
  await transaction<void>("readwrite",(tx,finish,fail)=>{
    const request=tx.objectStore(EPOCHS).get(session.projectId);
    request.onsuccess=()=>{try{
      if(epoch(request.result)!==session.epoch)throw Error("Proje kayıtları silindi; eski oturumun kaydı yeniden yazılamaz.");
      tx.objectStore(RECORDS).put(entry);finish();
    }catch(e){fail(e);}};
  },signal);
  return entry.savedAt;
}
export async function clearProjectShellStorage(projectId:string) {
  await transaction<void>("readwrite",(tx,finish,fail)=>{
    const request=tx.objectStore(EPOCHS).get(projectId);
    request.onsuccess=()=>{try{tx.objectStore(EPOCHS).put(epoch(request.result)+1,projectId);}catch(e){fail(e);}};
    const cursor=tx.objectStore(RECORDS).index("projectId").openCursor(IDBKeyRange.only(projectId));
    cursor.onsuccess=()=>{const item=cursor.result;if(item){item.delete();item.continue();}else finish();};
  });
}
