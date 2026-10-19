"use client";
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useProjectKernel } from './ProjectKernel';
import { masArchitectureOffer, masArchitectureLinkState } from '../lib/mas-architecture';
type Props={currentInput:Record<string,unknown>;spaceCount:number;onApply:()=>void;ready:boolean};
const area=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?`${value.toLocaleString('tr-TR',{maximumFractionDigits:1})} m²`:'Belirtilmedi';
export function MassingArchitectureTransfer({currentInput,spaceCount,onApply,ready}:Props){
 const {project}=useProjectKernel();
 const offer=masArchitectureOffer(project.id,project.modules),value=offer.value,link=masArchitectureLinkState(project.id,project.modules,currentInput);
 const applied=link.linked&&!link.stale&&!link.edited;
 return <section className="mas-arc-transfer" aria-label="MAS seçimini mimari programa aktar">
  <header><div><span>04 / ARC · MAS’TAN DEVAM</span><h2>Yerleşimden mahal programına</h2><p>{project.name}{value?` · ${value.siteContext.masHandoff.reference}`:''}</p></div><Link href="/hizli-yerlesim#hizli-senaryo"><ArrowLeft aria-hidden="true"/>MAS’a dön</Link></header>
  {!value?<p role="status">{offer.reason} Mevcut mimari çalışmanız korunur.</p>:<>
   <p className="mas-arc-source">{value.siteContext.masHandoff.label} · {value.siteContext.masHandoff.zoningPending?'Kavramsal çalışma; imar bilgisi bekleniyor.':'Kullanıcı beyanlı imar koşulları; uzman kontrolü gerekli.'}</p>
   <div className="mas-arc-values"><section aria-label="Mevcut mimari girdiler"><h3>Mevcut program</h3><dl><div><dt>Hedef brüt alan</dt><dd>{area(currentInput.targetGross)}</dd></div><div><dt>Kat / kat yüksekliği</dt><dd>{String(currentInput.floors??'—')} kat · {String(currentInput.floorHeight??'—')} m</dd></div><div><dt>Mahal türü</dt><dd>{spaceCount} kayıt korunacak</dd></div></dl></section><section aria-label="Kaydedilmiş MAS seçimi"><h3>MAS seçimi</h3><dl><div><dt>Öneri brüt alanı</dt><dd>{area(value.targetGross)}</dd></div><div><dt>Kat / kat yüksekliği</dt><dd>{value.floors} kat · {value.floorHeight} m</dd></div><div><dt>Kullanım</dt><dd>{value.usage}</dd></div></dl></section></div>
   {!value.use&&<p>Bu kullanım için eşleşen program şablonu yok. Mevcut kullanım türü korunacak; kendiniz kontrol edin.</p>}
   <p>Alan, kat, kat yüksekliği ve plaka oranı aktarılır. Eşleşen kullanım türü güncellenir; mahal adları, adetleri, alanları ve komşuluk kararları değişmez.</p>
  </>}
  {link.stale&&<p className="mas-arc-warning" role="alert">Bu programa daha önce alınan MAS kaydı güncelliğini kaybetti. Kaydı yenileyip tekrar uygulayın. Eski kütle şema hesabında kullanılmaz; çıktı ve sonraki otomatik aktarım bekletilir.</p>}
  {link.edited&&<p className="mas-arc-warning" role="status">MAS aktarımından sonra mimari girdiler düzenlendi. Yeniden uygularsanız alan, kat ve plaka girdileri MAS değerlerine döner; mahal listeniz korunur.</p>}
  <div className="mas-arc-actions"><button type="button" disabled={!ready||!value||applied} onClick={onApply}>{applied?'MAS seçimi uygulandı':'MAS seçimini uygula'}<ArrowRight aria-hidden="true"/></button><small>{applied?'Kaynak bağlantısı kaydedildi. Mahal programını seçilen alana göre gözden geçirin.':'Aktarım bu düğmeye basıldığında yapılır; sayfa açılışında mevcut program üzerine yazılmaz.'}</small></div>
 </section>;
}
