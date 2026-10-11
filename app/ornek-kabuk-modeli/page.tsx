import type {Metadata} from "next";
import Link from "next/link";
import {ShellExample} from "../components/ShellExample";
import {CoupledFrameShellExample} from "../components/CoupledFrameShellExample";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
import "./shell-example.css";
export const metadata:Metadata={title:"Örnek Kabuk Sonuçları | ARKEMX",robots:{index:false,follow:false}};
export default function ShellExamplePage(){return <main className="arx-simple-home arx-workspace-page"><div className="arx-simple-shell arx-workspace-shell"><header className="arx-simple-head"><Link href="/" className="arx-simple-brand">ARKEM<span>X</span></Link><nav aria-label="Kabuk örneği bağlantıları"><Link href="/ornek-kat-modeli">Çerçeve örneği</Link><Link href="/plan-ve-aks">Plan ve aks</Link></nav></header><div className="arx-workspace-intro"><span>ÖRNEK KABUK ÇALIŞMASI</span><h1>Döşeme kabuk sonuçları</h1><p>Bağımsız plaka sonuçlarını ve sentetik ortak çözüm örneğini inceleyin.</p></div><ShellExample/><CoupledFrameShellExample/></div></main>;}
