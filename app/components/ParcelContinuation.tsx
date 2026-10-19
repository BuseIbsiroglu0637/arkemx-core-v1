"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, MapPinned, Download } from 'lucide-react';
import { useProjectKernel } from './ProjectKernel';
import { parcelContinuationState, preliminaryCost } from '../lib/parcel-continuation';
import { downloadTextFile } from '../lib/engineering';

export function ParcelContinuationStrip({ onApply }: { onApply?: () => void }) {
  const {project} = useProjectKernel();
  const {value,stale} = parcelContinuationState(project.id,project.modules);
  if(!value) return null;
  return <section className="parcel-continuation-strip" aria-label="Arsa rehberinden gelen proje"><MapPinned aria-hidden="true"/><div><b>{value.reference}</b><p>{value.parcelOnly ? 'Yalnız parsel kaydı · yapı yerleştirilmedi' : `${value.grossArea.toLocaleString('tr-TR')} m² öneri brüt alan · ${value.floors} kat`} · {value.zoningPending ? 'İmar bilgisi bekleniyor' : 'Beyan edilen girdiler; uzman kontrolü gerekli'}</p><small>{stale ? 'Parsel veya yerleşim değişti. Devam kaydını Arsa Rehberinden yenileyin; eski alanı hesapta kullanmayın.' : `${project.name} · ${value.sourceRevision} · aynı proje kaydı`}</small></div>{stale ? <Link href="/arsa-fizibilite-studyosu">Kaydı yenile<ArrowRight aria-hidden="true"/></Link> : onApply && !value.parcelOnly ? <button type="button" onClick={onApply}>Bu alanı girdilere al<ArrowRight aria-hidden="true"/></button> : <Link href="/proje-on-planlama">İş ve ön maliyete devam<ArrowRight aria-hidden="true"/></Link>}</section>;
}
const phases = ['İmar ve kaynak kontrolü','İhtiyaç programı ve sistem kararı','Mimari ve mühendislik projeleri','Teklif ve tedarik hazırlığı','Saha uygulaması ve teslim'];
export function ParcelPreplanning() {
  const {project,patchModule,hydrated} = useProjectKernel();
  const {value,stale} = parcelContinuationState(project.id,project.modules);
  const [rate,setRate] = useState(''),[basis,setBasis]=useState(''),[durations,setDurations]=useState<string[]>(phases.map(()=>'')),[notice,setNotice]=useState(''),[manualArea,setManualArea]=useState('');
  useEffect(()=>{
    const saved = project.modules['parcel-preplanning'] as {sourceSignature?:string;rate?:string;basis?:string;durations?:string[];manualArea?:string}|undefined;
    const matches = value && saved?.sourceSignature===value.sourceSignature;
    setManualArea(matches && typeof saved.manualArea==='string' ? saved.manualArea : '');
    setRate(matches && typeof saved.rate==='string'?saved.rate:'');setBasis(matches && typeof saved.basis==='string'?saved.basis:'');setDurations(matches && Array.isArray(saved.durations)&&saved.durations.length===phases.length?saved.durations:phases.map(()=>''));setNotice('');
  },[project.id,value?.sourceSignature]);
  if(!hydrated) return <p>Proje kaydınız yükleniyor…</p>;
  if(!value||stale) return <section className="parcel-preplanning"><h2>{stale?'Yerleşim kaydınızı yenileyin':'Önce parselinizi bağlayın'}</h2><p>Güncel parsel kaydınızı Arsa Rehberinden bu çalışma alanına aktarın. Yapı yerleştirmeniz zorunlu değildir.</p><Link href="/arsa-fizibilite-studyosu">Arsa Rehberine dön</Link></section>;
  const studyArea = value.parcelOnly ? (manualArea.trim() && Number.isFinite(Number(manualArea)) && Number(manualArea)>0 && Number(manualArea)<=1e8 ? Number(manualArea) : null) : value.grossArea;
  const cost=studyArea === null ? null : preliminaryCost(studyArea,rate.trim()?Number(rate):null);
  const days=durations.every(x=>x.trim()&&Number.isFinite(Number(x))&&Number(x)>0&&Number(x)<=3650)?durations.reduce((sum,x)=>sum+Number(x),0):null;
  const payload={schema:'ARKEM-PARCEL-PREPLANNING/1',projectId:project.id,reference:value.reference,sourceSignature:value.sourceSignature,sourceRevision:value.sourceRevision,mode:value.mode,rate,basis,durations,manualArea,grossArea:studyArea,areaBasis:value.parcelOnly ? 'Kullanıcı hedef alanı; inşaat hakkı veya yerleşim hesabı değildir' : 'Parselde seçilmiş öneri yapı',preliminaryCost:cost,sequentialDays:days,authoritative:false,limitations:['Birim maliyet kullanıcı girdisidir; teklif veya piyasa fiyatı doğrulaması değildir.','KDV, harç, arsa, finansman ve kapsam dışı işler ayrıca değerlendirilir.','Süreler sıralı toplama dayalıdır; kritik yol ve kaynak planlaması değildir.',...value.limitations]};
  return <section className="parcel-preplanning"><ParcelContinuationStrip/><h2>Parselinizden iş ve ön maliyete.</h2><p>{value.parcelOnly ? 'Yapı seçmeden devam ediyorsunuz. İhtiyaç alanınızı biliyorsanız bir hedef girin; bilmiyorsanız boş bırakıp iş adımlarını planlayın.' : `Parselde seçtiğiniz ${value.grossArea.toLocaleString('tr-TR')} m² öneri alanı bu çalışmanın başlangıcıdır.`} Fiyat ve süreleri siz belirleyin; bilinmeyenler boş kalsın.</p>
    <div className="parcel-preplanning-columns"><section><h3>Ön maliyet</h3>{value.parcelOnly && <label>Hedef brüt yapı alanı · m² (isteğe bağlı)<input type="number" min="1" max="100000000" value={manualArea} onChange={e=>setManualArea(e.target.value)} placeholder="İhtiyaç duyduğunuz alan"/><small>Yalnız sizin hedefinizdir; izin verilen alan değildir.</small></label>}<label>Yapım birim maliyeti · TL/m²<input type="number" min="0" max="100000000" value={rate} onChange={e=>setRate(e.target.value)} placeholder="Teklifinizdeki birim maliyet"/></label><label>Fiyat kaynağı, tarihi ve kapsamı<textarea rows={3} maxLength={600} value={basis} onChange={e=>setBasis(e.target.value)} placeholder="Teklif / tarih / dahil işler"/></label><dl><dt>{studyArea === null ? 'Hedef alan' : `${studyArea.toLocaleString('tr-TR')} m²`} × birim maliyet</dt><dd>{cost===null?'Alan veya birim maliyet bekleniyor':`${cost.toLocaleString('tr-TR',{maximumFractionDigits:0})} TL`}</dd></dl><p>Bu hesap teklif değildir. KDV, arsa, harçlar, finansman, zemin ve kapsam dışı işler ayrıca değerlendirilir.</p></section>
    <section><h3>İş adımları</h3><ol>{phases.map((title,i)=><li key={title}><label>{title}<span><input type="number" min="1" max="3650" value={durations[i]} onChange={e=>setDurations(current=>current.map((x,j)=>j===i?e.target.value:x))} aria-label={`${title} süresi`}/> gün</span></label></li>)}</ol><p><b>{days===null?'Süreler tamamlandığında sıralı toplam gösterilir.':`Sıralı ön toplam: ${days} gün`}</b></p><small>Paralel işler, tatiller, izin süreçleri ve kaynak kapasitesi bu toplama dahil değildir.</small></section></div>
    <div className="parcel-preplanning-actions"><button type="button" onClick={()=>{patchModule('parcel-preplanning',payload);setNotice('Ön maliyet ve iş adımları aynı projeye kaydedildi.');}}>Çalışmayı projeye kaydet</button><button type="button" onClick={()=>downloadTextFile('arkem-on-planlama.json',JSON.stringify(payload,null,2),'application/json')}><Download aria-hidden="true"/>Çalışma kaydını indir</button><Link href="/yapi-sistemi-karsilastirma">Sistem seçeneklerini karşılaştır<ArrowRight aria-hidden="true"/></Link></div><p role="status">{notice}</p>
  </section>;
}
