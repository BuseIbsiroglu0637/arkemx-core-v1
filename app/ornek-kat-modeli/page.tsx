import type { Metadata } from "next";
import Link from "next/link";
import { FrameExample } from "../components/FrameExample";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
export const metadata:Metadata={title:"İki Katlı Örnek Model | ARKEMX",robots:{index:false,follow:false}};
export default function FrameExamplePage(){return <main id="frame-example-page" className="arx-simple-home arx-workspace-page"><div className="arx-simple-shell arx-workspace-shell"><header className="arx-simple-head"><Link href="/" className="arx-simple-brand">ARKEM<span>X</span></Link><nav aria-label="Örnek model bağlantıları"><Link href="/plan-ve-aks">Plan ve aks</Link></nav></header><div className="arx-workspace-intro"><span>ÖRNEK ÇALIŞMA</span><h1>İki farklı kat plakasıyla örnek analiz</h1><p>Alan, yük yolu, lineer çerçeve hesabı ve çizim çıktısını birlikte inceleyin.</p></div><FrameExample/></div></main>;}
