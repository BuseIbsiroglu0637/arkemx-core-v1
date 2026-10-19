"use client";
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Layers, MapPin } from 'lucide-react';
import { useProjectKernel } from './ProjectKernel';
import { ParcelAlternativePreview } from './ParcelOutcomePanel';
import { CONCEPT_ASSUMPTIONS } from '../lib/parcel-concept';
import { massingContext, massingAlternatives, massingSnapshot, restoreMassingSelection, type MassingContext, type MassingMode } from '../lib/massing-workspace';
import { downloadTextFile } from '../lib/engineering';
import type { ParcelFrontEdge } from '../lib/zoning-massing';
const number=(n:number|null)=>n===null?'Belirtilmedi':`${n.toLocaleString('tr-TR',{maximumFractionDigits:1})} m²`;
export function DemoMassingWorkspace(){
 const {project,hydrated}=useProjectKernel();
 if(!hydrated)return <p role="status">Proje açılıyor…</p>;
 const context=massingContext(project.id,project.modules);
 return <MassingWorkspace key={context.signature} context={context}/>;
}
function MassingWorkspace({context:c}:{context:MassingContext}){
 const {project,patchModule}=useProjectKernel();
 const persisted=restoreMassingSelection(project.modules['quick-site-scenario'],c);
 const [mode,setMode]=useState<MassingMode|''>(persisted?.mode??'');
 const [floorHeight,setFloorHeight]=useState(persisted?.floorHeight??c.floorHeight);
 const [frontEdge,setFrontEdge]=useState<ParcelFrontEdge>(persisted?.frontEdge??c.frontEdge);
 const [selectedId,setSelectedId]=useState<string>(persisted?.selectedId??'');
 const [notice,setNotice]=useState('');
 const model=mode?massingAlternatives(c,mode,floorHeight,frontEdge):null;
 const choice=model?.alternatives.find(a=>a.id===selectedId && a.status==='fits');
 const saved=Boolean(choice&&persisted&&persisted.mode===mode&&persisted.floorHeight===floorHeight&&persisted.frontEdge===frontEdge&&persisted.selectedId===selectedId);
 const input={mode:(mode||'concept') as MassingMode,floorHeight,frontEdge,selectedId};
 const snapshot=()=>mode?massingSnapshot(c,input):null;
 const save=()=>{const value=snapshot();if(!value)return;patchModule('quick-site-scenario',value);setNotice('Yerleşim seçiminiz bu projeye kaydedildi. GIS kaydınız korunuyor.');};
 const exportJson=()=>{const value=snapshot();if(value)downloadTextFile('arkem-mas-yerlesim.json',JSON.stringify(value,null,2),'application/json');};
 return <section className="demo-massing" aria-label="Hızlı yerleşim çalışma alanı">
  <header className="mas-heading"><div><span>03 / MAS · HIZLI YERLEŞİM</span><h1>Yerleşiminizi karşılaştırın</h1><p>Aynı parsel üzerinde üç öneriyi inceleyin, birini projenize kaydedin.</p></div><Link href="/arsa-fizibilite-studyosu#geo-studyo"><ArrowLeft aria-hidden="true"/>Parsel ve arsaya dön</Link></header>
  <section className="mas-project" aria-label="Brief ve GIS bilgileri"><div><small>PROJE</small><h2>{project.name}</h2><p><MapPin aria-hidden="true"/>{c.record?.reference??c.brief?.location??'Konum belirtilmedi'}</p></div><dl><div><dt>Kaynak sınır alanı</dt><dd>{number(c.record?.geometry.computedArea??null)}</dd></div><div><dt>Brief yapı hedefi</dt><dd>{number(c.brief?.targetGrossArea??null)}</dd></div><div><dt>GIS’te seçilen yapı</dt><dd>{number(c.gisPlacement)}</dd></div><div><dt>Kullanım / sistem</dt><dd>{c.usage} · {c.system}</dd></div></dl><p>Kaynak sınır alanı, yapı hedefi ve yerleşim alanı farklı bilgilerdir. Hiçbiri tek başına imar hakkı göstermez.</p></section>
  {!c.record?<section className="mas-empty"><h2>Önce parsel sınırını bağlayın</h2><p>Bu projede güncel kimlikle eşleşen, kullanılabilir bir GIS sınırı yok. Örnek dikdörtgen parsel üzerinden otomatik sonuç üretilmedi.</p><Link href="/arsa-fizibilite-studyosu#geo-studyo">Parsel sınırını tamamla <ArrowRight aria-hidden="true"/></Link></section>:<>
   <section className="mas-basis"><header><span>1 / ÇALIŞMANIN DAYANAĞI</span><h2>Nasıl karşılaştıralım?</h2></header><div role="group" aria-label="Yerleşim çalışma biçimi"><button type="button" aria-pressed={mode==='concept'} onClick={()=>{setMode('concept');setSelectedId('');setNotice('');}}><b>Kavramsal yerleşim</b><small>İmar hakkı hesaplamadan, açık tasarım varsayımlarıyla.</small></button><button type="button" aria-pressed={mode==='zoning'} disabled={!c.zoningReady} onClick={()=>{setMode('zoning');setSelectedId('');setNotice('');}}><b>Beyan edilen imar koşulları</b><small>{c.zoningReady?'GIS’te kaynakla eşleştirilen koşulları kullanın.':'GIS’te belge, net alan ve koşul kontrolü tamamlanmalı.'}</small></button></div>
   {mode==='concept'&&<p className="mas-note">{CONCEPT_ASSUMPTIONS}</p>}{mode==='zoning'&&<p className="mas-note">Koşullar kullanıcı beyanıdır; uzman veya idare onayı değildir. Net imar alanı: {number(c.draft.netPlotArea)}.</p>}
   <details className="mas-assumptions"><summary>Kat yüksekliği ve ön cephe yönü</summary><div><label>Kat yüksekliği (m)<input type="number" min="2.6" max="12" step=".1" value={floorHeight} onChange={e=>{setFloorHeight(Number(e.target.value));setSelectedId('');setNotice('');}}/><small>Başlangıç: {c.floorHeight} m · {c.floorHeightAssumed?'Tasarım varsayımı; GIS kat yüksekliği belirtilmedi.':'GIS’teki kat yüksekliği beyanı.'}</small></label><label>Ön cephe yönü<select value={frontEdge} onChange={e=>{setFrontEdge(e.target.value as ParcelFrontEdge);setSelectedId('');setNotice('');}}><option value="north">Kuzey</option><option value="east">Doğu</option><option value="south">Güney</option><option value="west">Batı</option></select><small>Yol cephesi ve kotlar uzman incelemesi gerektirir.</small></label></div></details>
   {!Number.isFinite(floorHeight)||floorHeight<2.6||floorHeight>12?<p role="alert">Kat yüksekliği 2,6–12 m arasında olmalı. Sonuç ve çıktı bekletiliyor.</p>:null}
   </section>
   {!mode&&<p className="mas-note">Üç öneriyi oluşturmak için çalışma biçimini seçin. Mevcut GIS yerleşiminiz değişmez.</p>}
   {project.modules['quick-site-scenario']&&!persisted&&<p className="mas-note">Önceki MAS kaydı bu güncel parsel/brief ile eşleşmiyor veya eski örnek senaryo biçiminde. Girdilere otomatik alınmadı; yeni bir seçim kaydedene kadar önceki kayıt korunur.</p>}
   {model&&<section className="mas-comparison" aria-label="Üç yerleşim önerisi"><header><span>2 / ALTERNATİFLER</span><h2>Üç öneriyi karşılaştırın</h2><p>Önizlemeler GIS’teki kaynak sınırını kullanır. Sınır içindeki şekil önerilen yapı tabanıdır; aplikasyon çizimi değildir.</p></header><div className="mas-cards">{model.alternatives.map(a=><article key={a.id} data-selected={selectedId===a.id&&a.status==='fits'}><ParcelAlternativePreview parcel={c.record!.geometry.points} building={a.polygon} label={`${a.label}: kaynak parsel üzerinde öneri`}/><div><h3>{a.label}</h3><p>{a.note}</p><dl><div><dt>Öneri brüt alanı</dt><dd>{number(a.grossArea)}</dd></div><div><dt>Yapı tabanı</dt><dd>{number(a.footprint)}</dd></div><div><dt>Boyut / kat</dt><dd>{a.width.toLocaleString('tr-TR')} × {a.depth.toLocaleString('tr-TR')} m · {a.floors} kat</dd></div><div><dt>Brief hedefine fark</dt><dd>{c.brief?.targetGrossArea?`${a.grossArea-c.brief.targetGrossArea>=0?'+':''}${(a.grossArea-c.brief.targetGrossArea).toLocaleString('tr-TR',{maximumFractionDigits:1})} m²`:'Hedef belirtilmedi'}</dd></div></dl><button type="button" aria-pressed={selectedId===a.id&&a.status==='fits'} disabled={a.status!=='fits'} onClick={()=>{setSelectedId(a.id);setNotice('');}}>{selectedId===a.id?<Check aria-hidden="true"/>:<Layers aria-hidden="true"/>}{a.status!=='fits'?'Geometri için inceleme gerekli':selectedId===a.id?'Karşılaştırmada seçili':'Bu öneriyi seç'}</button></div></article>)}</div><p>Öneriler alanı farklı kullanır; brief hedefi otomatik olarak yapılaşma hakkına veya kesin sonuca çevrilmez.</p></section>}
   <section className="mas-save" aria-label="Seçimi kaydedin"><div><span>3 / KAYIT VE DEVAM</span><h2>{choice?choice.label:'Henüz öneri seçilmedi'}</h2><p>{choice?`${number(choice.grossArea)} öneri brüt alan · ${saved?'Projeye kaydedildi':'Kaydedilmemiş seçim'}`:'Bir öneri seçtikten sonra kaydedebilir ve çıktısını alabilirsiniz.'}</p></div><div className="mas-actions"><button type="button" disabled={!choice||saved} onClick={save}>{saved?'Projeye kaydedildi':'Seçimi projeye kaydet'}</button><button type="button" disabled={!choice} onClick={exportJson}><Download aria-hidden="true"/>Senaryo JSON indir</button>{saved?<Link href="/mimari-program-studyosu#mimari-motor">Mimari programa geç <ArrowRight aria-hidden="true"/></Link>:<span>Devam bağlantısı kayıt sonrası açılır.</span>}</div>{notice&&<p role="status">{notice}</p>}<small>Seçim MAS kaydında tutulur; GIS geometrisi, imar girdileri ve mevcut mimari program üzerine yazılmaz.</small></section>
  </>}
  <footer>Ön yerleşim çalışmasıdır; ruhsat, statik hesap, kesin maliyet veya performans analizi değildir.</footer>
 </section>;
}
