import type { Metadata } from "next";
import { GeoParcelStudio } from "../components/GeoParcelStudio";
import { SiteIntelligenceStudio } from "../components/SiteIntelligenceStudio";
import { SiteFooter } from "../components/SiteChrome";
import { ModuleWorkspaceHeader } from "../components/ModuleWorkspaceHeader";

export const metadata: Metadata = {
  title: "Arsa Rehberi | Parsel, İmar Kaynağı ve Ön Çalışma",
  description: "Parsel, imar ve topoğrafya verilerinden kaynak durumunu koruyan yapı zarfı ve karşılaştırılabilir kütle alternatifleri üretin.",
  alternates: { canonical: "/arsa-fizibilite-studyosu" },
};

const dataLayers = [
  ["01", "Kadastro ve mülkiyet", "Ada/parsel referansı, resmî sınır ve aplikasyon noktaları. Kamu TKGM ekranı ilk bulma adımıdır; proje sınırı yetkili veriyle doğrulanır.", "TKGM / APLİKASYON"],
  ["02", "Koordinat ve topoğrafya", "WGS84, proje koordinat sistemi, ölçülmüş kotlar, eş yükselti, yol bağlantısı, kazı/dolgu ve istinat girdileri.", "KML · GEOJSON · CSV"],
  ["03", "Planlama ve imar", "TKGM parsel kimliği; e-Plan/TUCBS, belediye e-İmar ekranı ve onaylı imar durumu belgesiyle eşleştirilir. TAKS, KAKS/emsal, Yençok/Hmax, nizam ve çekmeler kaynak statüsüyle tutulur.", "E-PLAN · TUCBS · E-İMAR"],
  ["04", "BIM ve teknik teslim", "Seçilen yerleşimin mimari/statik modele, aplikasyon planına, metraja, 4B programa ve CDE kayıtlarına bağlanması.", "IFC · DXF · PDF · CDE"],
];

export default function SiteStudioPage(){return <main className="inner-page site-studio-page module-workspace-page">
  <ModuleWorkspaceHeader title="Arsanızın bilgilerini ve açık soruları düzenleyin" description="Parsel, imar ve arazi bilgilerini kaynaklarıyla birlikte inceleyin. Haritadaki gösterim resmî sınır veya yapılaşma onayı değildir." target="geo-studyo" />
  
  <section id="geo-studyo" className="geo-studio-live"><div className="shell"><GeoParcelStudio/></div></section>
  <details className="parcel-advanced-guide shell"><summary>Uzman araçları, veri kaynakları ve örnek senaryolar</summary><p>Bu bölüm ek teknik bilgi içindir. Belediye ekranı yönlendirmesi otomatik imar API entegrasyonu değildir; örnek senaryolar aktif parselin yerine geçmez.</p>
  <section id="veri-mimarisi" className="section shell geo-data-architecture"><div className="section-heading"><div><p className="eyebrow">Dört Doğrulama Katmanı</p><h2>Haritadaki şekilden<br/><em>uygulanabilir projeye.</em></h2></div><p>Her veri kendi kaynağı, koordinat sistemi, revizyonu ve onay statüsüyle tutulur; görsel konum ile resmî aplikasyon birbirine karıştırılmaz.</p></div><div className="geo-layer-grid">{dataLayers.map(([no,title,copy,format])=><article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p><b>{format}</b></article>)}</div></section>
  <section className="geo-connector-section"><div className="section shell"><div><p className="eyebrow light">Türkiye İmar Bağlantı Mimarisi</p><h2>Tek ekran,<br/><em>kaynağı belli kararlar.</em></h2><p>Türkiye genelinde tek ve açık bir parsel-imar API’si bulunmadığı için sistem; TKGM parsel kimliğini e-Plan/TUCBS, ilgili belediyenin e-İmar altyapısı ve onaylı imar durumu belgesiyle eşleştirir. Kaynaksız değer “resmî” olarak işaretlenmez.</p></div><div className="geo-connector-matrix">{[["CANLI","TKGM idari seçim ve parsel referansı"],["CANLI","TAKS, KAKS, Hmax, nizam ve çekme kaydı"],["CANLI","İmar kaynağı/plan no/belge adıyla veri kökeni"],["RESMÎ GÖRÜNTÜLEYİCİ","e-Plan ve TUCBS araştırma bağlantıları"],["BELEDİYE ADAPTÖRÜ","İdareye özel e-İmar servis bağlantısı"],["PROTOKOL / YETKİ","TKGM WMS/WFS, TUCBS yetkili katman ve belge doğrulama"]].map(([status,item])=><p key={`${status}-${item}`}><span className={status==="CANLI"?"live":""}>{status}</span><b>{item}</b></p>)}</div></div></section>
  <section className="section shell quick-scenario-intro"><div><p className="eyebrow">Hızlı Senaryo Katmanı</p><h2>Gerçek veri hazır değilse<br/><em>parametrelerle başlayın.</em></h2></div><p>Aşağıdaki ikinci araç, doğrulanmış parsel verisi gelmeden önce genişlik, derinlik, çekme, eğim, kat ve sistem alternatiflerini hızla karşılaştırır. Teknik stüdyodaki gerçek poligonun yerine geçmez.</p></section>
  <section id="hizli-senaryo" className="site-studio-live"><div className="section shell"><SiteIntelligenceStudio/></div></section>
  <section className="section shell tool-method-grid">{[["01","Bul","TKGM kaydını kontrol edin veya WGS84 koordinatla konuma gidin."],["02","Doğrula","e-Plan/TUCBS, belediye e-İmar ve onaylı belge üzerinden imar kaynağını bağlayın."],["03","Tasarla","Yapı ayak izini imar koşullarında döndürün, öteleyin; 2B harita ve 3B arazide inceleyin."],["04","Aktar","PDF pafta, DXF, KML, GeoJSON ve veri kökeni manifestosunu proje ekibine iletin."]].map(([no,title,copy])=><article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p></article>)}</section>
  <section className="section shell tool-page-intro"><div><p className="eyebrow">Konumdan Teknik Karara</p><h2>Parsel yalnızca<br/><em>bir metrekare değildir.</em></h2></div><p>Sınır geometrisi, koordinat sistemi, topoğrafya, yol ve komşuluk, imar koşulları, yapı kütlesi ve taşıyıcı sistem aynı veri zincirinde ele alınır. Böylece “bu yapı buraya sığar mı?” sorusu; ölçülebilir, aktarılabilir ve doğrulanabilir bir ön çalışma haline gelir.</p></section>
  </details><SiteFooter/>
</main>}
