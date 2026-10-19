import { SiteFooter, SiteHeader } from "./SiteChrome";
import Link from "next/link";
import type { PlatformCard } from "../data/platform";

export function PlatformPage({ eyebrow, title, accent, intro, cards, commerce = false }: { eyebrow: string; title: string; accent: string; intro: string; cards: PlatformCard[]; commerce?: boolean }) {
  return <main className="inner-page platform-page">
    <section className="inner-hero platform-hero"><SiteHeader /><div className="shell inner-hero-content"><p className="eyebrow light">{eyebrow}</p><h1>{title}<br/><em>{accent}</em></h1><p>{intro}</p></div></section>
    <section className="section shell">{commerce && <aside className="commerce-status"><span>Geliştirme aşaması · Ön talep</span><p>Bu içerikler henüz satın alınabilir veya indirilebilir bir ürün değildir. Talebinizi iletin; kapsam, erişim ve teslim koşulları netleştiğinde sizinle paylaşalım.</p></aside>}<div className="platform-grid">{cards.map((card) => {
      const external = Boolean(card.href?.startsWith("http"));
      return <article className="platform-card" key={card.title}>
        <div className={`card-visual${card.image ? " has-image" : ""}`}>{card.image && <img src={card.image} alt={card.imageAlt || card.title} loading="lazy" decoding="async" width={900} height={600} />}<b>{card.category}</b></div>
        <div className="card-body"><h2>{card.title}</h2><p>{card.description}</p>{card.meta && <small>{card.meta}</small>}{card.price && <strong>{card.price}</strong>}<a href={card.href || "/iletisim"} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{commerce ? "Ön talebimi ilet" : external ? "Kaynak kaydını aç" : card.href ? "İçeriği incele" : "Bilgi iste"}</a></div>
      </article>;
    })}</div></section>
    <section className="service-cta"><div className="shell"><h2>İhtiyacınızın kapsamını<br/><em>birlikte netleştirelim.</em></h2><Link className="button copper" href="/iletisim">ARKEM ile görüşün</Link></div></section><SiteFooter />
  </main>;
}
