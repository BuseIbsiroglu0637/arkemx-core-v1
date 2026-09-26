import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Teknik Altyapı | GIS, BIM, CDE ve Dijital Proje Standartları",
  description: "Arkem dijital platformunun parsel, GIS, BIM, CAD, CDE, 4B/5B, gerçeklik yakalama, güvenlik ve dijital teslim veri mimarisi.",
  alternates: { canonical: "/teknik-altyapi" },
};

const layers = [
  { no: "01", title: "Geo / parsel", input: "Ada-parsel, WGS84, KML, GeoJSON, CSV, SHP, LandXML", engine: "CRS dönüşümü · poligon · topoğrafya · 3B terrain", output: "Aplikasyon altlığı · yerleşim · KML · DXF · PDF", state: "CANLI + BAĞLANTI" },
  { no: "02", title: "Tasarım / BIM", input: "Brief, aks, kot, yük, sistem, disiplin modelleri", engine: "IFC koordinasyonu · BCF · çakışma · IDS kontrolü", output: "Koordinasyon modeli · pafta · RFI · revizyon", state: "PROJE MODÜLÜ" },
  { no: "03", title: "Planlama / maliyet", input: "WBS, metraj, kaynak, birim fiyat, satın alma", engine: "4B simülasyon · 5B tahmin · kritik yol · senaryo", output: "Baz program · nakit akış · değişiklik etkisi", state: "PROJE OS" },
  { no: "04", title: "Saha / gerçeklik", input: "360°, drone, fotoğraf, nokta bulutu, kalite formu", engine: "Konum + tarih eşleme · ilerleme · tolerans kontrolü", output: "Saha kanıtı · NCR · ilerleme · as-built farkı", state: "PROJE BAĞLANTISI" },
  { no: "05", title: "Teslim / varlık", input: "As-built, ürün verisi, test, garanti, bakım", engine: "Varlık kimliği · veri tamlığı · yapı pasaportu", output: "COBie / varlık seti · bakım planı · dijital arşiv", state: "PROJE OS" },
];

const formatGroups = [
  ["Mekânsal veri", "EPSG:4326 / WGS84", "KML · GeoJSON · CSV", "SHP · GeoTIFF · LandXML", "3D Tiles · LAS/LAZ"],
  ["Model ve koordinasyon", "IFC 4.3", "BCF", "IDS", "GLB / glTF"],
  ["CAD ve pafta", "DXF", "DWG bağlantısı", "PDF / PDF-A", "DWF bağlantısı"],
  ["Proje yönetimi", "CDE revizyon kaydı", "RFI / karar / değişiklik", "WBS / 4B / 5B", "ISO 19650 süreç kurgusu"],
  ["Teslim ve işletme", "COBie veri seti", "Varlık kimliği", "Garanti / bakım", "Dijital yapı pasaportu"],
];

const security = [
  ["Kimlik ve yetki", "Proje, şirket, rol, klasör ve kayıt seviyesinde RBAC; çok faktörlü kimlik doğrulama ve süreli davet."],
  ["Dosya ve aktarım", "Aktarımda TLS, depolamada şifreleme, zararlı dosya taraması, dosya türü/boyut politikası ve süreli imzalı indirme bağlantısı."],
  ["Kayıt izi", "Kim-ne zaman-ne değiştirdi olay günlüğü; silinmeyen revizyon geçmişi, onay durumu ve kaynak doküman bağı."],
  ["Yedek ve süreklilik", "Versiyonlu nesne depolama, günlük yedek, geri yükleme testi, veri saklama süresi ve proje kapatma arşivi."],
  ["Kişisel / proje verisi", "Açık rıza, amaçla sınırlı veri, KVKK politikası, müşteri veri sahipliği ve sözleşme sonunda dışa aktarılabilir paket."],
  ["Mühendislik güvenliği", "Otomatik ve kural tabanlı kontroller kaynak gösterir; uzman onayı olmadan hesap, ruhsat, yıkım veya saha talimatı statüsü kazanmaz."],
];

export default function TechnicalArchitecturePage(){return <main className="inner-page technical-architecture-page">
  <section className="technical-hero"><SiteHeader/><div className="shell"><p className="eyebrow light">Arkem Dijital Omurga / Teknik Mimari</p><h1>Görsel arayüzün altında<br/><em>izlenebilir bir veri zinciri.</em></h1><p>Parsel koordinatından BIM nesnesine, revizyondan saha kanıtına ve yapı pasaportuna kadar her kayıt; formatı, kaynağı, koordinat sistemi, sorumlusu ve onay durumu ile yönetilir.</p><div className="actions"><a className="button copper" href="#veri-zinciri">Veri Zincirini İnceleyin <span>↓</span></a><Link className="button ghost" href="/proje-os">Proje OS’i Açın <span>↗</span></Link></div></div><div className="shell technical-hero-index">{["GIS / PARSEL","OPENBIM","CDE / 4B / 5B","REALITY","ASSET DATA"].map((item,index)=><span key={item}><i>{String(index+1).padStart(2,"0")}</i>{item}</span>)}</div></section>
  <section className="section shell technical-intro"><div><p className="eyebrow">Tek Kaynak Değil, Tek İz</p><h2>Her sistem kendi işini yapar.<br/><em>Arkem bağı kurar.</em></h2></div><p>Tapu/kadastro, harita, ölçme, CAD, BIM, planlama, maliyet ve saha sistemleri birbirinin yerine geçmez. Platform; bu kayıtları ortak proje kimliği, koordinat, revizyon ve karar ilişkisiyle birbirine bağlayan bir entegrasyon katmanı olarak tasarlanır.</p></section>
  <section id="veri-zinciri" className="technical-thread-section"><div className="section shell"><div className="section-heading"><div><p className="eyebrow light">Uçtan Uca Veri Zinciri</p><h2>Beş katman.<br/><em>Tek proje hafızası.</em></h2></div><p>Her katman girdiyi doğrular, işlem kaydını tutar ve bir sonraki disipline açık, sürümlü bir çıktı verir.</p></div><div className="technical-thread">{layers.map((layer)=><article key={layer.no}><span>{layer.no}</span><div><h3>{layer.title}</h3><b>{layer.state}</b></div><p><small>GİRDİ</small>{layer.input}</p><p><small>İŞLEM</small>{layer.engine}</p><p><small>ÇIKTI</small>{layer.output}</p></article>)}</div></div></section>
  <section className="section shell format-dictionary"><div className="section-heading"><div><p className="eyebrow">Teknik Veri Sözlüğü</p><h2>Kapalı kutu değil,<br/><em>açık ve aktarılabilir format.</em></h2></div><p>İşveren verisinin tek bir yazılıma kilitlenmemesi için çekirdek teslimler mümkün olduğunca açık standartlarla eşlenir.</p></div><div className="format-grid">{formatGroups.map(([title,...formats],index)=><article key={title}><span>{String(index+1).padStart(2,"0")}</span><h3>{title}</h3>{formats.map((format)=><p key={format}>{format}</p>)}</article>)}</div></section>
  <section className="connector-status-section"><div className="section shell"><div><p className="eyebrow light">Bağlantı Gerçeklik Tablosu</p><h2>Ne çalışıyor,<br/><em>ne kurulum istiyor?</em></h2></div><div className="connector-status-table"><header><span>YETENEK</span><span>BUGÜN</span><span>PROJEDE GEREKEN</span></header>{[
    ["Parsel poligonu, alan/çevre, yapı yerleşimi", "CANLI", "KML / GeoJSON / CSV veya haritada çizim"],
    ["PDF, DXF, KML, GeoJSON teknik çıktı", "CANLI", "Tarayıcı oturumu"],
    ["3B parametrik arazi + yapı kütlesi", "CANLI", "WebGL; ölçülmüş Z verisi önerilir"],
    ["TKGM kadastro WMS/WFS", "PROTOKOL", "Yetkili kurum anlaşması ve servis erişimi"],
    ["Google Photorealistic 3D Tiles", "API / FATURALAMA", "Google Cloud projesi, anahtar, atıf ve kota"],
    ["Cesium global terrain / özel 3D Tiles", "TOKEN / VERİ", "Cesium ion veya kurum içi tileset"],
    ["Doğrudan DWG üretimi", "LİSANSLI BAĞLANTI", "CAD dönüşüm motoru; bugün DXF teslimi"],
    ["IFC / BCF / CDE proje alanı", "PROJE KURULUMU", "Yetki, klasör, onay akışı ve veri sözleşmesi"],
  ].map(([ability,status,need])=><p key={ability}><b>{ability}</b><span className={status==="CANLI"?"live":""}>{status}</span><small>{need}</small></p>)}</div></div></section>
  <section className="section shell technical-security"><div className="section-heading"><div><p className="eyebrow">Güvenlik ve Yönetişim</p><h2>Teknik veri kadar<br/><em>verinin güveni de tasarlanır.</em></h2></div><p>Canlı müşteri portalına geçiş; yalnız arayüz değil, kimlik, yetki, kayıt izi, veri saklama ve mühendislik sorumluluğu tasarımıdır.</p></div><div className="security-grid">{security.map(([title,copy],index)=><article key={title}><span>{String(index+1).padStart(2,"0")}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
  <section className="technical-sources"><div className="section shell"><p className="eyebrow light">Resmî Bağlantı Kaynakları</p><div className="technical-source-links"><a href="https://www.tkgm.gov.tr/parsel-sorgu" target="_blank" rel="noreferrer"><span>TKGM</span><b>Parsel Sorgu</b><i>↗</i></a><a href="https://www.tkgm.gov.tr/harita-servislerimiz" target="_blank" rel="noreferrer"><span>TKGM</span><b>Harita Servisleri</b><i>↗</i></a><a href="https://developers.google.com/maps/documentation/tile/3d-tiles" target="_blank" rel="noreferrer"><span>GOOGLE</span><b>Photorealistic 3D Tiles</b><i>↗</i></a><a href="https://www.ogc.org/standards/kml/" target="_blank" rel="noreferrer"><span>OGC</span><b>KML Standardı</b><i>↗</i></a><a href="https://cesium.com/platform/" target="_blank" rel="noreferrer"><span>CESIUM</span><b>3B Jeo-uzamsal Platform</b><i>↗</i></a></div></div></section>
  <SiteFooter/>
</main>}
