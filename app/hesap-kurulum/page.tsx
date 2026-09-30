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
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <Link href={`/giris?return_to=${encodeURIComponent(returnTo)}`} className="arx-auth-back">Girişe dön</Link>
      </header>

      <section className="arx-setup-wrap" aria-labelledby="arx-setup-title">
        <div className="arx-setup-copy">
          <span>İLK KULLANIM</span>
          <h1 id="arx-setup-title">Hesap kurulumunu tamamlayın</h1>
          <p>Kimliğinizi doğrulayın, temel iletişim bilgilerinizi ekleyin ve ARKEMX çalışma alanına geçin.</p>
          <ol>
            <li><i>1</i><span><b>Güvenli oturum</b><small>Hesabınız doğrulanmış oturum kimliğiyle eşleştirilir.</small></span></li>
            <li><i>2</i><span><b>Kısa profil</b><small>Ad, firma ve iletişim bilgileri yeterlidir.</small></span></li>
            <li><i>3</i><span><b>Çalışmaya devam</b><small>Kurulumdan sonra hedef çalışma alanına dönersiniz.</small></span></li>
          </ol>
        </div>

        <div className="arx-setup-card">
          {user ? <AccountSetupGate displayName={user.displayName} email={user.email} returnTo={returnTo} showExistingAccountChoice={explicitFirstUse}/> : <>
            <span>1 / 2</span>
            <h2>Önce güvenli oturumu açın</h2>
            <p>Kimlik doğrulamasından sonra bu kurulum ekranına geri döneceksiniz.</p>
            <form action="/hesap-baglantisi" method="get">
              <input type="hidden" name="return_to" value={setupReturn}/>
              <button className="arx-auth-primary" type="submit">Güvenli girişle devam et <b>→</b></button>
            </form>
            <small>Bu ekranda parola veya ödeme bilgisi tutulmaz.</small>
          </>}
        </div>
      </section>

      <footer className="arx-auth-footer">
        <span>ARKEMX hesap kurulumu</span>
        <small>Kurulum tamamlandığında {returnTo === "/dijital-proje-merkezi" ? "Proje merkezine" : "seçtiğiniz çalışma alanına"} geçilir.</small>
      </footer>
    </div>
  </main>;
}
