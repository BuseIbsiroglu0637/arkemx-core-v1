import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "ARKEM",
  description: "ARKEM’in varlık nedeni, mühendislik yaklaşımı, teknik liderliği ve dijital mühendislik omurgası ARKEMX.",
  alternates: { canonical: "/arkem" },
  openGraph: { title: "ARKEM | ARKEM Yapı Sistemleri", description: "ARKEM’in varlık nedeni, mühendislik yaklaşımı, teknik liderliği ve dijital mühendislik omurgası ARKEMX.", url: "/arkem", images: [{ url: "/arkem-social-share.png", width: 1200, height: 630, alt: "ARKEM Yapı Sistemleri — mühendislikten sahaya" }] },
};

export default function ArkemPage() {
  return <main className="inner-page v21-standard-page v21-arkem-page">
    <section className="v21-standard-hero"><SiteHeader /><div className="shell"><p className="v21-index">ARKEM / ORGANİZASYON</p><h1>YAPIYI TASARLAR.<br />MÜHENDİSLİĞİNİ ÇÖZER.<br /><em>SAHAYA TAŞIR.</em></h1><p>ARKEM, farklı taşıyıcı sistemleri proje ve uygulama gerçekleriyle birlikte ele alan yapısal mühendislik ve yapı sistemleri organizasyonudur.</p></div></section>
    <section className="v21-section" id="neden"><div className="shell v21-two-column"><div><p className="v21-index">01 / ARKEM NEDEN VAR?</p><h2>Proje ile uygulama<br /><em>arasındaki boşluğu kapatmak.</em></h2></div><div><p>Bir yapının yalnızca tasarlanması yeterli değildir. Hesaplanabilir, üretilebilir, uygulanabilir ve kontrol edilebilir olması gerekir.</p><p>ARKEM’in konumu bu zincirin tamamındadır.</p></div></div></section>
    <section className="v21-section v21-principles" id="yaklasim"><div className="shell"><p className="v21-index">02 / MÜHENDİSLİK YAKLAŞIMI</p><div>{["Doğru sistemi proje verisiyle seç", "Analizi üretim ve montajdan koparma", "Kapsamı ve sorumluluğu açık yaz", "Revizyonu ve karar izini koru", "Teknik kaydı pazarlama sıfatından öne al"].map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, "0")}</span><h2>{item}</h2></article>)}</div></div></section>
    <section className="v21-section" id="teknik-liderlik"><div className="shell v21-leadership"><Image src="/ozenc-ozturk.jpg" width={1122} height={1402} sizes="(max-width: 760px) 100vw, 36vw" unoptimized alt="Özenç Öztürk" /><div><p className="v21-index">03 / TEKNİK LİDERLİK</p><h2>Özenç Öztürk</h2><strong>Yüksek İnşaat Mühendisi<br />Kurucu / Teknik Liderlik</strong><p>Taşıyıcı sistem tasarımı, statik proje, üretim hazırlığı ve saha uygulamasını farklı yapı sistemleri üzerinde ortak teknik sorumluluk yaklaşımıyla ele alır.</p></div></div></section>
    <section className="v21-section v21-arkem-x-bridge"><div className="shell v21-two-column"><div><p className="v21-index">04 / ARKEMX</p><h2>Mühendislik deneyiminden<br /><em>dijital proje omurgasına.</em></h2></div><div><p>ARKEMX, saha ve proje deneyiminden doğan mühendislik süreçlerini dijitalleştirmek ve farklı taşıyıcı sistemleri ortak proje yapısında yönetmek amacıyla geliştirilen ARKEM platformudur.</p><Link className="v21-text-link" href="/arkemx">ARKEMX’i inceleyin <span aria-hidden="true">↗</span></Link></div></div></section>
    <SiteFooter />
  </main>;
}
