"use client";
import {useEffect,useRef,useState} from 'react';
import {useProjectKernel} from './ProjectKernel';
import type {ZoningParcelInput} from '../lib/kastamonu-zoning';
import type {ZoningForm} from '../lib/zoning';
import {ZONING_FIELDS} from '../lib/zoning-research';
import {isDocumentEvidence,matchDocumentIdentity,proposeDocumentTransfer,type DocumentEvidence,type DocumentField} from '../lib/zoning-document-evidence';
import {extractDocument,loadDocument,storeDocument} from '../lib/zoning-document-browser';

export function ZoningDocumentPanel({identity,zoning,onAttach,onApply}:{identity:ZoningParcelInput;zoning:ZoningForm;onAttach:(name:string)=>void;onApply:(values:Partial<Pick<ZoningForm,DocumentField>>,basis:string)=>void}) {
  const {project,patchModule}=useProjectKernel();
  const key=JSON.stringify(identity);
  const saved=project.modules.zoningDocuments as {projectId?:string;sets?:Record<string,{documents:DocumentEvidence[];excluded:string[]}>}|undefined;
  const [docs,setDocs]=useState<DocumentEvidence[]>(()=>saved?.projectId===project.id&&Array.isArray(saved.sets?.[key]?.documents)?saved.sets[key].documents.filter(isDocumentEvidence).slice(0,5):[]);
  const [excluded,setExcluded]=useState<string[]>(()=>saved?.projectId===project.id&&Array.isArray(saved.sets?.[key]?.excluded)?saved.sets[key].excluded:[]);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[checked,setChecked]=useState(false),[available,setAvailable]=useState<string[]>([]);
  const alive=useRef(true),running=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{let cancelled=false;setAvailable([]);void Promise.all(docs.map(async d=>{
    const blob=await loadDocument(project.id,d.hash);if(!blob)return '';
    const actual=await extractDocument(new File([blob],d.fileName,{type:'application/pdf'}));
    // Imported JSON is not proof: rebuild every extracted value from the original bytes.
    return ['pages','candidates','identity','scales','dates','warnings'].every(k=>JSON.stringify(actual[k as keyof DocumentEvidence])===JSON.stringify(d[k as keyof DocumentEvidence]))?d.hash:'';
  })).then(ids=>{if(!cancelled)setAvailable(ids.filter(Boolean));}).catch(()=>{if(!cancelled)setAvailable([]);});return()=>{cancelled=true;};},[docs,project.id]);
  const activeDocs=docs.filter(d=>!excluded.includes(d.hash));
  const proposal=proposeDocumentTransfer(activeDocs,identity,zoning);
  const originalsReady=activeDocs.length>0&&activeDocs.every(d=>available.includes(d.hash));
  const reviewRecorded=originalsReady&&!proposal.reasons.length&&proposal.fields.every(f=>f.status==='read')
    &&zoning.expertReviewStatus==='reviewed-consistent'&&Boolean(zoning.expertReviewer.trim()&&zoning.expertReviewerRole.trim()&&zoning.expertReviewBasis.trim())
    &&Number.isFinite(Date.parse(zoning.expertReviewDate))&&Date.parse(zoning.expertReviewDate)<=Date.now();
  function persist(next:DocumentEvidence[],omit:string[]) {patchModule('zoningDocuments',{projectId:project.id,sets:{...saved?.sets,[key]:{documents:next,excluded:omit}}});}
  async function add(file?:File) {
    if(!file||running.current)return;
    running.current=true;setBusy(true);setNotice('PDF metni ve parsel kimliği okunuyor…');setChecked(false);
    try {
      const doc=await extractDocument(file);
      if(!alive.current)return;
      if(docs.length>=5&&!docs.some(d=>d.hash===doc.hash)){setNotice('Bu parsel için en fazla 5 belge eklenebilir.');return;}
      await storeDocument(project.id,doc.hash,file);
      if(!alive.current)return;
      const next=[...docs.filter(d=>d.hash!==doc.hash),doc];setDocs(next);persist(next,excluded);onAttach(next.filter(d=>!excluded.includes(d.hash)).map(d=>d.fileName).join('; '));
      setNotice(`${file.name}: ${doc.pages.length} sayfa okundu, ${doc.candidates.length} koşul adayı bulundu. Uzman incelemesi bekliyor.`);
    }catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Belge okunamadı.');}
    finally{running.current=false;if(alive.current)setBusy(false);}
  }
  async function original(doc:DocumentEvidence) {
    try {const blob=await loadDocument(project.id,doc.hash);if(!blob)throw Error('Asıl dosya bu cihazda yok veya içerik özeti uyuşmuyor. Aynı dosyayı yeniden yükleyin.');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=doc.fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setNotice(e instanceof Error?e.message:'Belge açılamadı.');}
  }
  function exportRecord(){const url=URL.createObjectURL(new Blob([JSON.stringify({projectId:project.id,identity,documents:docs,excluded,proposal,officialApproval:false},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${project.id}-imar-belge-kaniti.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="geo-document-evidence" aria-label="İmar belgesi içerik kontrolü">
    <h4>Belgeyi oku ve parseli karşılaştır</h4>
    <p>PDF bu cihazda okunur ve saklanır; dış servise gönderilmez. En fazla 10 MB, 25 sayfa ve 5 belge. Proje yedeği metni ve kanıt kaydını içerir; asıl PDF dosyalarını ayrıca indirin.</p>
    <label>İmar belgesi PDF<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>{void add(e.target.files?.[0]);e.target.value='';}} /></label>
    <p role="status">{notice}</p>
    {docs.map(doc=>{const match=matchDocumentIdentity(doc,identity);return <article key={doc.hash}>
      <b>{doc.fileName}</b><p>{doc.pages.length} sayfa · {doc.candidates.length} koşul adayı · {match.status==='matched'?'Parsel kimliği eşleşti':match.status==='mismatch'?'Parsel uyuşmuyor — aktarım engelli':'Parsel kimliği eksik — aktarım engelli'}</p>
      <label><input type="checkbox" checked={!excluded.includes(doc.hash)} disabled={busy} onChange={e=>{const next=e.target.checked?excluded.filter(h=>h!==doc.hash):[...excluded,doc.hash];setExcluded(next);setChecked(false);persist(docs,next);onAttach(docs.filter(d=>!next.includes(d.hash)).map(d=>d.fileName).join('; '));}} />Koşul karşılaştırmasına dahil et</label>
      <p>Ölçek: {doc.scales.join(', ')||'Okunamadı'} · Belge/onay tarihi: {doc.dates.join(', ')||'Okunamadı'}</p>
      <p>{available.includes(doc.hash)?'Asıl dosya bu cihazda mevcut; içerik özeti eşleşti.':'Asıl dosya doğrulanamadı; aktarım kapalı.'}</p>
      {doc.warnings.map(w=><p key={w}>{w}</p>)}
      <button type="button" onClick={()=>void original(doc)}>Asıl PDF dosyasını indir</button>
      <details><summary>Okunan metin ve kimlik</summary><pre>{JSON.stringify(doc.identity,null,2)}</pre>{doc.pages.map(p=><div key={p.page}><b>Sayfa {p.page}</b><pre>{p.text||'Metin yok; OCR/görsel inceleme gerekli.'}</pre></div>)}</details>
    </article>;})}
    {docs.length>0&&<>
      <h4>{reviewRecorded?'Uzman inceleme kaydı tamamlandı · proje içi kayıt':activeDocs.some(d=>d.candidates.length)?'Koşul adayları okundu · uzman incelemesi bekliyor':'Belge kayıtlı · koşul okuma tamamlanmadı'}</h4>
      {proposal.fields.map(f=><article key={f.field}><b>{ZONING_FIELDS.find(([k])=>k===f.field)?.[1]}</b><p>Projede: {f.current??'Girilmedi'} · Belgede: {f.value??'Tek değer belirlenemedi'}</p><p>{f.status==='source-conflict'?'Belgeler arasında çelişki':f.status==='project-conflict'?'Proje girdisiyle fark var':f.status==='missing'?'Eşleşen belgede okunamadı':'Kaynak metninden okundu; onaylanmadı'}</p>{f.candidates.map((c,i)=><blockquote key={i}>{c.fileName} · Sayfa {c.page}: {c.quote}</blockquote>)}</article>)}
      {proposal.reasons.map(r=><p key={r}>{r}</p>)}
      <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />Belgenin aslını, parseli ve alıntıları kontrol ettim; boş alanlara taslak olarak aktar.</label>
      <button type="button" disabled={busy||!checked||!originalsReady||!!proposal.reasons.length||!Object.keys(proposal.values).length} onClick={()=>{onApply(proposal.values,activeDocs.map(d=>`${d.fileName} [SHA-256 ${d.hash}]`).join('; '));setChecked(false);setNotice('Yalnız boş alanlar taslak olarak aktarıldı. Uzman incelemesi yenilenmeli; resmî onay verilmedi.');}}>Kontrol edilen boş alanları aktar</button>
      <button type="button" onClick={exportRecord}>Belge kanıt kaydını indir</button>
      <p>Son adım: Uzman incelemesi bölümünde inceleyen, tarih, dayanak ve sonucu kaydedin. Bu kayıt belediye onayı oluşturmaz.</p>
    </>}
  </section>;
}
