import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountSignOutPath, getArkemAccountUser } from "../../chatgpt-auth";
import { ClientAccountSettings } from "../../components/ClientAccountSettings";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { isProjectCmsEditor } from "../../lib/project-cms-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hesap ve Görüşme Ayarları | ARKEMX",
  description: "ARKEMX hesap profili, kayıtlı projeler, teknik görüşmeler ve işlem geçmişi.",
  alternates: { canonical: "/uyelik/ayarlar" },
};

export default async function AccountSettingsPage() {
  const user = await getArkemAccountUser();
  if (!user) redirect("/giris");
  const cmsEditor = await isProjectCmsEditor(user);
  return <main className="inner-page membership-page">
    <section className="account-dashboard-hero v108-account-settings-hero">
      <SiteHeader/>
      <div className="shell account-dashboard-head">
        <div>
          <nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/uyelik">Proje Hesabım</Link><span>/</span><span>Hesap Ayarları</span></nav>
          <p className="eyebrow light">ARKEMX / HESAP VE GÖRÜŞME AYARLARI</p>
          <h1>Profil, görüşme ve<br/><em>hesap geçmişi.</em></h1>
          <p>Ana müşteri portalını sade tutarken kurumsal profilinizi, görüşme kayıtlarını ve hesap hareketlerini bu ikinci seviyede yönetin.</p>
        </div>
        <aside><span>AKTİF OTURUM</span><b>{user.displayName}</b><small>{user.email}</small>{cmsEditor && <Link href="/uyelik/proje-kanitlari">Proje kanıt merkezini açın ↗</Link>}<Link href="/uyelik">Müşteri portalına dönün ↗</Link><a href={accountSignOutPath("/giris")}>Güvenli çıkış ↗</a></aside>
      </div>
    </section>
    <section className="section shell account-workspace-section"><ClientAccountSettings displayName={user.displayName} email={user.email}/></section>
    <SiteFooter/>
  </main>;
}
