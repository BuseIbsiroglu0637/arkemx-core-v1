import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountSignInPath, accountSignOutPath } from "../../chatgpt-auth";
import { ProjectEvidenceCenter } from "../../components/ProjectEvidenceCenter";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { v3Projects } from "../../data/projects-v3";
import { getProjectCmsAuthorization } from "../../lib/project-cms-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Proje Kanıt Merkezi | ARKEM",
  description: "ARKEM proje kanıtlarının kontrollü inceleme ve yayın alanı.",
  robots: { index: false, follow: false },
};

export default async function ProjectEvidencePage() {
  const auth = await getProjectCmsAuthorization();
  if (auth.status === "unauthenticated") redirect(accountSignInPath("/uyelik/proje-kanitlari"));

  if (auth.status === "forbidden") return <main className="inner-page v3c-cms-page">
    <section className="v3c-cms-hero"><SiteHeader/><div className="shell"><p className="v21-index">ARKEM / KORUMALI İÇERİK ALANI</p><h1>Bu alan yalnız<br/><em>proje içerik yetkilisine açık.</em></h1><p>Oturumunuz doğrulandı ancak proje kanıtlarını düzenleme yetkiniz bulunmuyor.</p><Link className="v21-button v21-button-copper" href="/hesabim">Hesabıma dönün</Link></div></section><SiteFooter/>
  </main>;

  return <main className="inner-page v3c-cms-page">
    <section className="v3c-cms-hero">
      <SiteHeader/>
      <div className="shell v3c-cms-hero-grid"><div><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/hesabim">Hesabım</Link><span>/</span><span>Proje Kanıtları</span></nav><p className="v21-index">ARKEM / PROJE KANIT MERKEZİ</p><h1>Gerçek projeyi<br/><em>kanıtıyla yönetin.</em></h1><p>Belge ve medya dosyalarını proje bilgisine bağlayın. Bir kayıt ancak inceleme ve doğrulama aşamalarından sonra kamu sayfasına aktarılır.</p></div><aside><span>YETKİLİ OTURUM</span><strong>{auth.user.displayName}</strong><small>{auth.user.email}</small><b>YAYIN YETKİSİ DOĞRULANDI</b><a href={accountSignOutPath("/giris")}>Güvenli çıkış ↗</a></aside></div>
    </section>
    <section className="v3c-cms-body shell"><ProjectEvidenceCenter projects={v3Projects.map(({ slug, code, title }) => ({ slug, code, title }))}/></section>
    <SiteFooter/>
  </main>;
}
