import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "../components/SiteChrome";
import { ModuleWorkspaceHeader } from "../components/ModuleWorkspaceHeader";
import { ThreeModelViewer } from "../components/ThreeModelViewer";
import { StructuralDesigner } from "../components/StructuralDesigner";
import { VRExperience } from "../components/VRExperience";
import { AdvancedPlanEditor } from "../components/AdvancedPlanEditor";
import { designs } from "../data/platform";

export const metadata: Metadata={title:"Taşıyıcı Sistem Stüdyosu ve 3B Tasarım | ARKEM",description:"V113 mimari geometrisini kullanarak betonarme, prefabrik betonarme, yapısal çelik, hafif çelik ve karma sistemleri ön boyutlandırma düzeyinde karşılaştırın.",alternates:{canonical:"/tasarim-calismalari"}};

export default function Page(){return <main className="inner-page design-page module-workspace-page">
  <ModuleWorkspaceHeader title="Planınızı ve tasarım seçeneklerini geliştirin" description="Plan ve aks şemasını hazırlayın; ön tasarım seçeneklerini uzmanınıza aktarın. Temsili model ve göstergeler uygulama hesabı değildir." target="plan-editor" />
  <section id="plan-editor" className="plan-editor-section"><div className="section shell"><AdvancedPlanEditor/></div></section>
  <section id="tasiyici-on-tasarim" className="section shell designer-section"><StructuralDesigner/></section>
  
  <section className="shell design-integrated-flow"><a href="/mimari-program-studyosu"><span>01 / MİMARİ PROGRAM</span><b>Mimari program</b><small>Mahal, zon, kullanıcı, kabuk</small><i>↗</i></a><a href="#plan-editor"><span>02 / BIM</span><b>Plan & aks modeli</b><small>Nesne, kat, yük, KM–KR</small><i>↓</i></a><a href="#tasiyici-on-tasarim"><span>03 / STRUCTURAL CONCEPT ENGINE</span><b>Taşıyıcı ön tasarım</b><small>Yük izi, kontrol, metraj</small><i>↓</i></a><a href="/muhendislik-koordinasyon"><span>04 / ICE</span><b>Disiplin koordinasyonu</b><small>Kesit, MEP, zemin, issue</small><i>↗</i></a></section>
  <section className="section shell viewer-section"><div className="section-heading"><div><p className="eyebrow">Etkileşimli Model Alanı</p><h2>Modeli yalnızca izlemeyin,<br/><em>sistemi değiştirin.</em></h2></div><p>Çelik endüstri, hafif çelik konut ve karma sistem modelleri arasında geçiş yapın; fareyle veya dokunarak döndürün, yakınlaştırın ve tam ekranda inceleyin.</p></div><ThreeModelViewer/><div className="viewer-capabilities"><article><span>01</span><h3>Üç sistem senaryosu</h3><p>Farklı taşıyıcı sistemlerin geometrisini aynı etkileşim alanında karşılaştırın.</p></article><article><span>02</span><h3>GLB / GLTF desteği</h3><p>Kendi proje modeliniz tek bir dosya adresiyle görüntüleyiciye eklenebilir.</p></article><article><span>03</span><h3>Mobil ve tam ekran</h3><p>Müşteri modeli telefon, tablet veya bilgisayardan ayrıntılı inceleyebilir.</p></article></div></section>
  
  
  <section id="vr-deneyimi" className="vr-section"><div className="section shell"><div className="section-heading"><div><p className="eyebrow light">VR Tasarım Oturumu</p><h2>Gözlüğü takın.<br/><em>Değişikliği yerinde görün.</em></h2></div><p>Bu hareketli anlatım, VR destekli tasarım oturumunun modelde gezinmeden kayıtlı revizyon kararına kadar nasıl ilerlediğini gösterir.</p></div><VRExperience/><p className="visual-note light">VR çalışma kapsamı, kullanılacak model formatı ve donanım altyapısına göre proje özelinde planlanır.</p></div></section>
  <section className="design-gallery"><div className="section shell"><p className="eyebrow">Tasarım ve Görselleştirme</p><div className="platform-grid">{designs.map((card,index)=><article className="platform-card" key={card.title}><div className="card-visual has-image"><Image src={card.image} width={1400} height={876} sizes="(max-width: 760px) 100vw, 33vw" unoptimized alt={card.imageAlt}/><span>{String(index+1).padStart(2,"0")}</span><b>{card.category}</b></div><div className="card-body"><p className="eyebrow">{card.category}</p><h2>{card.title}</h2><p>{card.description}</p><small>{card.meta}</small><a href="/iletisim">Benzer çalışmayı görüşün <span>↗</span></a></div></article>)}</div></div></section>
  <section className="service-cta"><div className="shell"><p className="eyebrow light">Kendi Modelinizi Ekleyin</p><h2>3B çalışmanızı<br/><em>müşteri deneyimine dönüştürelim.</em></h2><a className="button copper" href="/iletisim">VR / Model Oturumu Talep Edin <span>↗</span></a></div></section>
  <section className="section shell design-manifesto"><div><p className="eyebrow">Karar Tasarımın İçinde</p><h2>Müşteri, tasarımcı ve mühendis<br/><em>aynı modeli konuşur.</em></h2></div><div><p>İki boyutlu paftalarda gözden kaçan ölçek, dolaşım, açıklık ve malzeme kararlarını etkileşimli modele taşıyoruz. Amaç yalnızca etkileyici bir sunum değil; daha erken, daha anlaşılır ve izlenebilir proje kararı üretmek.</p><div className="design-metrics"><span><b>1:1</b> VR mekân algısı</span><span><b>A/B</b> seçenek karşılaştırma</span><span><b>360°</b> model inceleme</span></div></div></section>
  <SiteFooter/>
</main>}
