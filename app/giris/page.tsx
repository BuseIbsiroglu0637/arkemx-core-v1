import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getArkemAccountUser } from "../chatgpt-auth";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Müşteri Girişi | ARKEMX",
  description: "ARKEMX müşteri proje hesabınıza güvenli biçimde giriş yapın.",
  alternates: { canonical: "/giris" },
};

export default async function LoginPage() {
  const user = await getArkemAccountUser();
  if (user) redirect("/uyelik");
  return <main className="inner-page account-page">
    <section className="account-shell">
      <SiteHeader/>
      <div className="shell account-layout">
        <div className="account-story"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><span>Müşteri Girişi</span></nav><p className="eyebrow light">ARKEMX / GÜVENLİ PROJE HESABI</p><h1>Projenize<br/><em>kaldığınız yerden devam edin.</em></h1><p>Projelerinizi, teknik görüşme geçmişinizi ve revizyon kayıtlarınızı tek Arkem çalışma alanında yönetin.</p><ol><li><i>01</i><span><b>Proje sürekliliği</b><small>Aktif ARKEMX çalışmasını hesabınıza kaydedin.</small></span></li><li><i>02</i><span><b>Görüşme geçmişi</b><small>Teknik görüşme ve takip notlarını birlikte izleyin.</small></span></li><li><i>03</i><span><b>Güvenli erişim</b><small>Kayıtlar yalnızca doğrulanmış hesabınızla açılır.</small></span></li></ol></div>
        <aside className="account-card"><span>MÜŞTERİ GİRİŞİ</span><h2>Arkem proje hesabı</h2><p>Güvenli kimlik doğrulamasını tamamladıktan sonra proje çalışma alanınıza yönlendirilirsiniz.</p><form action="/hesap-baglantisi" method="get"><input type="hidden" name="return_to" value="/uyelik"/><button className="account-primary-action" type="submit">Hesabıma giriş yap <b>→</b></button></form><div className="account-divider"><i></i><span>İlk kez mi geliyorsunuz?</span><i></i></div><Link className="account-secondary-action" href="/kayit">Yeni Arkem hesabı oluşturun</Link><small className="account-privacy">Parola, ödeme veya özel proje dosyası bu sayfada istenmez.</small></aside>
      </div>
    </section>
    <SiteFooter/>
  </main>;
}
