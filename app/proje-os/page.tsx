import type { Metadata } from "next";
import { ProjectOperatingSystem } from "../components/ProjectOperatingSystem";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Arkem Proje OS 2.0 | RFI, Revizyon ve Şantiye Yönetimi",
  description: "Görev, RFI, karar, revizyon, 4B program, bütçe, kalite, tedarik ve dijital teslimi kaynak, sorumlu ve hedef tarih iziyle birleştiren Arkem Proje OS 2.0.",
  alternates: { canonical: "/proje-os" },
};

const capabilities = [
  ["01", "Tek proje hafızası", "Brief, model, doküman, karar, saha kaydı ve teslim verisini aynı kimlik zincirinde toplar."],
  ["02", "Görev ve sorumluluk", "V115 koordinasyon issue’larını kaynak GUID’i, sorumlu, hedef tarih ve etki kaydıyla işe dönüştürür."],
  ["03", "4B dijital prova", "İş programını model elemanlarıyla bağlayarak yapım sırasını sahadan önce görünür kılar."],
  ["04", "Kontrollü doküman", "Çalışma, inceleme ve yayımlama durumlarını revizyon geçmişiyle birbirinden ayırır."],
  ["05", "Karar ve RFI izi", "Sorunun kaynağı, sorumlusu, maliyet/süre etkisi ve kapanış kanıtını tek kayıtta tutar."],
  ["06", "Revizyon kaydı", "Güncel bilgiyle eski ve yerine geçen dokümanı açıkça ayırarak yanlış kullanım riskini azaltır."],
  ["07", "Bütçe erken uyarısı", "Değişiklikleri baz bütçe, nakit akışı ve tamamlanma tahminiyle birlikte okur."],
  ["08", "360° gerçeklik", "Saha görüntüsünü tarih, konum, model ve kalite kaydıyla eşleştirir."],
  ["09", "Tedarik kontrol kulesi", "Uzun terminli paketleri teknik onay ve kritik yol tarihleriyle birlikte izler."],
  ["10", "Dijital teslim", "As-built model, ürün verisi, garanti, bakım ve varlık pasaportunu işletmeye aktarır."],
];

export default function ProjectOsPage() {
  return <main className="inner-page os-page">
    <section className="os-page-hero"><SiteHeader/><div className="shell os-page-hero-copy"><p className="eyebrow light">ARKEMX / Dijital Proje Teslimi</p><h1>Proje yönetimi değil.<br/><em>Projenin işletim sistemi.</em></h1><p>Tasarım, program, doküman, karar, bütçe, saha, tedarik ve teslim verisini birbirinden kopuk dosyalar olmaktan çıkaran dijital proje omurgası.</p><div className="actions"><a className="button copper" href="#canli-demo">Canlı Demoyu Açın <span>↓</span></a><a className="button ghost" href="/iletisim">Projeniz İçin Görüşün <span>↗</span></a></div></div><div className="shell os-hero-strip">{["CDE","OPENBIM","4B","COST","RFI","360°","SUPPLY","ASSET DATA"].map((item)=><span key={item}>{item}</span>)}</div></section>
    <section className="section shell os-intro"><div><p className="eyebrow">Parçalı Süreçten Tek Veri Zincirine</p><h2>Doğru bilgi,<br/><em>doğru anda.</em></h2></div><div><p>Arkem Proje OS; yeni bir yazılım satın alma vaadinden önce, projede hangi verinin kim tarafından üretileceğini, nasıl onaylanacağını ve hangi kararı besleyeceğini tanımlar.</p><p>Canlı prototip, işveren ve proje ekiplerinin tek ekranda görebileceği omurgayı gösterir. Gerçek uygulama; proje ölçeği, kullanıcı rolleri ve mevcut yazılımlara göre yapılandırılır.</p></div></section>
    <section className="os-capability-section"><div className="section shell"><div className="section-heading"><div><p className="eyebrow light">On Bağlı Modül</p><h2>Dosya aramayın.<br/><em>Kararı yönetin.</em></h2></div><p>Her modül tek başına çalışabilir; asıl değer, aynı proje kimliği ve denetlenebilir kayıt zinciriyle bağlandığında oluşur.</p></div><div className="os-capability-grid">{capabilities.map(([no,title,copy])=><article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <section id="proje-os-motoru" className="os-live-section"><div className="section shell"><div className="section-heading"><div><p className="eyebrow">V116 / Etkileşimli Proje OS 2.0</p><h2>Issue’dan teslimata<br/><em>aynı iz üzerinde ilerleyin.</em></h2></div><p>Görevleri sorumlusuyla izleyin; V115 koordinasyon kaydını RFI’a dönüştürün, revizyonu ayırın, program ve bütçe etkisini aynı proje kaydında görün.</p></div><ProjectOperatingSystem/></div></section>
    <section className="os-implementation"><div className="section shell"><div><p className="eyebrow light">Kurulum Mimarisi</p><h2>Önce süreç.<br/><em>Sonra teknoloji.</em></h2></div><div className="os-implementation-grid"><article><span>01 / TEMEL</span><h3>Proje protokolü ve veri sözlüğü</h3><p>Rol, onay, isimlendirme, revizyon, teslim seviyesi ve karar kayıt standardı.</p><b>Ortak veri ortamı + doküman + karar</b></article><article><span>02 / BAĞLI</span><h3>Model, program ve saha eşlemesi</h3><p>BIM elemanları, 4B program, 360° gerçeklik ve kalite kayıtlarının ortak koordinat sistemi.</p><b>Açık BIM + 4B + saha gerçekliği</b></article><article><span>03 / YAŞAYAN</span><h3>Analitik, otomasyon ve dijital ikiz</h3><p>Gerçek veri sağlandığında risk sinyalleri, varlık pasaportu, sensör ve işletme entegrasyonu.</p><b>Kural tabanlı kontrol + varlık verisi + dijital ikiz</b></article></div></div></section>
    <SiteFooter/>
  </main>;
}
