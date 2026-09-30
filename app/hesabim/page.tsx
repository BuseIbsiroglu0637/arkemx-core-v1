import type { Metadata } from "next";
import Link from "next/link";
import { accountSignOutPath, getArkemAccountUser } from "../chatgpt-auth";
import { ClientAccountSettings } from "../components/ClientAccountSettings";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
import "./sade-hesabim.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hesabım | ARKEMX",
  description: "ARKEMX hesap, profil ve proje bağlantılarınızı yönetin.",
  alternates: { canonical: "/hesabim" },
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getArkemAccountUser();

  if (!user) {
    return <main className="arx-simple-home arx-workspace-page arx-account-page">
      <div className="arx-simple-shell arx-workspace-shell">
        <header className="arx-simple-head">
          <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
          <nav className="arx-workspace-nav" aria-label="Hesap bağlantıları">
            <Link href="/dijital-proje-merkezi">Proje merkezi</Link>
            <Link href="/">Tüm araçlar</Link>
          </nav>
        </header>
        <section className="arx-account-login-required" aria-labelledby="arx-account-login-title">
          <span>HESAP</span>
          <h1 id="arx-account-login-title">Oturum gerekli</h1>
          <p>Profilinizi ve hesaba bağlı proje kayıtlarını görmek için güvenli giriş yapın.</p>
          <a href="/giris?return_to=%2Fhesabim">Güvenli giriş yap →</a>
        </section>
      </div>
    </main>;
  }

  return <main className="arx-simple-home arx-workspace-page arx-account-page">
    <div className="arx-simple-shell arx-workspace-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-workspace-nav" aria-label="Hesap bağlantıları">
          <Link href="/dijital-proje-merkezi">Proje merkezi</Link>
          <Link href="/">Tüm araçlar</Link>
        </nav>
      </header>

      <div className="arx-account-intro">
        <div>
          <span>HESAP</span>
          <h1>Hesabım</h1>
          <p>Profil bilgilerinizi ve hesaba bağlı proje kayıtlarını yönetin.</p>
        </div>
        <aside>
          <small>Oturum</small>
          <b>{user.displayName}</b>
          <span>{user.email}</span>
          <a href={accountSignOutPath("/giris")}>Güvenli çıkış</a>
        </aside>
      </div>

      <ClientAccountSettings displayName={user.displayName} email={user.email} simple />

      <p className="arx-account-boundary">Hesap kaydı, proje verisinin teknik doğruluğu veya resmî onayı anlamına gelmez.</p>
    </div>
  </main>;
}
