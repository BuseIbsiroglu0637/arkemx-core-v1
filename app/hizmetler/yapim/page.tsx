import type { Metadata } from "next";
import { ServicePage } from "../../components/ServicePage";
import { getService } from "../../data/services";
export const metadata: Metadata = { title: "Yapım Hizmetleri", description: "Hafif çelik, çelik, betonarme prefabrik ve betonarme yapı üretim, montaj ve uygulama hizmetleri.", alternates: { canonical: "/hizmetler/yapim" } };
export default function Page(){ return <ServicePage service={getService("yapim")} />; }
