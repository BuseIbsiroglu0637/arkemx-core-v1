"use client";
import { useEffect, useRef, useState } from 'react';
import { useProjectKernel } from './ProjectKernel';
import { assessZoningResearch, zoningResearchSources } from '../lib/zoning-research';
import type { OfficialZoningResult, ZoningParcelInput } from '../lib/kastamonu-zoning';
import type { ZoningSourceAccess } from '../lib/zoning-source-access';
import type { ZoningForm } from '../lib/zoning';

const accessLabel: Record<ZoningSourceAccess['status'],string> = { 'page-received':'Kaynağa erişildi · parsel koşulları doğrulanmadı', 'service-readable':'Servis şeması okundu · parsel koşulları doğrulanmadı', 'login-required':'Resmî ekranda giriş gerekli', restricted:'Erişim sınırlı', unavailable:'Bağlantı kurulamadı', unexpected:'İçerik kontrolü gerekli' };
const methodLabel = { service:'Sınırlı otomatik okuma', viewer:'Resmî ekranda sorgulama', login:'Kimlik doğrulamalı hizmet', documents:'Belge / karar araştırması' };
type AccessReport = { schema: 'ARKEM-ZONING-ACCESS/1.0'; province: string; district: string; sources: ZoningSourceAccess[] };
export function ZoningResearchPanel({ identity, zoning, result, eligible, loading, notice, onQuery }: {
  identity: ZoningParcelInput; zoning: ZoningForm; result: OfficialZoningResult | null;
  eligible: boolean; loading: boolean; notice: string; onQuery: () => void;
}) {
  const { project, patchModule } = useProjectKernel();
  const [catalogProvince, setCatalogProvince] = useState(identity.province);
  const [catalogDistrict, setCatalogDistrict] = useState(identity.district);
  const [access, setAccess] = useState<AccessReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const sources = zoningResearchSources(catalogProvince, catalogDistrict);
  const assessment = assessZoningResearch(identity, result, zoning);
  const reference = [identity.province, identity.district, identity.neighborhood, `Ada ${identity.block || '—'}`, `Parsel ${identity.parcelNo || '—'}`].join(' / ');
  const saved = project.modules.zoningResearchAccess as { projectId?:string; identityKey?:string; report?:AccessReport } | undefined;
  const report = access ?? (saved?.projectId === project.id && saved.identityKey === JSON.stringify(identity) && saved.report?.schema === 'ARKEM-ZONING-ACCESS/1.0' ? saved.report : null);
  const activeReport = report?.province === catalogProvince && report.district === catalogDistrict ? report : null;
  const changeCatalog = (province:string, district = '') => {
    controller.current?.abort(); setBusy(false); setError(''); setAccess(null); setCatalogProvince(province); setCatalogDistrict(district);
  };
  async function checkAccess() {
    if (busy || (controller.current && !controller.current.signal.aborted)) return;
    const request = new AbortController(); controller.current = request; setBusy(true); setError(''); setAccess(null);
    try {
      const response = await fetch('/api/zoning-research', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({province:catalogProvince,district:catalogDistrict}),signal:request.signal});
      const data = await response.json() as AccessReport & {error?: string};
      if (!response.ok) throw Error(data.error || 'Kaynak araştırması tamamlanamadı.');
      if (data.schema !== 'ARKEM-ZONING-ACCESS/1.0' || data.province !== catalogProvince || data.district !== catalogDistrict || !Array.isArray(data.sources) || data.sources.length !== sources.length || sources.some(source => !data.sources.some((s: ZoningSourceAccess) => s && s.id === source.id && Object.hasOwn(accessLabel,s.status)))) throw Error('Araştırma yanıtının kapsamı doğrulanmadı.');
      if (request.signal.aborted) return;
      setAccess(data);
      patchModule('zoningResearchAccess', {projectId:project.id,identityKey:JSON.stringify(identity),report:data});
    } catch (e) { if (!request.signal.aborted) setError(e instanceof Error ? e.message : 'Kaynak araştırması tamamlanamadı.'); }
    finally { if (!request.signal.aborted) { setBusy(false); controller.current = null; } }
  }
  function downloadResearch() {
    const data = {schema:'ARKEM-ZONING-RESEARCH/1.0',projectId:project.id,revision:project.revision,exportedAt:new Date().toISOString(),identity,sourceCatalog:sources,access:activeReport,parcelQuery:assessment.matching ? result : null,assessment,limitations:['Bağlantı kontrolü parsel imar sonucu değildir.','Kaynak kaydı resmî imar durumu onayı değildir.','Sakarya koşullarının otomatik aktarımı bağlı değil.','Plan notu ve yetkili idare incelemesi gerekli.']};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href=url; link.download=`${project.id}-imar-arastirmasi.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="geo-imar-research" aria-label="İmar araştırması ve kaynak karşılaştırması">
    <header><span>İMAR ARAŞTIRMASI</span><h4>Kaynağı bul, parseli eşleştir, koşulları karşılaştır.</h4><p>{reference}</p></header>
    <div className="geo-zoning-source-status" aria-label="Resmî imar sorgusu">
      <b>{eligible ? 'Kastamonu İl Özel İdaresi · konut katmanı sorgusu' : 'Otomatik parsel koşulları henüz alınmadı'}</b>
      <p role="status">{loading ? 'Parsel için resmî kaynak sorgulanıyor…' : eligible ? notice || 'Parsel sorgusu bekleniyor.' : identity.province === 'Kastamonu' ? 'Resmî il, ilçe, mahalle ve ada/parsel seçimini tamamlayın. Belediye ve İl Özel İdaresi kapsamını aşağıdan inceleyin.' : 'Bu bölge için otomatik koşul okuma bağlantısı yok. Aşağıdaki resmî ekrandan parseli sorgulayın ve sonucu belge olarak ekleyin.'}</p>
      {result && assessment.matching && <small>Son parsel sorgusu: {new Date(result.retrievedAt).toLocaleString('tr-TR')} · {assessment.fresh ? 'Son 24 saat içinde sorgulandı; planın yürürlüğü ayrıca incelenmeli.' : 'Kayıt eski veya tarihi geçersiz; yeniden sorgulama gerekli.'}</small>}
      {eligible && <button type="button" disabled={loading} onClick={onQuery}>{loading ? 'Sorgulanıyor…' : 'Parsel koşullarını yeniden sorgula'}</button>}
      {assessment.fresh && result?.status === 'not-found' && <p><b>İmarsız olduğu sonucu çıkarılamaz.</b> Konut dışı kullanım, köy yerleşik alanı, yetkili belediye ve plan notları için diğer kaynaklardan devam edin.</p>}
    </div>
    <details className="geo-imar-sources"><summary>Resmî kaynaklar ve erişim</summary>
      <p>Kaynak kapsamını incelemek proje parselini değiştirmez. Bağlantı kontrolü yalnız sayfa/servis erişimini sınar.</p>
      <div className="geo-field-grid">
        <label>Kaynak kapsamı<select value={catalogProvince} onChange={e=>changeCatalog(e.target.value)}><option value="">İl seçin</option><option>Kastamonu</option><option>Sakarya</option>{catalogProvince && !['Kastamonu','Sakarya'].includes(catalogProvince) && <option>{catalogProvince}</option>}</select></label>
        {catalogProvince === 'Sakarya' && <label>Kaynak ilçesi<select value={catalogDistrict} onChange={e=>changeCatalog(catalogProvince,e.target.value)}><option value="">Mevcut ilçe bağlantılarının tümü</option><option>Adapazarı</option><option>Serdivan</option><option>Sapanca</option>{catalogDistrict && !['Adapazarı','Serdivan','Sapanca'].includes(catalogDistrict) && <option>{catalogDistrict}</option>}</select></label>}
      </div>
      {catalogProvince === 'Sakarya' && <p>İlçe bağlantıları: Adapazarı, Serdivan, Sapanca. Diğer ilçelerde doğrudan bağlantı henüz eklenmedi; Büyükşehir ve e-Plan ile araştırmayı başlatın.</p>}
      <button type="button" disabled={busy || !['Kastamonu','Sakarya'].includes(catalogProvince)} onClick={checkAccess}>{busy ? 'Kaynak erişimleri kontrol ediliyor…' : 'Kaynaklara erişimi kontrol et'}</button>
      {error && <p role="alert">{error}</p>}
      <div className="geo-imar-source-list">{sources.map(source => {
        const check = activeReport?.sources.find(s=>s.id===source.id);
        return <article key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a><small>{source.authority} · {methodLabel[source.method]}</small><p>{source.purpose}</p><p>{source.limitation}</p><small>Bağlantı kataloğu kontrolü: {source.catalogCheckedAt} · parsel doğrulaması değildir</small><p role="status"><b>{check ? accessLabel[check.status] : 'Canlı erişim kontrol edilmedi'}</b>{check && <> · {new Date(check.checkedAt).toLocaleString('tr-TR')}<br/>{check.message}</>}</p></article>;
      })}</div>
    </details>
    <details><summary>Koşul karşılaştırması · {assessment.available}/8 kaynak değeri{assessment.conflicts ? ` · ${assessment.conflicts} fark var` : ''}</summary>
      <div className="geo-imar-table-wrap"><table><caption>Projeye girilmiş bilgi ile güncel parsel kaydı karşılaştırması</caption><thead><tr><th>Koşul</th><th>Projede girilen</th><th>Kaynakta okunan</th><th>Durum</th></tr></thead><tbody>{assessment.fields.map(field=><tr key={field.key} data-conflict={field.status==='conflict'}><th scope="row">{field.label}</th><td>{field.current ?? 'Girilmedi'}</td><td>{field.value ?? 'Alınamadı'}</td><td>{field.status==='conflict' ? 'Fark var · inceleyin' : field.status==='source-read' ? 'Kaynakta okundu · onay değil' : 'Kaynak kanıtı eksik'}</td></tr>)}</tbody></table></div>
      <p>Eksik değerler sıfır kabul edilmez. Farklı kaynaklardaki değerler ortalanmaz. 1/5000 plan, 1/1000 uygulama koşulu yerine kullanılmaz.</p>
      {assessment.available > 0 && result?.source && <p>Dayanak: {result.source.authority} · {result.source.planId} · {result.source.planScale} · kaynak onay tarihi {result.source.approvalDate}. Plan notu ve sonraki değişiklikler ayrıca incelenmeli.</p>}
    </details>
    <p><b>Sonraki adım:</b> Resmî ekrandan tam mahalle–ada/parsel eşleşmesini kontrol edin. İmar durumunu, 1/1000 planı ve plan notlarını alın; aşağıdaki “Belge ve notlar” bölümüne ekleyin. Kaynakla uyuşmayan alanları uzman incelemesinde çözün.</p>
    <button type="button" onClick={downloadResearch}>İmar araştırma kaydını indir</button>
  </section>;
}
