import Link from "next/link";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";

export default function NotFound() {
  return <main className="inner-page not-found-page"><section className="inner-hero"><SiteHeader/><div className="shell inner-hero-content"><p className="eyebrow light">404 · Sayfa Bulunamadı</p><h1>Aradığınız sayfa<br/><em>burada görünmüyor.</em></h1><p>Bağlantı değişmiş veya içerik henüz yayımlanmamış olabilir. Ana sayfaya dönebilir ya da proje verinizi karar asistanıyla düzenleyebilirsiniz.</p><div className="actions"><Link className="button copper" href="/">Ana Sayfaya Dön <span aria-hidden="true">↗</span></Link><Link className="button ghost" href="/proje-karar-asistani">Karar Asistanını Aç <span aria-hidden="true">↗</span></Link></div></div></section><SiteFooter/></main>;
}
