import type { Metadata } from "next";
import { DigitalInnovationLab } from "../components/DigitalInnovationLab";
export const metadata: Metadata = { title: "Bilgi teslim planı | ARKEMX Demo", robots: { index: false, follow: false } };
export default function ModulePage() {
  return <main className="demo-tool-page"><section className="shell section" id="teslim-kapsami" aria-labelledby="module-title"><h1 id="module-title">Bilgi teslim planı</h1><DigitalInnovationLab/></section></main>;
}
