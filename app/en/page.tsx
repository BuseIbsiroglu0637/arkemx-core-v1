import type { Metadata } from "next";
import { HomeV4 } from "../components/HomeV4";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "ARKEM Building Systems | Structural Engineering from Design to Site" },
  description: "Structural engineering, precast concrete, structural steel, light-gauge steel and hybrid building systems connected from project design to site delivery.",
  alternates: { canonical: "/en", languages: { "tr-TR": "/", "en-US": "/en", "x-default": "/" } },
};

export default function EnglishHome() {
  return <HomeV4 locale="en" />;
}

