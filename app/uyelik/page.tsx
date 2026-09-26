import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountSignOutPath, getArkemAccountUser } from "../chatgpt-auth";
import { CustomerWorkspace } from "../components/CustomerWorkspace";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Müşteri Proje Hesabı | ARKEMX",
  description: "ARKEMX müşteri hesabı; bugünün işini, proje özetini, kararları ve dosyaları kullanıcıya özel güvenli çalışma alanında birleştirir.",
  alternates: { canonical: "/uyelik" },
};

export default async function MembershipPage() {
  const user = await getArkemAccountUser();
  if (!user) redirect("/giris");
  return <main className="inner-page membership-page">
    <section className="account-dashboard-hero">
      <SiteHeader/>
      <div className="shell account-dashboard-head">
        <div><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><span>Proje Hesabım</span></nav><p className="eyebrow light">ARKEMX / MÜŞTERİ PROJE HESABI V108</p><h1>Bugünün işi.<br/><em>Tek ve güvenli çalışma alanı.</em></h1><p>Proje özetinizi, açık kararları, görüşmeleri ve dosyaları üç sade bölümde yönetin.</p></div>
        <aside><span>AKTİF OTURUM</span><b>{user.displayName}</b><small>{user.email}</small><Link href="/uyelik/ayarlar">Hesap ve görüşme ayarları ↗</Link><a href={accountSignOutPath("/giris")}>Güvenli çıkış ↗</a></aside>
      </div>
    </section>
    <section id="hesabim" className="section shell account-workspace-section"><CustomerWorkspace displayName={user.displayName} email={user.email}/></section>
    <SiteFooter/>
  </main>;
}
