import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { ZoningIntegrationCenter } from "../components/ZoningIntegrationCenter";

export const metadata: Metadata = {
  title: "Parsel ve İmar Kanıt Merkezi | ARKEMX",
  description: "Parsel kimliği ile imar koşullarını kurum, kaynak bağlantısı, sorgu tarihi, geçerlilik, güven düzeyi ve açık kaynak çatışmasıyla yöneten ARKEMX kanıt merkezi.",
  alternates: { canonical: "/imar-entegrasyon-merkezi" },
};

export default function ZoningIntegrationPage() {
  return <main className="inner-page zoning-integration-page"><section className="zoning-integration-hero"><SiteHeader/><div className="shell"><nav className="breadcrumb"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/arsa-fizibilite-studyosu">Parsel & Arazi</Link><span>/</span><span>İmar Entegrasyonu</span></nav><p className="eyebrow light">ARKEMX / PARSEL VE İMAR KANIT MERKEZİ</p><h1>Parselden plan kararına<br/><em>kanıtlı bir imar zinciri.</em></h1><p>İl, ilçe ve parsel kimliğini; TKGM, e-Plan, yetkili yerel idare ve onaylı imar belgesiyle aynı proje kaydında birleştirin.</p></div></section><section className="section shell"><ZoningIntegrationCenter/></section><SiteFooter/></main>;
}
