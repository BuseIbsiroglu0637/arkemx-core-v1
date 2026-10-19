import type { MetadataRoute } from "next";
import { site } from "./data/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/giris",
        "/kayit",
        "/uyelik",
        "/hesap-baglantisi",
        "/musteri-proje-portali",
        "/dijital-proje-merkezi",
        "/proje-zekasi",
      ],
    },
    sitemap: `${site.domain}/sitemap.xml`,
    host: site.domain,
  };
}
