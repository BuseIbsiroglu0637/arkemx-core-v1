import { ContentImage } from "../components/ContentImage";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { services } from "../data/services";

export const metadata: Metadata = { title: "Hizmetler", description: "Arkem Yapı Sistemleri projelendirme, yapım, danışmanlık ve patlatmalı bina yıkımı hizmetleri.", alternates: { canonical: "/hizmetler" } };

export default function ServicesPage() { return <main className="inner-page"><section className="inner-hero services-hero"><SiteHeader /><div className="shell inner-hero-content"><p className="eyebrow light">ARKEM HİZMETLERİ</p><h1>Dört uzmanlık.<br />Tek teknik sorumluluk.</h1><p>Fikirden projeye, üretimden uygulamaya ve kontrollü yıkıma kadar ihtiyacınız olan hizmet kolunu seçin.</p></div></section><section className="section shell visual-service-index">{services.map(service => <a className="visual-service-row" href={`/hizmetler/${service.slug}`} key={service.slug}><div><ContentImage src={service.image} alt={service.imageAlt}/><span>{service.no}</span></div><div><p className="eyebrow">{service.title}</p><h2>{service.shortTitle}</h2><strong>{service.punchline}</strong><p>{service.summary}</p><div className="service-row-tags">{service.highlights.map(item=><span key={item}>{item}</span>)}</div><b>Hizmeti İncele ↗</b></div></a>)}</section><SiteFooter /></main>; }
