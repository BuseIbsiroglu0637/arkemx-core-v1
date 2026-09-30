import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountReturnPath, getArkemAccountUser } from "../chatgpt-auth";
import "../sade-arac-paneli.css";
import "./sade-giris.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Giriş | ARKEMX",
  description: "ARKEMX çalışma alanınıza güvenli biçimde giriş yapın.",
  alternates: { canonical: "/giris" },
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams?: Promise<{ return_to?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawReturnTo = Array.isArray(params?.return_to) ? params?.return_to[0] : params?.return_to;
  const returnTo = accountReturnPath(rawReturnTo);
  const user = await getArkemAccountUser();
  if (user) redirect(returnTo);

  return <main className="arx-simple-home arx-auth-page">
    <div className="arx-auth-shell">
      <header className="arx-auth-header">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <Link href="/" className="arx-auth-back">Çalışma alanına dön</Link>
      </header>

      <section className="arx-auth-card" aria-labelledby="arx-auth-title">
        <span className="arx-auth-kicker">GÜVENLİ ERİŞİM</span>
        <h1 id="arx-auth-title">ARKEMX’e giriş</h1>
        <p>Projelerinize ve çalışma araçlarınıza kaldığınız yerden devam edin.</p>

        <form action="/hesap-baglantisi" method="get">
          <input type="hidden" name="return_to" value={returnTo} />
          <button className="arx-auth-primary" type="submit">Güvenli giriş yap <b>→</b></button>
        </form>

        <div className="arx-auth-first">
          <b>İlk kez mi kullanıyorsunuz?</b>
          <p>Aynı güvenli giriş adımından sonra kısa profil kurulumunu tamamlayabilirsiniz.</p>
          <Link href={`/kayit?return_to=${encodeURIComponent(returnTo)}`}>İlk kullanım adımını aç</Link>
        </div>

        <small className="arx-auth-privacy">Parola, ödeme bilgisi veya özel proje dosyası bu sayfada istenmez.</small>
      </section>

      <footer className="arx-auth-footer">
        <span>ARKEMX çalışma alanı</span>
        <small>Giriş tamamlandığında {returnTo === "/dijital-proje-merkezi" ? "Proje merkezine" : "geldiğiniz çalışma alanına"} yönlendirilirsiniz.</small>
      </footer>
    </div>
  </main>;
}
