import type { Metadata } from "next";
import { ServicePage } from "../../components/ServicePage";
import { getService } from "../../data/services";
export const metadata: Metadata = { title: "Projelendirme Hizmetleri", description: "Mimari, statik, mekanik, elektrik, ruhsat, uygulama ve imalat projeleri.", alternates: { canonical: "/hizmetler/projelendirme" } };
export default function Page(){ return <ServicePage service={getService("projelendirme")} />; }
