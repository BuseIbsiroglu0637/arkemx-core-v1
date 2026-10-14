import type { ZoningParcelInput } from './kastamonu-zoning';
import type { ZoningForm } from './zoning';

export const DOCUMENT_FIELDS = ['landUse','buildingOrder','taks','kaks','hmax','frontSetback','sideSetback','rearSetback'] as const;
export type DocumentField = typeof DOCUMENT_FIELDS[number];
export type DocumentPage = { page: number; text: string };
export type DocumentCandidate = { field: DocumentField; value: string | number; page: number; quote: string };
export type DocumentIdentity = Pick<ZoningParcelInput, 'province'|'district'|'neighborhood'|'block'|'parcelNo'>;
export type DocumentEvidence = {
  schema: 'ARKEM-ZONING-DOCUMENT/2.0'; hash: string; fileName: string; size: number; readAt: string;
  pages: DocumentPage[]; candidates: DocumentCandidate[];
  identity: Partial<Record<keyof DocumentIdentity, string[]>>;
  scales: string[]; dates: string[]; warnings: string[];
};
const normalize = (s: string) => s.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/\s+/g,' ').trim();
const same = (a: string | number, b: string | number) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a-b)<1e-6 : normalize(String(a)) === normalize(String(b));
const unique = (v: string[]) => [...new Set(v.map(normalize))];

export function isDocumentEvidence(value: unknown): value is DocumentEvidence {
  if(!value || typeof value!=='object') return false;
  const d=value as DocumentEvidence;
  const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(s=>typeof s==='string');
  return d.schema==='ARKEM-ZONING-DOCUMENT/2.0' && typeof d.hash==='string' && /^[a-f0-9]{64}$/.test(d.hash)
    && typeof d.fileName==='string' && typeof d.readAt==='string' && Number.isFinite(Date.parse(d.readAt))
    && Number.isFinite(d.size) && d.size>0 && d.size<=10*1024*1024
    && Array.isArray(d.pages) && d.pages.length>0 && d.pages.length<=25
    && d.pages.every((p,i)=>p&&p.page===i+1&&typeof p.text==='string') && d.pages.reduce((n,p)=>n+p.text.length,0)<=200000
    && Array.isArray(d.candidates) && d.candidates.every(c=>c&&DOCUMENT_FIELDS.includes(c.field)&&Number.isInteger(c.page)&&c.page>0&&c.page<=d.pages.length&&typeof c.quote==='string'&&(typeof c.value==='string'||typeof c.value==='number'&&Number.isFinite(c.value)))
    && !!d.identity && typeof d.identity==='object' && Object.values(d.identity).every(strings)
    && strings(d.scales)&&strings(d.dates)&&strings(d.warnings);
}

// Deliberately reads explicit labelled rows, never proximity guesses from a plan drawing.
export function readZoningDocument(pages: DocumentPage[], metadata: Pick<DocumentEvidence,'hash'|'fileName'|'size'|'readAt'>): DocumentEvidence {
  const candidates: DocumentCandidate[] = [], identity: DocumentEvidence['identity'] = {}, scales: string[] = [], dates: string[] = [];
  const warnings: string[] = [];
  const labels: [keyof DocumentIdentity,string][] = [['province','il(?:i)?'],['district','ilçe(?:si)?'],['neighborhood','mahalle(?:si)?(?:\\s*/\\s*köy)?|köy(?:ü)?'],['block','ada(?:\\s*(?:no|numarası))?'],['parcelNo','parsel(?:\\s*(?:no|numarası))?']];
  for (const {page,text} of pages) for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const matchLine=normalize(line);
    for (const [key,label] of labels) {
      const m = matchLine.match(new RegExp(`^(?:${normalize(label)})\\s*[:=]\\s*(.+)$`,'iu'));
      if (m) (identity[key] ??= []).push(m[1].trim());
    }
    for (const m of line.matchAll(/1\s*[/ :]\s*(1[.]?000|5[.]?000|25[.]?000)\b/g)) scales.push('1/'+m[1].replace('.',''));
    const date = matchLine.match(/^(?:plan onay tarihi|onay tarihi|belge tarihi)\s*[:=]\s*(\d{2}[./]\d{2}[./]\d{4}|\d{4}-\d{2}-\d{2})\s*$/iu);
    if (date) dates.push(date[1]);
    const rules: [DocumentField,string,number][] = [['taks','TAKS',1],['kaks','KAKS|EMSAL',10],['hmax','HMAX|YENÇOK|YEN\\s*ÇOK',250],['frontSetback','ÖN\\s+(?:BAHÇE|ÇEKME)(?:\\s+MESAFESİ)?',100],['sideSetback','YAN\\s+(?:BAHÇE|ÇEKME)(?:\\s+MESAFESİ)?',100],['rearSetback','ARKA\\s+(?:BAHÇE|ÇEKME)(?:\\s+MESAFESİ)?',100]];
    for (const [field,label,max] of rules) {
      const m = matchLine.match(new RegExp(`^(?:${normalize(label)})\\s*[:=]\\s*(\\d+(?:[.,]\\d+)?)\\s*(m|metre)?\\s*$`,'iu'));
      if (!m) {
        if(new RegExp(`^(?:${normalize(label)})\\s*[:=]`,'iu').test(matchLine)) warnings.push(`Sayfa ${page}: ${line.slice(0,200)} — koşul biçimi/birimi otomatik okunamadı.`);
        continue;
      }
      const value = Number(m[1].replace(',','.'));
      if (value>max || (['taks','kaks'].includes(field) && m[2])) { warnings.push(`Sayfa ${page}: ${line} — birim/aralık kontrolü gerekli.`); continue; }
      candidates.push({field,value,page,quote:line.slice(0,500)});
    }
    const order = matchLine.match(/^(?:yapi nizami|nizam)\s*[:=]\s*(ayrik|bitişik|blok|ikiz|serbest)(?:\s+nizam)?\s*$/iu);
    if(order) { const word=order[1]==='ayrik'?'ayrık':order[1]; candidates.push({field:'buildingOrder',value:word[0].toLocaleUpperCase('tr-TR')+word.slice(1)+' nizam',page,quote:line}); }
    const use = matchLine.match(/^(?:arazi kullanim karari|kullanim karari)\s*[:=]\s*([\p{L} /-]{3,100})\s*$/iu);
    if(use) candidates.push({field:'landUse',value:line.split(/[:=]/).slice(1).join(':').trim(),page,quote:line});
  }
  for (const key of Object.keys(identity) as (keyof DocumentIdentity)[]) identity[key]=unique(identity[key]!);
  if (pages.some(p=>!p.text.trim())) warnings.push('Metinsiz sayfa var; taranmış sayfa/plan görseli için görsel inceleme veya OCR gerekli.');
  if (!candidates.length) warnings.push('Açık etiketli koşul okunamadı; tablo/plan çizimi veya taranmış belge elle incelenmeli.');
  return {schema:'ARKEM-ZONING-DOCUMENT/2.0',...metadata,pages,candidates,identity,scales:[...new Set(scales)],dates:[...new Set(dates)],warnings};
}

export function matchDocumentIdentity(doc: DocumentEvidence, target: DocumentIdentity) {
  const keys = ['province','district','neighborhood','block','parcelNo'] as const;
  const mismatch = keys.filter(k=>doc.identity[k]?.length && (doc.identity[k]!.length!==1 || !target[k].trim() || doc.identity[k]![0]!==normalize(target[k])));
  const missing = keys.filter(k=>!doc.identity[k]?.length || !target[k].trim());
  return {status: mismatch.length ? 'mismatch' : missing.length ? 'incomplete' : 'matched',mismatch,missing} as const;
}

export function assessDocumentConditions(docs: DocumentEvidence[], identity: DocumentIdentity, form: ZoningForm) {
  const matching = docs.filter(d=>matchDocumentIdentity(d,identity).status==='matched');
  return DOCUMENT_FIELDS.map(field=> {
    const candidates = matching.flatMap(d=>d.candidates.filter(c=>c.field===field).map(c=>({...c,hash:d.hash,fileName:d.fileName})));
    const value = candidates[0]?.value ?? null;
    const conflict = value!==null && candidates.some(c=>!same(c.value,value));
    const current = form[field]; const entered = typeof current === 'number' ? Number.isFinite(current)&&current>=0 : !!current.trim();
    const different = value!==null && entered && !same(current,value);
    return {field,candidates,value: conflict ? null : value,current:entered ? current:null,status:conflict ? 'source-conflict' : different ? 'project-conflict' : value===null ? 'missing' : 'read'};
  });
}

export function proposeDocumentTransfer(docs: DocumentEvidence[], identity: DocumentIdentity, form: ZoningForm, now=Date.now()) {
  const fields=assessDocumentConditions(docs,identity,form);
  const reasons:string[]=[];
  if(!docs.length || docs.some(d=>matchDocumentIdentity(d,identity).status!=='matched')) reasons.push('Her belgenin il, ilçe, mahalle, ada ve parseli tam eşleşmeli.');
  if(docs.some(d=>d.scales.length!==1 || d.scales[0]!=='1/1000')) reasons.push('Her belgede yalnız 1/1000 plan ölçeği açıkça okunmalı.');
  if(docs.some(d=>!d.dates.length || d.dates.some(raw=>{const s=raw.includes('-')?raw:raw.split(/[./]/).reverse().join('-');const t=Date.parse(s);return !Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s||t>now;}))) reasons.push('Geçerli, ileri tarihli olmayan belge/onay tarihi okunmalı.');
  if(docs.some(d=>d.warnings.length)) reasons.push('Belgede okunamayan veya kontrol gerektiren bölüm var.');
  if(fields.some(f=>f.status.includes('conflict'))) reasons.push('Kaynaklar veya proje girdileri arasında fark var; aktarım durduruldu.');
  const values: Partial<Pick<ZoningForm,DocumentField>> = {};
  if(!reasons.length) for(const f of fields) if(f.current===null&&f.value!==null) Object.assign(values,{[f.field]:f.value});
  return {fields,reasons,values};
}
