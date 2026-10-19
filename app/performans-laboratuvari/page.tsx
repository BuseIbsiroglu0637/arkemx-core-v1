import type { Metadata } from "next";
import { ArkemXLab } from "../components/ArkemXLab";
export const metadata: Metadata = { title: "Performans laboratuvarı | ARKEMX Demo", robots: { index: false, follow: false } };
export default function ModulePage() {
  return <main className="demo-tool-page"><section className="shell section" id="laboratuvar" aria-labelledby="module-title"><h1 id="module-title">Performans laboratuvarı</h1><ArkemXLab/></section></main>;
}
