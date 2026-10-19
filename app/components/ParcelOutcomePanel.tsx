"use client";
import Link from 'next/link';
import { ArrowRight, Check, Download, FileText, Files, Layers, Ruler, CalendarDays, Calculator } from 'lucide-react';
import { toLocalMeters, type GeoPoint } from '../lib/geo';
import type { createZoningMassingModel } from '../lib/zoning-massing';
import { CONCEPT_ASSUMPTIONS } from '../lib/parcel-concept';

type Alternative = ReturnType<typeof createZoningMassingModel>['alternatives'][number];
export function ParcelAlternativePreview({ parcel, building, label }: { parcel: GeoPoint[]; building: GeoPoint[]; label: string }) {
  const origin = parcel[0];
  if (!origin) return null;
  const boundary = parcel.map(p => toLocalMeters(p, origin));
  const minX = Math.min(...boundary.map(p => p.east)), maxX = Math.max(...boundary.map(p => p.east));
  const minY = Math.min(...boundary.map(p => p.north)), maxY = Math.max(...boundary.map(p => p.north));
  const scale = Math.min(260 / Math.max(1, maxX - minX), 140 / Math.max(1, maxY - minY));
  const path = (points: GeoPoint[]) => points.map(p => { const v = toLocalMeters(p, origin); return `${150 + (v.east - (minX+maxX)/2)*scale},${90 - (v.north-(minY+maxY)/2)*scale}`; }).join(' ');
  return <svg viewBox="0 0 300 180" role="img" aria-label={label} className="parcel-alternative-preview"><polygon points={path(parcel)} fill="#e8f0e9" stroke="#4b7965" strokeWidth="1.5"/>{building.length >= 3 && <polygon points={path(building)} fill="#225c4f" stroke="#164438" strokeWidth="1.5"/>}<path d="M278 34V16m-4 6 4-6 4 6" fill="none" stroke="#244954" strokeWidth="1.5"/><text x="278" y="46" textAnchor="middle" fontSize="10" fill="#244954">K</text></svg>;
}
type Props = {
  parcel: GeoPoint[]; alternatives: Alternative[]; selectedId: string; concept: boolean;
  onSelect: (id: string) => void; onPdf: () => void; onSummary: () => void; onDxf: () => void; onKml: () => void;
  disabled: boolean; busy: boolean; projectName: string; onContinue: () => void;
  hideDelivery?: boolean;
  showAlternatives: boolean; hasBuilding: boolean; onRemove: () => void;
};
export function ParcelOutcomePanel(p: Props) {
  return <section className="parcel-outcome" aria-label="Yerleşim önerileri ve teknik çıktılar">
    {p.showAlternatives && <><header><div><h3>Üç öneriyi karşılaştırın.</h3><p>{p.concept ? 'İmar bilgisi olmadan bir başlangıç çalışması hazırladınız. Aşağıdaki alanlar öneri büyüklüğüdür; inşaat hakkı değildir.' : 'Girdiğiniz koşullara göre üretilen ön yerleşimler. Birini seçtiğinizde harita ve çıktılar birlikte güncellenir.'}</p></div><span className="parcel-evidence-tag">{p.concept ? 'İmar bekleniyor · kavramsal' : 'Beyan edilen girdiler · ön çalışma'}</span></header>
    {p.concept && <p className="parcel-concept-note">{CONCEPT_ASSUMPTIONS}</p>}
    <div className="parcel-alternatives">{p.alternatives.map(a => <article key={a.id} data-selected={p.hasBuilding && p.selectedId === a.id}>
      <ParcelAlternativePreview parcel={p.parcel} building={a.polygon} label={`${a.label}: parsel üzerinde öneri yerleşimi, ölçeksiz`}/>
      <div className="parcel-alternative-body"><h4>{a.label}</h4><p>{a.note}</p><dl><div><dt>Öneri brüt alanı</dt><dd>{a.grossArea.toLocaleString('tr-TR')} m²</dd></div><div><dt>Yapı tabanı</dt><dd>{a.footprint.toLocaleString('tr-TR')} m²</dd></div><div><dt>Boyut / kat</dt><dd>{a.width} × {a.depth} m / {a.floors} kat</dd></div></dl>
      <button type="button" aria-pressed={p.hasBuilding && p.selectedId === a.id} disabled={a.status !== 'fits' || p.busy} onClick={() => p.onSelect(a.id)}>{p.hasBuilding && p.selectedId === a.id ? <Check aria-hidden="true"/> : <Layers aria-hidden="true"/>}{a.status !== 'fits' ? 'Geometri için uzman incelemesi gerekli' : p.hasBuilding && p.selectedId === a.id ? 'Haritada seçili' : 'Bu yerleşimi seç'}</button></div>
    </article>)}</div><button type="button" className="parcel-without-building" disabled={!p.hasBuilding || p.busy} onClick={p.onRemove}>{p.hasBuilding ? 'Yapıyı kaldır, yalnız parsel ile devam et' : 'Yalnız parsel çıktısı seçili'}</button></>}
    {!p.hideDelivery && <ParcelTechnicalDownloads {...p}/>}
    <section className="parcel-next-modules" aria-label="Aynı projeyle devam edin"><h3>Sonraki adımlar</h3><p>Seçiminizi bu projenin devam kaydına aktarın. Mevcut modül girdileriniz silinmez; imar belirsizliği sonraki çalışmalarda görünür kalır.</p><nav>{[
      {href:'/mimari-program-studyosu', label:'Mimari program', note:'Alanları ve ihtiyaç listesini geliştirin', Icon:Layers},
      {href:'/yapi-sistemi-karsilastirma', label:'Taşıyıcı sistem seçimi', note:'Aynı parsel ve yapı alanıyla karşılaştırın', Icon:Ruler},
      {href:'/proje-on-planlama', label:'İş ve ön maliyet', note:'Birim maliyet ve iş adımlarını düzenleyin', Icon:Calculator},
      {href:'/proje-os', label:'Proje yönetimi', note:'Görev ve takip çalışma alanına geçin', Icon:CalendarDays},
    ].map(({href,label,note,Icon}) => <Link key={href} href={href} aria-disabled={p.disabled} onClick={event => { if (p.disabled) { event.preventDefault(); return; } p.onContinue(); }}><Icon aria-hidden="true"/><span><b>{label}</b><small>{note}</small></span><ArrowRight aria-hidden="true"/></Link>)}</nav></section>
  </section>;
}

export function ParcelTechnicalDownloads(p: Pick<Props, "projectName" | "hasBuilding" | "disabled" | "busy" | "onPdf" | "onSummary" | "onDxf" | "onKml">) {
  return <section className="parcel-delivery" id="parsel-teknik-ciktilar" aria-label="Teknik dosyaları indirin"><header><div><h3>Teknik çıktılar</h3><p>{p.projectName} · {p.disabled ? 'Çıktıları açmak için önce kaynaklı bir parsel sınırı bağlayın.' : p.hasBuilding ? 'Seçili yerleşim, parsel sınırı ve kaynak notları birlikte aktarılır.' : 'Yapı yerleştirilmedi. Çıktılar yalnız parsel sınırı, mevcut bilgiler ve kaynak notlarını içerir.'}</p></div><Download aria-hidden="true"/></header>
      <div className="parcel-delivery-actions">{[
        {label:'A3 teknik pafta', note:p.hasBuilding ? 'Yatay PDF · yerleşim, ölçü, antet' : 'Yatay PDF · parsel sınırı, ölçü, antet', Icon:Files, action:p.onPdf},
        {label:'A4 özet rapor', note:'PDF · proje özeti ve kaynak notları', Icon:FileText, action:p.onSummary},
        {label:'Düzenlenebilir DXF', note:'CAD · metre biriminde katmanlı çizim', Icon:Ruler, action:p.onDxf},
        {label:'Harita KML dosyası', note:p.hasBuilding ? 'Google Earth · sınır ve ön yapı' : 'Google Earth · yalnız parsel sınırı', Icon:Layers, action:p.onKml},
      ].map(({label,note,Icon,action}) => <button type="button" key={label} disabled={p.disabled} onClick={action}><Icon aria-hidden="true"/><span><b>{label}</b><small>{p.busy ? 'Dosya hazırlanıyor…' : note}</small></span><Download aria-hidden="true"/></button>)}</div>
      <small>Ön çalışma çıktısıdır; ruhsat, aplikasyon, uygulama projesi veya imar onayı değildir.</small>
    </section>;
}
