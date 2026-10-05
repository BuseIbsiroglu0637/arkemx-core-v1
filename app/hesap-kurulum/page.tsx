import type { Metadata } from "next";
import Link from "next/link";
import { accountReturnPath, getArkemAccountUser } from "../chatgpt-auth";
import { AccountSetupGate } from "../components/AccountSetupGate";
import "../sade-arac-paneli.css";
import "../giris/sade-giris.css";
import "./sade-hesap-kurulum.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hesap Kurulumu | ARKEMX",
  description: "ARKEMX çalışma alanınız için temel hesap bilgilerinizi tamamlayın.",
  alternates: { canonical: "/hesap-kurulum" },
  robots: { index: false, follow: false },
};

type SetupPageProps = {
  searchParams?: Promise<{
    return_to?: string | string[];
    entry?: string | string[];
  }>;
};

export default async function AccountSetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const rawReturnTo = Array.isArray(params?.return_to) ? params?.return_to[0] : params?.return_to;
  const rawEntry = Array.isArray(params?.entry) ? params?.entry[0] : params?.entry;
  const explicitFirstUse = rawEntry === "first-use";
  const returnTo = accountReturnPath(rawReturnTo);
  const user = await getArkemAccountUser();
  const setupReturn = `/hesap-kurulum?return_to=${encodeURIComponent(returnTo)}${explicitFirstUse ? "&entry=first-use" : ""}`;

  return <main className="arx-simple-home arx-auth-page arx-setup-page">
    <div className="arx-auth-shell">
      <header className="arx-auth-header">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX ana sayfası">ARKEM<span>X</span></Link>
        <Link href={`/giris?return_to=${encodeURIComponent(returnTo)}`} className="arx-auth-back">← Girişe dön</Link>
      </header>

      <section className="arx-setup-wrap" aria-labelledby="arx-setup-title">
        <div className="arx-setup-copy">
          <span>İLK KURULUM</span>
          <h1 id="arx-setup-title">ARKEMX hesabınızı hazırlayın</h1>
          <p>Çalışma alanınıza geçmek için kısa kurulumu tamamlayın.</p>
          <ol>
            <li><i>1</i><span><b>Güvenli giriş</b><small>Hesabınızla güvenli şekilde oturum açın.</small></span></li>
            <li><i>2</i><span><b>Profil bilgileri</b><small>Ad, firma ve iletişim bilgilerinizi tamamlayın.</small></span></li>
            <li><i>3</i><span><b>Tamamlandı</b><small>Kurulumdan sonra çalışma alanınıza yönlendirilirsiniz.</small></span></li>
          </ol>
        </div>

        <div className="arx-setup-card">
          {user ? <AccountSetupGate displayName={user.displayName} email={user.email} returnTo={returnTo} showExistingAccountChoice={explicitFirstUse}/> : <>
            <span>ADIM 1 / 3</span>
            <h2>Güvenli oturumunuzu açın</h2>
            <p>Giriş yaptıktan sonra profil bilgilerinizi tamamlamak için bu ekrana geri döneceksiniz.</p>
            <form action="/hesap-baglantisi" method="get">
              <input type="hidden" name="return_to" value={setupReturn}/>
              <button className="arx-auth-primary" type="submit">Giriş Yap <b aria-hidden="true">→</b></button>
            </form>
            <small>Bu ekranda parola, ödeme bilgisi veya proje dosyası tutulmaz.</small>
          </>}
        </div>
      </section>
    </div>
  </main>;
}
