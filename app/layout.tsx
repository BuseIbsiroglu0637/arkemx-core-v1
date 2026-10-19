import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./demo.css";
import { DemoBanner, DemoContact } from "./components/DemoWorkspace";
import "./v25.css";
import "./v25-apps.css";
import "./v26.css";
import "./v27.css";
import "./v28.css";
import "./v29.css";
import "./v30.css";
import "./v32.css";
import "./v33.css";
import "./v34.css";
import "./v35.css";
import "./v36.css";
import "./v37.css";
import "./v38.css";
import "./v39.css";
import "./v40.css";
import "./v41.css";
import "./v42.css";
import "./v43.css";
import "./v44.css";
import "./v45.css";
import "./v46.css";
import "./v49.css";
import "./v53.css";
import "./v54.css";
import "./v55.css";
import "./v57.css";
import "./v58.css";
import "./v59.css";
import "./v60.css";
import "./v76.css";
import "./v77.css";
import "./v78.css";
import "./v79.css";
import "./v80.css";
import "./v81.css";
import "./v82.css";
import "./v83.css";
import "./v84.css";
import "./v85.css";
import "./v86.css";
import "./v87.css";
import "./v88.css";
import "./v89.css";
import "./v90.css";
import "./v91.css";
import "./v92.css";
import "./v93.css";
import "./v94.css";
import "./v95.css";
import "./v96.css";
import "./v97.css";
import "./v98.css";
import "./v99.css";
import "./v100.css";
import "./v101.css";
import "./v102.css";
import "./v103.css";
import "./v104.css";
import "./v105.css";
import "./v106.css";
import "./v107.css";
import "./v108.css";
import "./v109.css";
import "./v110.css";
import "./v111.css";
import "./v112.css";
import "./v113.css";
import "./v114.css";
import "./v115.css";
import "./v116.css";
import "./responsive.css";
import "./v21.css";
import "./v22.css";
import "./v3.css";
import "./v3c.css";
import "./v3d.css";
import "./v3e.css";
import "./v3-active-modules.css";
import "./v31.css";
import "./v32-acceptance.css";
import "./v37-corporate.css";
import "./v4.css";
import "./v50.css";
import "./v117.css";
import "./v118-system.css";
import "./customer-guide.css";
import "./corporate-system.css";
import "./corporate-navigation.css";
import "./release-polish.css";
import "./digital-tools.css";
import "./module-workspaces.css";
import "./home-experience.css";
import "./parcel-experience.css";
import "./guided-experience.css";
import "./parcel-refinement.css";
import "./reference-presentations.css";
import "./gis-approved-design.css";
import { site } from "./data/site";
import { corporateRegistry } from "./data/corporate-registry";
import { visibleLocaleRecords } from "./data/locale-routes";
import { FloatingContact } from "./components/SiteChrome";
import { ProjectKernelProvider } from "./components/ProjectKernel";
import { LanguageProvider } from "./components/LanguageSystem";
import { V21Analytics } from "./components/V21Analytics";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext", "cyrillic"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext", "cyrillic"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: { default: "ARKEM Yapı Sistemleri | Prefabrik, Çelik, Hafif Çelik ve Yapısal Mühendislik", template: "%s | ARKEM Yapı Sistemleri" },
  description: "ARKEM Yapı Sistemleri; betonarme prefabrik, yapısal çelik, hafif çelik ve hibrit yapı sistemlerinde mühendislik, projelendirme ve uygulama hizmetleri sunar.",
  applicationName: "Arkem Yapı Sistemleri",
  authors: [{ name: "Arkem Yapı Sistemleri" }, { name: "Yüksek İnşaat Mühendisi Özenç Öztürk" }],
  creator: "Arkem Yapı Sistemleri",
  publisher: "Arkem Yapı Sistemleri",
  category: "İnşaat ve Mühendislik",
  keywords: ["betonarme prefabrik", "statik proje", "endüstriyel yapı", "çelik yapı", "hafif çelik", "hibrit yapı sistemi", "yapı mühendisliği", "fabrika projelendirme", "taşıyıcı sistem tasarımı", "uygulama projesi", "imalat çizimleri", "BIM koordinasyonu", "mühendislik yazılımı", "ARKEMX"],
  alternates: {
    canonical: "/",
    languages: Object.fromEntries([
      ...visibleLocaleRecords.map((locale) => [locale.languageTag, locale.id === "tr" ? "/" : `/${locale.id}`]),
      ["x-default", "/"],
    ]),
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", locale: "tr_TR", url: "/", siteName: "ARKEM Yapı Sistemleri", title: "ARKEM Yapı Sistemleri | Prefabrik, Çelik, Hafif Çelik ve Yapısal Mühendislik", description: "Betonarme prefabrik, yapısal çelik, hafif çelik ve hibrit yapı sistemlerinde mühendislik, projelendirme ve uygulama.", images: [{ url: "/arkem-social-share.png", width: 1200, height: 630, alt: "ARKEM Yapı Sistemleri — mühendislikten sahaya" }] },
  twitter: { card: "summary_large_image", title: "ARKEM Yapı Sistemleri | Prefabrik, Çelik, Hafif Çelik ve Yapısal Mühendislik", description: "Betonarme prefabrik, yapısal çelik, hafif çelik ve hibrit yapı sistemlerinde mühendislik, projelendirme ve uygulama.", images: ["/arkem-social-share.png"] },
  icons: { icon: { url: "/favicon-arkem-depth.png", type: "image/png", sizes: "1254x1254" }, shortcut: "/favicon-arkem-depth.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#061a2b",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": ["Organization", "ProfessionalService"],
  inLanguage: "tr-TR",
  name: corporateRegistry.brand.name,
  ...(corporateRegistry.legalEntity.name ? { legalName: corporateRegistry.legalEntity.name } : {}),
  brand: { "@type": "Brand", name: corporateRegistry.brand.name },
  url: site.domain,
  logo: `${site.domain}/brand/arkem-logo-master.svg`,
  image: `${site.domain}/arkem-social-share.png`,
  description: "Betonarme prefabrik, çelik, hafif çelik ve hibrit sistemlerde projelendirme, taşıyıcı sistem mühendisliği, üretim hazırlığı ve saha koordinasyonu sunan ARKEM mühendislik organizasyonu.",
  telephone: site.phoneDisplay,
  ...(site.email ? { email: site.email } : {}),
  address: { "@type": "PostalAddress", streetAddress: "Bahçelievler Mahallesi", addressLocality: "Serdivan", addressRegion: "Sakarya", postalCode: site.postalCode, addressCountry: "TR" },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: site.phoneDisplay,
    contactType: "customer service",
    areaServed: ["TR", "AZ"],
    availableLanguage: visibleLocaleRecords.map((locale) => locale.label),
  },
  areaServed: [{ "@type": "Country", name: "Türkiye" }, { "@type": "Country", name: "Azerbaycan" }],
  founder: { "@type": "Person", name: "Özenç Öztürk", jobTitle: ["Yüksek İnşaat Mühendisi", "Yüksek Patlayıcı Mühendisi"], image: `${site.domain}/ozenc-ozturk.jpg` },
  sameAs: [site.instagram, site.linkedin, site.youtube, site.facebook, site.tiktok, site.threads, site.sketchfab],
  hasOfferCatalog: {
    "@type": "OfferCatalog", name: "Arkem Yapı Sistemleri Hizmetleri",
    itemListElement: [
      { "@type": "OfferCatalog", name: "Projelendirme", itemListElement: ["Mimari proje", "Statik proje", "Ruhsat ve uygulama projeleri"] },
      { "@type": "OfferCatalog", name: "Yapım", itemListElement: ["Hafif çelik yapı", "Çelik yapı", "Betonarme ve prefabrik yapılar"] },
      { "@type": "OfferCatalog", name: "Danışmanlık", itemListElement: ["Fizibilite", "Metraj ve maliyet", "Proje yönetimi", "Teknik kontrollük", "BIM ve dijital proje teslimi", "4B planlama", "Dijital yapı pasaportu"] },
      { "@type": "OfferCatalog", name: "Patlatmalı Bina Yıkımı", itemListElement: ["Yapısal ön inceleme", "Risk ve güvenlik planlaması", "İzin ve uzman koordinasyonu", "Saha uygulama yönetimi"] },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr" suppressHydrationWarning><head><meta name="theme-color" content="#061a2b"/><meta name="google" content="notranslate"/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /></head><body className={`${inter.variable} ${manrope.variable} antialiased arkem-corporate-site`}><LanguageProvider><V21Analytics/><a className="skip-link" href="#main-content">İçeriğe geç</a><ProjectKernelProvider><DemoBanner/><div id="main-content" tabIndex={-1}>{children}</div><DemoContact><FloatingContact/></DemoContact></ProjectKernelProvider></LanguageProvider></body></html>;
}
