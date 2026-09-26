import type { Metadata } from "next";
import { ServicePage } from "../../components/ServicePage";
import { getService } from "../../data/services";
export const metadata: Metadata = { title: "Patlatmalı Bina Yıkımı", description: "Yapısal analiz, risk planlaması, izin koordinasyonu ve uzman uygulama ekibiyle kontrollü patlatmalı bina yıkımı.", alternates: { canonical: "/hizmetler/patlatmali-bina-yikimi" } };
export default function Page(){ return <ServicePage service={getService("patlatmali-bina-yikimi")} />; }
