"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, Building2, FolderOpen, Check, FileText } from "lucide-react";
import { DigitalToolsWorkspace } from "./DigitalToolsWorkspace";

export function DigitalJourneyGateway() {
  const [briefOpen, setBriefOpen] = useState(false);
  if (briefOpen) return <><div className="shell journey-back"><button type="button" onClick={() => setBriefOpen(false)}>Başlangıç seçeneklerine dön</button><span>İhtiyaç dosyası / Ön görüşme hazırlığı</span></div><DigitalToolsWorkspace initialGoal="new" /></>;
  return <div className="shell journey-gateway">
    <header className="journey-gateway-header"><span>ARKEM / PROJE REHBERİNİZ</span><h1>Bugün hangi adımı<br />birlikte atalım?</h1><p>İhtiyacınızı seçin. Sizi doğru çalışma alanına götürelim; her adımda ne yapacağınız ve sonunda ne elde edeceğiniz belli olsun.</p></header>
    <nav className="journey-intents" aria-label="Projeniz için üç başlangıç yolu">
      <Link href="/arsa-fizibilite-studyosu"><MapPin size={29} strokeWidth={1.6} aria-hidden="true" /><strong>Arsamı değerlendireceğim</strong><p>Parselinizi bulun, sınırını görün, belediye imar kaynağını ve belgenizi projeye bağlayın.</p><small>Sonuç: Parsel ve imar ön çalışma dosyası</small></Link>
      <Link href="/proje-baslat"><Building2 size={29} strokeWidth={1.6} aria-hidden="true" /><strong>Yapımı planlayacağım</strong><p>Nasıl bir yapı istediğinizi anlatın. İhtiyaçlarınızdan kişisel proje yol haritanıza ilerleyin.</p><small>Sonuç: İhtiyaç özeti ve sıradaki proje adımı</small></Link>
      <Link href="/musteri-proje-portali"><FolderOpen size={29} strokeWidth={1.6} aria-hidden="true" /><strong>Projeme devam edeceğim</strong><p>Kayıtlı projenizi açın. Dosyalarınızı, bekleyen kararları ve sıradaki işi birlikte görün.</p><small>Sonuç: Kaldığınız yerden devam</small></Link>
    </nav>
    <div className="journey-deliverables"><span><Check size={17} aria-hidden="true" />Teknik terim bilmeniz gerekmez</span><span><Check size={17} aria-hidden="true" />Ayrıntılar ilgili adımda açılır</span><span><Check size={17} aria-hidden="true" />Kaydetme ve gönderim durumu görünür</span></div>
    <div className="journey-support"><p>Nereden başlayacağınız henüz belli değil mi?</p><button className="digital-secondary" type="button" onClick={() => setBriefOpen(true)}><FileText size={17} aria-hidden="true" />Kısa bir ihtiyaç dosyası hazırlayalım</button><p>Birlikte değerlendirmek için <Link href="/iletisim">ARKEM ile görüşün</Link>.</p></div>
  </div>;
}
