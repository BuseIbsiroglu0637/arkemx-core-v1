import type {Metadata} from "next";
import {DemoMassingWorkspace} from "../components/DemoMassingWorkspace";
import {DEMO_ENABLED} from "../lib/demo";
import {SiteIntelligenceStudio} from "../components/SiteIntelligenceStudio";
export const metadata: Metadata={title:"Hızlı yerleşim | ARKEMX Demo",robots:{index:false,follow:false}};
export default function MassingPage(){return <main className="demo-tool-page"><section className="shell section" id="hizli-senaryo">{DEMO_ENABLED?<DemoMassingWorkspace/>:<><h1>Hızlı yerleşim</h1><SiteIntelligenceStudio/></>}</section></main>}
