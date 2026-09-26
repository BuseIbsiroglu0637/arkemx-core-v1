import type { Metadata } from "next";
import Link from "next/link";
import { DigitalProjectHub } from "../components/DigitalProjectHub";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "ARKEMX | Prototip Proje Veri Çalışma Alanı",
  description: "Parsel, mimari program, koordinasyon, miktar, program, saha ve teslim verisinin ortak proje kimliğinde ilişkilendirilmesini araştıran ARKEMX geliştirme çalışma alanı.",
  alternates: { canonical: "/dijital-proje-merkezi" },
  robots: { index: false, follow: false },
};

export default function DigitalProjectCenterPage() {
  return <main className="inner-page digital-project-center-page">
    <section className="thread-page-hero"><SiteHeader/><div className="shell"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/arkemx">ARKEMX</Link><span>/</span><span>Prototip Proje Alanı</span></nav><p className="eyebrow light">ARKEMX / GELİŞTİRME PROTOTİPİ</p><h1>Uygulamalar değil.<br/><em>İzlenebilir proje verisi.</em></h1><p>Parsel koordinatından mahal programına, modelden miktar ve saha kaydına kadar farklı veri alanlarının aynı proje kimliğinde nasıl ilişkilendirilebileceğini araştıran prototip çalışma alanı.</p><div className="actions"><Link className="button copper" href="/proje-baslat">Yönlendirmeli Projeyi Başlatın <span>↗</span></Link><a className="button ghost" href="#canli-proje-grafigi">Prototip Veri Grafiğini Açın <span>↓</span></a></div></div><div className="shell thread-hero-strip">{["PIR","GIS","ARC","BIM","MCDA","STR","ICE","BEP","LCA","4D","CDE","AIM","TWIN"].map((item) => <span key={item}>{item}</span>)}</div></section>
    <section className="section shell thread-manifesto"><div><p className="eyebrow">Federatif Veri Yaklaşımı</p><h2>Tek model demek,<br/><em>tek sorumluluk demek değildir.</em></h2></div><div><p>Her disiplin kendi yetkili kaynağını ve hesabını korur. Dijital proje zinciri bu kaynakları tek dosyada eritmek yerine ortak kimlik, koordinat, aşama ve revizyonla birbirine bağlar.</p><p>Böylece bir kat, alan, aks veya sistem kararı değiştiğinde hangi uygulamayı, kontrolü ve teslim çıktısını etkilediği görünür hale gelir.</p></div></section>
    <section id="canli-proje-grafigi" className="thread-live-section"><div className="section shell"><DigitalProjectHub/></div></section>
    <section className="thread-protocol"><div className="section shell"><div><p className="eyebrow light">Veri Protokolü</p><h2>Kaynak belli.<br/><em>Aktarım denetlenebilir.</em></h2></div><div className="thread-protocol-grid">{[["01","KİMLİK","Proje kodu, aşama, revizyon ve koordinat referansı tüm uygulamalarda korunur."],["02","SAHİPLİK","Parseli GIS, programı mimari, yük ve kesiti statik, servis zonunu MEP üretir."],["03","DEVİR TESLİM","Her veri aktarımı hedef modül, içerik ve beklenen karar çıktısıyla tanımlanır."],["04","KURAL","Alan, kat, yükseklik, aks ve sistem çelişkileri otomatik issue kaydına dönüşür."],["05","AÇIK ÇIKTI","JSON, CSV, DXF, GeoJSON ve BCF-benzeri kayıtlarla veri taşınabilir kalır."],["06","SINIR","Ön değerlendirme araçları yetkili proje, onay ve kurumsal CDE yerine geçmez."]].map(([no,title,copy]) => <article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <SiteFooter/>
  </main>;
}
