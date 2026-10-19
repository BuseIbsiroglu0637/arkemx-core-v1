"use client";

import Link from 'next/link';
import { useState } from 'react';
import { resolveZoningPortal, createEGovernmentZoningSearch } from '../data/zoning-authorities';
import type { ParcelIdentity } from '../lib/parcel-record';
import { ProjectBriefForm } from './ProjectBriefForm';
import { useProjectKernel } from './ProjectKernel';

export function ParcelZoningGuide({ identity, eligible }: { identity: ParcelIdentity; eligible: boolean }) {
  const { project, patchModule } = useProjectKernel();
  const [openSubmission, setOpenSubmission] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const portal = resolveZoningPortal(identity.province, identity.district, identity.neighborhood);
  const reference = [identity.province, identity.district, identity.neighborhood, identity.block && `Ada ${identity.block}`, identity.parcelNo && `Parsel ${identity.parcelNo}`].filter(Boolean).join(' / ');
  const recorded = project.modules['parcel-zoning-intake'] as { reference?: string; targetIdentity?: ParcelIdentity } | undefined;
  const summary = `İmar kaynağı / belge ön inceleme talebi\nHedef parsel (müşteri beyanı): ${reference}\nKaynak: ${portal?.href ?? 'Yetkili idare belirlenecek'}\nYüklenen belgenin bu parsele aidiyeti, güncelliği, plan notları ve resmî statüsü uzman tarafından incelenmelidir. Belge yüklenmesi imar hakkı veya teknik onay oluşturmaz.\nLütfen kişisel malik veya kimlik verisi içermeyen imar belgesini ekleyin.`;
  return <section className="parcel-zoning-guide" aria-label="İmar belgesini projeye bağlama rehberi">
    <p className="parcel-kicker">03 / KAYNAĞI BELLİ İMAR</p>
    <h3>Önce doğru belediye. Sonra doğru belge.</h3>
    <p>Belediye ekranındaki ön bilgi ile belediyeden alınan resmî belge aynı şey değildir. Bu uygulama belediye adına belge düzenlemez ve otomatik imar onayı vermez.</p>
    <ol className="parcel-source-steps">
      <li><span>01</span><div><b>{portal?.authority ?? 'Yetkili yerel idare'}</b><small>{portal ? 'Resmî kaynağa yönlendirme · otomatik veri bağlantısı değil' : 'Bu bölge için doğrulanmış belediye kaynağı henüz yok'}</small><a href={portal?.href ?? createEGovernmentZoningSearch(identity.province, identity.district)} target="_blank" rel="noreferrer">{portal ? 'Belediyenin resmî kaynağını aç ↗' : 'Resmî belediye hizmetini bul ↗'}</a>{portal && <small>Bağlantı kontrolü: {portal.verifiedAt}. Parsel koşulları ayrıca sorgulanmalıdır.</small>}{portal?.verification && <details><summary>Kaynak kontrolünün kapsamı</summary><p>{portal.verification}</p>{portal.sourcePage && <a href={portal.sourcePage} target="_blank" rel="noreferrer">Belediyenin kaynak sayfası ↗</a>}</details>}</div></li>
      <li><span>02</span><div><b>Aynı parseli sorgulayın</b><p className="parcel-reference">{reference || 'Parsel kimliği bekleniyor'}</p><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(reference); setCopyStatus('Parsel kimliği kopyalandı.'); } catch { setCopyStatus('Kopyalama kullanılamıyor; yukarıdaki kimliği belediye ekranına yazın.'); } }}>Parsel kimliğini kopyala</button><small role="status">{copyStatus}</small><small>{portal?.limitation ?? 'Belediye, plan ve belge kapsamı ilgili idareden kontrol edilmelidir.'}</small></div></li>
      <li><span>03</span><div><b>Belgeyi incelemeye bağlayın</b><small>Resmî imar durumu, plan notları ve tarihi birlikte değerlendirilir. Başvuru başarılı olursa dosyalar saklanır ve bir takip numarası oluşur; bu numara teknik onay değildir.</small><button type="button" disabled={!eligible} aria-expanded={openSubmission} aria-controls="parcel-zoning-submit" onClick={() => setOpenSubmission(value => !value)}>{eligible ? openSubmission ? 'Belge başvurusunu kapat' : 'İmar belgesiyle inceleme başlat' : 'Önce konum ve ada / parsel bilgilerini tamamlayın'}</button></div></li>
    </ol>
    {recorded?.reference && <p className="parcel-receipt">Önceki belge başvuru referansı: {recorded.reference}. İlgili parseli, başvuru kaydından kontrol edin; yeni seçim bu belgeyi yeniden doğrulamaz.</p>}
    {openSubmission && eligible && <div id="parcel-zoning-submit"><ProjectBriefForm compact key={`${project.id}:${reference}`} prefill={{ location: `${identity.province} / ${identity.district}`, requestType: 'Teknik danışmanlık', stage: 'Fikir aşaması' }} projectSummary={summary} onProjectSubmitted={(receipt) => patchModule('parcel-zoning-intake', { reference: receipt, targetIdentity: { ...identity }, recordedAt: new Date().toISOString(), needsReview: true, authoritative: false })} /></div>}
    <div className="parcel-review-option"><div><span>İSTEĞE BAĞLI / ÜCRETLİ İNCELEME</span><b>Yetkili tapu ve hissedarlık incelemesi</b><p>Malik veya geçerli temsil yetkisi olan başvuru sahibi için kapsam görüşmesi. Açık parsel sorgusundan malik listesi satılmaz; yetki ve resmî erişim doğrulanmadan kişisel kayıt sunulmaz.</p><small>Ücret, kapsam ve teslim yöntemi ayrıca onaylanır. Bu ekrandan ödeme alınmaz.</small></div><Link href="/parsel-uzman-inceleme">Yetkili inceleme seçeneğini gör →</Link></div>
  </section>;
}
