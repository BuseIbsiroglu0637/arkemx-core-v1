import type { Metadata } from "next";
import { DemoWorkspace } from "../components/DemoWorkspace";

export const metadata: Metadata = {
  title: "ARKEMX Demo | 13 Modül",
  description: "ARKEMX demo modülleri.",
  alternates: { canonical: "/dijital-proje-merkezi" },
  robots: { index: false, follow: false },
};

export default function DigitalProjectCenterPage() {
  return <main className="demo-start-page"><DemoWorkspace /></main>;
}
