import type { Metadata } from "next";
import { GeoParcelStudio } from "../components/GeoParcelStudio";
import { SiteIntelligenceStudio } from "../components/SiteIntelligenceStudio";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "İmar Uyumlu Kütle Motoru | Parsel, Yapı Zarfı ve 3B Arazi",
  description: "Parsel, imar ve topoğrafya verilerinden kaynak durumunu koruyan yapı zarfı ve karşılaştırılabilir kütle alternatifleri üretin.",
  alternates: { canonical: "/arsa-fizibilite-studyosu" },
};

const dataLayers = [
  ["01", "Kadastro ve mülkiyet", "Ada/parsel referansı, resmî sınır ve aplikasyon noktaları. Kamu TKGM ekranı ilk bulma adımıdır; proje sınırı yetkili veriyle doğrulanır.", "TKGM / APLİKASYON"],
  ["02", "Koordinat ve topoğrafya", "WGS84, proje koordinat sistemi, ölçülmüş kotlar, eş yükselti, yol bağlantısı, kazı/dolgu ve istinat girdileri.", "KML · GEOJSON · CSV"],
  ["03", "Planlama ve imar", "TKGM parsel kimliği; e-Plan/TUCBS, belediye e-İmar ekranı ve onaylı imar durumu belgesiyle eşleştirilir. TAKS, KAKS/emsal, Yençok/Hmax, nizam ve çekmeler kaynak statüsüyle tutulur.", "E-PLAN · TUCBS · E-İMAR"],
  ["04", "BIM ve teknik teslim", "Seçilen yerleşimin mimari/statik modele, aplikasyon planına, metraja, 4B programa ve CDE kayıtlarına bağlanması.", "IFC · DXF · PDF · CDE"],
];

export default function SiteStudioPage(){return <main className="inner-page site-studio-page">
  <section className="tool-page-hero site-tool-hero geo-page-hero"><SiteHeader/><div className="shell"><p className="eyebrow light">ARKEMX / V112 İmar Uyumlu Kütle Motoru</p><h1>Parsel hakkını<br/><em>açıklanabilir kütleye dönüştürün.</em></h1><p>Parsel sınırı, yol cephesi, çekmeler, TAKS, KAKS ve Hmax verilerini aynı kaynak zincirinde birleştirin; maksimum taban, dengeli ve kompakt yapı alternatiflerini 2B harita ile 3B arazide karşılaştırın.</p><div className="actions"><a className="button copper" href="#geo-studyo">Kütle Motorunu Açın <span>↓</span></a><a className="button ghost" href="#veri-mimarisi">Veri Mimarisini İnceleyin <span>↘</span></a></div></div><div className="shell geo-hero-flow">{["PARSEL / TKGM","İMAR / KANIT","YAPI ZARFI","KÜTLE / 3B","TEKNİK ÇIKTI"].map((item,index)=><span key={item}><i>{String(index+1).padStart(2,"0")}</i>{item}</span>)}</div></section>
  <section className="section shell tool-page-intro"><div><p className="eyebrow">Konumdan Teknik Karara</p><h2>Parsel yalnızca<br/><em>bir metrekare değildir.</em></h2></div><p>Sınır geometrisi, koordinat sistemi, topoğrafya, yol ve komşuluk, imar koşulları, yapı kütlesi ve taşıyıcı sistem aynı veri zincirinde ele alınır. Böylece “bu yapı buraya sığar mı?” sorusu; ölçülebilir, aktarılabilir ve doğrulanabilir bir ön çalışma haline gelir.</p></section>
  <section id="geo-studyo" className="geo-studio-live"><div className="shell"><GeoParcelStudio/></div></section>
  <section id="veri-mimarisi" className="section shell geo-data-architecture"><div className="section-heading"><div><p className="eyebrow">Dört Doğrulama Katmanı</p><h2>Haritadaki şekilden<br/><em>uygulanabilir projeye.</em></h2></div><p>Her veri kendi kaynağı, koordinat sistemi, revizyonu ve onay statüsüyle tutulur; görsel konum ile resmî aplikasyon birbirine karıştırılmaz.</p></div><div className="geo-layer-grid">{dataLayers.map(([no,title,copy,format])=><article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p><b>{format}</b></article>)}</div></section>
  <section className="geo-connector-section"><div className="section shell"><div><p className="eyebrow light">Türkiye İmar Bağlantı Mimarisi</p><h2>Tek ekran,<br/><em>kaynağı belli kararlar.</em></h2><p>Türkiye genelinde tek ve açık bir parsel-imar API’si bulunmadığı için sistem; TKGM parsel kimliğini e-Plan/TUCBS, ilgili belediyenin e-İmar altyapısı ve onaylı imar durumu belgesiyle eşleştirir. Kaynaksız değer “resmî” olarak işaretlenmez.</p></div><div className="geo-connector-matrix">{[["CANLI","TKGM idari seçim ve parsel referansı"],["CANLI","TAKS, KAKS, Hmax, nizam ve çekme kaydı"],["CANLI","İmar kaynağı/plan no/belge adıyla veri kökeni"],["RESMÎ GÖRÜNTÜLEYİCİ","e-Plan ve TUCBS araştırma bağlantıları"],["BELEDİYE ADAPTÖRÜ","İdareye özel e-İmar servis bağlantısı"],["PROTOKOL / YETKİ","TKGM WMS/WFS, TUCBS yetkili katman ve belge doğrulama"]].map(([status,item])=><p key={`${status}-${item}`}><span className={status==="CANLI"?"live":""}>{status}</span><b>{item}</b></p>)}</div></div></section>
  <section className="section shell quick-scenario-intro"><div><p className="eyebrow">Hızlı Senaryo Katmanı</p><h2>Gerçek veri hazır değilse<br/><em>parametrelerle başlayın.</em></h2></div><p>Aşağıdaki ikinci araç, doğrulanmış parsel verisi gelmeden önce genişlik, derinlik, çekme, eğim, kat ve sistem alternatiflerini hızla karşılaştırır. Teknik stüdyodaki gerçek poligonun yerine geçmez.</p></section>
  <section id="hizli-senaryo" className="site-studio-live"><div className="section shell"><SiteIntelligenceStudio/></div></section>
  <section className="section shell tool-method-grid">{[["01","Bul","TKGM kaydını kontrol edin veya WGS84 koordinatla konuma gidin."],["02","Doğrula","e-Plan/TUCBS, belediye e-İmar ve onaylı belge üzerinden imar kaynağını bağlayın."],["03","Tasarla","Yapı ayak izini imar koşullarında döndürün, öteleyin; 2B harita ve 3B arazide inceleyin."],["04","Aktar","PDF pafta, DXF, KML, GeoJSON ve veri kökeni manifestosunu proje ekibine iletin."]].map(([no,title,copy])=><article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p></article>)}</section>
  <SiteFooter/>
</main>}
