import Link from "next/link";
import { ArrowDown, ArrowLeft } from "lucide-react";
import { SiteHeader } from "./SiteChrome";

export function ModuleWorkspaceHeader({ title, description, target, example = false }: { title: string; description: string; target: string; example?: boolean }) {
  return <><div className="module-workspace-chrome"><SiteHeader /></div><header className="module-workspace-intro shell">
    <div><Link className="module-workspace-back" href="/dijital-donusum"><ArrowLeft size={16} aria-hidden="true" /> Dijital araçlar</Link><h1>{title}</h1><p>{description}</p></div>
    <div className="module-workspace-entry"><span>{example ? "Etkileşimli örnek · gerçek proje ölçümü değildir" : "Ön çalışma · uzman incelemesi gerekir"}</span><a href={`#${target}`}>Çalışma alanına geç <ArrowDown size={16} aria-hidden="true" /></a><Link href="/dijital-donusum">Nereden başlayacağım?</Link></div>
  </header></>;
}
