"use client";
import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { extractZoningConditions } from '../lib/zoning-document-parser';
import type { ZoningForm } from '../lib/zoning';
export function ParcelZoningCapture({onApply}:{onApply:(patch:Partial<ZoningForm>)=>void}){
  const [text,setText]=useState(''),[source,setSource]=useState(''),[reviewed,setReviewed]=useState(false),[notice,setNotice]=useState('');
  const candidates=useMemo(()=>extractZoningConditions(text),[text]);
  const usable=candidates.filter(x=>x.confidence==='high');
  return <details className="parcel-zoning-capture"><summary><FileText aria-hidden="true"/>İmar belgesindeki değerleri otomatik okuyun</summary><p>Resmî belgenin metnini yapıştırın. Sistem sayısal değerleri ayırır; parsel, yürürlük ve plan notları kontrolü yerine geçmez. Çelişen değerler aktarılmaz.</p><label>Belge / idare / tarih / sayfa<input value={source} maxLength={300} onChange={e=>{setSource(e.target.value);setReviewed(false);}} placeholder="Değerlerin alındığı belgeyi belirtin"/></label><label>İmar koşulları veya plan notu metni<textarea rows={5} maxLength={20000} value={text} onChange={e=>{setText(e.target.value);setReviewed(false);setNotice('');}} placeholder="Örn. TAKS: 0,40 KAKS: 1,20 Hmax: 12,00 m"/></label>
    {text && <div aria-live="polite">{!candidates.length ? <p>Sayısal değer okunamadı. Değerleri aşağıdaki alanlara elle girebilirsiniz.</p> : <ul>{candidates.map(c=><li key={c.field}><b>{c.label}: {String(c.value)}</b><span>{c.confidence==='review'?'Çelişkili veya sınır dışı — aktarılmayacak':c.evidence}</span></li>)}</ul>}</div>}
    <label className="parcel-capture-confirm"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Bu metnin seçili parsele ait olduğunu ve aktarılacak değerleri kaynak belgeyle karşılaştırdım.</label><button type="button" disabled={!reviewed||!source.trim()||!usable.length} onClick={()=>{const patch:Partial<ZoningForm>={sourceDocument:source,verification:'user-declared'};for(const item of usable) Object.assign(patch,{[item.field]:item.value});onApply(patch);setNotice('Okunan değerler bu parsele aktarıldı. Emsal hesabı güncellendi; net imar alanını ve eksik girdileri ayrıca tamamlayın.');}}>Kontrol ettiğim değerleri projeye işle</button><p role="status">{notice}</p>
  </details>;
}
