import { readZoningDocument, type DocumentEvidence, type DocumentPage } from './zoning-document-evidence';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export async function documentHash(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function extractDocument(file: File): Promise<DocumentEvidence> {
  if(file.size>10*1024*1024 || file.size===0) throw Error('Belge boş olmamalı ve 10 MB sınırını aşmamalı.');
  const bytes=await file.arrayBuffer();
  const hash=await documentHash(bytes);
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw Error('Geçerli PDF dosyası seçin. Görsel belgeleri metin içeren PDF olarak sağlayın; OCR henüz bağlı değil.');
  const pdfjs=await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
  const task=pdfjs.getDocument({data:new Uint8Array(bytes),stopAtErrors:true,useSystemFonts:true});
  const timeout=setTimeout(()=>{void task.destroy();},30000);
  try {
    const pdf=await task.promise;
    if(pdf.numPages>25) throw Error('En fazla 25 sayfalık belge seçin; ilgili plan ve notlarını ayrı belgeler olarak ekleyin.');
    const pages:DocumentPage[]=[]; let length=0;
    for(let page=1;page<=pdf.numPages;page++) {
      const content=await (await pdf.getPage(page)).getTextContent();
      let text='',lastY:number|null=null;
      for(const item of content.items) if('str' in item) {
        const y=item.transform[5];
        if(lastY!==null&&Math.abs(y-lastY)>2&&!text.endsWith('\n')) text+='\n';
        text+=item.str+(item.hasEOL?'\n':' '); lastY=y;
      }
      length+=text.length; if(length>200000) throw Error('Belge metni 200.000 karakter sınırını aşıyor.');
      pages.push({page,text});
    }
    return readZoningDocument(pages,{hash,fileName:file.name,size:file.size,readAt:new Date().toISOString()});
  } catch(e) {
    if(e instanceof Error && e.name==='InvalidPDFException') throw Error('PDF dosyasının yapısı bozuk; içerik okunamadı ve belge kayda eklenmedi.');
    if(e instanceof Error && e.name==='PasswordException') throw Error('Şifreli PDF okunamadı. Yetkili olarak erişebildiğiniz şifresiz kopyayı seçin.');
    throw e;
  } finally {clearTimeout(timeout); await task.destroy();}
}

async function database():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{const req=indexedDB.open('arkemx-zoning-documents',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Belge deposu açılamadı.'));});
}
export async function storeDocument(projectId:string,hash:string,file:File) {
  const db=await database();
  try {await new Promise<void>((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,`${projectId}:${hash}`);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Belge kaydedilemedi; cihaz depolama alanını kontrol edin.'));tx.onabort=()=>reject(Error('Belge kaydı iptal edildi.'));});} finally {db.close();}
  if(!await loadDocument(projectId,hash)) throw Error('Kaydedilen belge geri okunamadı.');
}
export async function loadDocument(projectId:string,hash:string):Promise<Blob|null> {
  const db=await database();
  try {
    const blob=await new Promise<Blob|undefined>((resolve,reject)=>{const req=db.transaction('files').objectStore('files').get(`${projectId}:${hash}`);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Belge okunamadı.'));});
    return blob instanceof Blob && await documentHash(await blob.arrayBuffer())===hash ? blob:null;
  } finally {db.close();}
}
