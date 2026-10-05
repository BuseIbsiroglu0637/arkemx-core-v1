import type { Metadata } from "next";
import { ServicePage } from "../../components/ServicePage";
import { getService } from "../../data/services";
export const metadata: Metadata = { title: "Teknik Danışmanlık", description: "Fizibilite, yapı sistemi seçimi, metraj maliyet, ruhsat, proje yönetimi ve teknik kontrollük.", alternates: { canonical: "/hizmetler/danismanlik" } };
export default function Page(){ return <ServicePage service={getService("danismanlik")} />; }
