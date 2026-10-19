"use client";
import { useState, type ReactNode } from 'react';
import { FileText, Search, ArrowRight, MapPin } from 'lucide-react';
import { DEMO_ENABLED } from '../lib/demo';
type Props = {
 reference: string; boundaryArea: number | null; netArea: number | null; targetArea: number | null;
 documentReference: string; documentDate: string; sourceUrl: string; sourceMatches: boolean;
 onDocument: (patch:{documentReference?:string;documentDate?:string})=>void;
 onUrl: (value:string)=>void; onSourceConfirm:(value:boolean)=>void;
 canConcept:boolean; onConcept:()=>void; conditions:ReactNode; budget:ReactNode; research:ReactNode;
 preview:ReactNode;
};
const area=(value:number|null)=>value===null?'Belirtilmedi':`${value.toLocaleString('tr-TR',{maximumFractionDigits:2})} m²`;
export function ParcelZoningReview(p:Props){
 const [path,setPath]=useState<'document'|'source'|''>('');
 return <section className="zoning-review" aria-label="İmar ön incelemesi">
  <header className="zoning-review-header"><div><span>03 / İMAR BİLGİSİ</span><h2>İmar ön incelemesi</h2><p><MapPin aria-hidden="true"/>{p.reference}</p></div><strong>{DEMO_ENABLED?'Demo · otomatik sorgu kapalı':'Kaynak kontrolü gerekli'}</strong></header>
  <div className="zoning-route-choices" role="group" aria-label="İmar bilgisiyle nasıl devam edelim?">
   <button type="button" aria-pressed={path==='document'} onClick={()=>setPath('document')}><FileText aria-hidden="true"/><span><b>Belgem var</b><small>Belgeyi referanslayın, koşulları girin.</small></span></button>
   <button type="button" aria-pressed={path==='source'} onClick={()=>setPath('source')}><Search aria-hidden="true"/><span><b>Resmî kaynağı bul</b><small>Seçili parselin idare bağlantısını inceleyin.</small></span></button>
   <button type="button" disabled={!p.canConcept} onClick={p.onConcept}><ArrowRight aria-hidden="true"/><span><b>İmar bilgisi olmadan devam et</b><small>İmar bekleniyor olarak kavramsal çalışın.</small></span></button>
  </div>
  <div className="zoning-review-grid"><div className="zoning-review-main">
   {!path&&<section className="zoning-welcome"><h3>Nasıl ilerlemek istersiniz?</h3><p>Elinizdeki belge bilgilerini taslak olarak kaydedebilir veya önce resmî kaynağı inceleyebilirsiniz. Bilinmeyen imar değerleri otomatik doldurulmaz.</p>{!p.canConcept&&<p>Kavramsal yerleşim için önce parsel sınırını bağlayın. Belge taslağını şimdi hazırlayabilirsiniz.</p>}</section>}
   {path==='source'&&<section className="zoning-source-route"><h3>Seçili parselin resmî kaynağı</h3>{p.research}<button type="button" className="zoning-primary" onClick={()=>setPath('document')}>Belge bilgilerini girmeye geç →</button><p>Belediye bağlantısının bulunması, parselin imar koşullarının doğrulandığı anlamına gelmez.</p></section>}
   <div className="zoning-document-route" hidden={path!=='document'}>
    <section className="zoning-document"><span>1 / BELGE VE KAYNAK</span><h3>Belgenin hangi parsele ait olduğunu belirtin</h3><p>Demo sürümünde belge referansı tutulur; dosya içeriği sunucuya yüklenmez.</p><div className="zoning-document-fields"><label>Belge adı / numarası<input value={p.documentReference} maxLength={300} onChange={e=>p.onDocument({documentReference:e.currentTarget.value})} placeholder="İmar durumu belgesi / belge no"/></label><label>Belge tarihi<input type="date" value={p.documentDate} onChange={e=>p.onDocument({documentDate:e.currentTarget.value})}/></label><label className="zoning-source-url">Kaynak bağlantısı (isteğe bağlı)<input type="url" value={p.sourceUrl} maxLength={1000} onChange={e=>p.onUrl(e.currentTarget.value)} placeholder="https://…"/></label></div><label className="zoning-source-confirm"><input type="checkbox" checked={p.sourceMatches} onChange={e=>p.onSourceConfirm(e.currentTarget.checked)}/><span>Belge referansının seçili parsele ve mevcut sınır kaydına ait olduğunu kontrol ettim. Bu işlem uzman veya idare onayı değildir.</span></label></section>
    <section className="zoning-conditions"><span>2 / İMAR KOŞULLARI</span>{p.conditions}</section>
    <section className="zoning-budget"><span>3 / ALAN ÖZETİ VE KAYIT</span>{p.budget}</section>
   </div>
  </div><aside className="zoning-parcel-summary" aria-label="Seçili parsel ve alan özeti"><h3>Parsel özeti</h3>{p.preview}<dl><div><dt>Kaynak sınır alanı</dt><dd>{area(p.boundaryArea)}</dd></div><div><dt>Beyan edilen net imar alanı</dt><dd>{area(p.netArea)}</dd></div><div><dt>Brief yapı hedefi</dt><dd>{area(p.targetArea)}</dd></div><div><dt>Belge durumu</dt><dd>{p.documentReference?p.sourceMatches?'Kullanıcı kontrolü · incelenmedi':'Parsel eşleşmesi kontrol bekliyor':'Belge bilgisi bekleniyor'}</dd></div></dl><p>Bu üç alan farklı amaçlar taşır. Kaynak sınır alanı otomatik olarak net imar alanına çevrilmez; yapı hedefi imar hakkı değildir.</p></aside></div>
 </section>;
}
