import type { Metadata } from "next";
import Link from "next/link";
import { getArkemAccountUser } from "../chatgpt-auth";
import { AccountOnboarding } from "../components/AccountOnboarding";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yeni Müşteri Hesabı | ARKEMX",
  description: "ARKEMX proje çalışma alanınızı oluşturun; projelerinizi, görüşmelerinizi ve revizyon geçmişinizi hesabınızda saklayın.",
  alternates: { canonical: "/kayit" },
};

export default async function RegisterPage() {
  const user = await getArkemAccountUser();
  return <main className="inner-page account-page">
    <section className="account-shell registration">
      <SiteHeader/>
      <div className="shell account-layout">
        <div className="account-story"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><span>Yeni Hesap</span></nav><p className="eyebrow light">ARKEMX / YENİ MÜŞTERİ HESABI</p><h1>Projeniz için<br/><em>kalıcı bir çalışma alanı.</em></h1><p>Tek proje kimliği; parselden mimariye, taşıyıcı sistemden koordinasyon ve teknik teslimlere kadar bütün karar geçmişinizi birbirine bağlar.</p><dl><div><dt>01</dt><dd><b>Kimliğinizi doğrulayın</b><small>Güvenli oturum oluşturun.</small></dd></div><div><dt>02</dt><dd><b>Profilinizi tamamlayın</b><small>Firma ve iletişim bilgilerinizi ekleyin.</small></dd></div><div><dt>03</dt><dd><b>Projeyi kaydedin</b><small>ARKEMX çalışma verisini hesabınıza alın.</small></dd></div></dl></div>
        <aside className="account-card register">{user ? <AccountOnboarding displayName={user.displayName} email={user.email}/> : <><span>YENİ HESAP</span><h2>Önce güvenli oturumunuzu oluşturun.</h2><p>Kimlik doğrulamasından sonra firma ve iletişim bilgilerinizi tamamlayacağınız Arkem kayıt ekranına geri dönersiniz.</p><form action="/hesap-baglantisi" method="get"><input type="hidden" name="return_to" value="/kayit"/><button className="account-primary-action" type="submit">Kayıt adımını başlat <b>→</b></button></form><div className="account-divider"><i></i><span>Zaten hesabınız var mı?</span><i></i></div><Link className="account-secondary-action" href="/giris">Müşteri girişine dönün</Link><small className="account-privacy">Hesap oluşturmak teknik teklif veya sözleşme onayı anlamına gelmez.</small></>}</aside>
      </div>
    </section>
    <SiteFooter/>
  </main>;
}
