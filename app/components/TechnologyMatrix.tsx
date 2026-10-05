import Image from "next/image";

const capabilities=[
  ["01","Dijital İkiz","Model, saha verisi ve revizyon geçmişini aynı yapı kimliğinde birleştiren proje hafızası."],
  ["02","Çakışma Radarı","Mimari, statik ve MEP kararlarındaki olası çakışmaları uygulamadan önce görünür kılan koordinasyon katmanı."],
  ["03","Karbon Senaryosu","Taşıyıcı sistem alternatiflerini yaklaşık malzeme, karbon, süre ve maliyet ekseninde karşılaştıran karar görünümü."],
  ["04","Saha Zaman Çizgisi","Fotoğraf, video, doküman ve imalat durumunu model elemanlarıyla eşleyen ilerleme arşivi."],
  ["05","VR Karar Odası","Müşterinin yapıyı 1:1 ölçekte deneyimleyip değişiklik noktalarını model üzerinde işaretleyebildiği oturum."],
  ["06","Akıllı Teknik Asistan","Proje girdilerini sınıflandıran, eksik veriyi gösteren ve görüşme öncesi teknik özet oluşturan yardımcı."],
] as const;
export function TechnologyMatrix(){return <section className="technology-matrix"><div className="tech-matrix-visual"><Image src="/visuals/arkem-innovation-lab-v2.png" width={1672} height={941} sizes="(max-width: 760px) 100vw, 1200px" unoptimized alt="Arkem dijital ikiz ve yapısal tasarım teknoloji laboratuvarı"/><div><span>LIVE</span><b>DIGITAL TWIN / PROJECT 01</b></div></div><div className="tech-capability-grid">{capabilities.map(([no,title,copy])=><article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p><i>↗</i></article>)}</div></section>}
