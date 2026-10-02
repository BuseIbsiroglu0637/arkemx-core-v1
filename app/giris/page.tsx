import type { Metadata } from "next";
import Link from "next/link";
import { accountReturnPath } from "../chatgpt-auth";
import "../sade-arac-paneli.css";
import "./sade-giris.css";

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

  return <main className="arx-simple-home arx-auth-page">
    <div className="arx-auth-shell">
      <header className="arx-auth-header">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX ana sayfası">ARKEM<span>X</span></Link>
      </header>

      <section className="arx-auth-card" aria-labelledby="arx-auth-title">
        <h1 id="arx-auth-title">ARKEMX’e Giriş</h1>
        <p>Projelerinize ve çalışma alanınıza erişin.</p>

        <form action="/hesap-baglantisi" method="get">
          <input type="hidden" name="return_to" value={returnTo}/>
          <button className="arx-auth-primary" type="submit">
            <span>Giriş Yap</span>
            <b aria-hidden="true">→</b>
          </button>
        </form>

        <div className="arx-auth-first">
          <b>İlk kez mi kullanıyorsunuz?</b>
          <Link href={`/hesap-kurulum?return_to=${encodeURIComponent(returnTo)}&entry=first-use`}>
            İlk kurulumu başlat
          </Link>
        </div>

        <small className="arx-auth-privacy">
          Bu ekranda parola, ödeme bilgisi veya proje dosyası istenmez.
        </small>
      </section>
    </div>
  </main>;
}
