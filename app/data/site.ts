import { corporateRegistry } from "./corporate-registry";

export const site = {
  name: corporateRegistry.brand.name,
  legalName: corporateRegistry.legalEntity.name,
  phoneDisplay: corporateRegistry.contact.phoneDisplay,
  phoneHref: corporateRegistry.contact.phoneHref,
  whatsappHref: corporateRegistry.contact.whatsappHref,
  email: corporateRegistry.contact.email,
  location: corporateRegistry.contact.location,
  postalCode: corporateRegistry.contact.postalCode,
  domain: corporateRegistry.domains.canonical,
  hostedDomain: corporateRegistry.domains.application,
  instagram: corporateRegistry.social.instagram,
  linkedin: corporateRegistry.social.linkedin,
  youtube: corporateRegistry.social.youtube,
  facebook: corporateRegistry.social.facebook,
  tiktok: corporateRegistry.social.tiktok,
  threads: corporateRegistry.social.threads,
  sketchfab: corporateRegistry.social.sketchfab,
} as const;

export const socialChannels = [
  { label: "Instagram", short: "IG", href: site.instagram, icon: "/social/instagram.svg" },
  { label: "LinkedIn", short: "IN", href: site.linkedin, icon: "/social/linkedin-in.svg" },
  { label: "YouTube", short: "YT", href: site.youtube, icon: "/social/youtube.svg" },
  { label: "Facebook", short: "FB", href: site.facebook, icon: "/social/facebook-f.svg" },
  { label: "TikTok", short: "TK", href: site.tiktok, icon: "/social/tiktok.svg" },
  { label: "Threads", short: "TH", href: site.threads, icon: "/social/threads.svg" },
] as const;

export const mainNavigation = [
  { label: "HİZMETLER", href: "/hizmetler" },
  { label: "DİJİTAL ARAÇLAR", href: "/dijital-donusum" },
  { label: "PROJELER", href: "/projeler" },
  { label: "ARKEM", href: "/arkem" },
  { label: "İLETİŞİM", href: "/iletisim" },
] as const;

export const navigationTree = [
  {
    label: "HİZMETLER",
    href: "/hizmetler",
    description: "Projeniz için yapı sistemi, mühendislik ya da yapım desteğini ihtiyacınıza göre seçin.",
    sections: [
      {
        title: "Ne için geldiniz?",
        items: [
          { label: "Projelendirme", href: "/hizmetler/projelendirme", note: "Mimari, statik ve uygulama projeleri" },
          { label: "Yapım", href: "/hizmetler/yapim", note: "Yapı sisteminden saha uygulamasına" },
          { label: "Danışmanlık", href: "/hizmetler/danismanlik", note: "Fizibilite, maliyet, ihale ve kontrollük" },
          { label: "Kontrollü ve patlatmalı yıkım", href: "/hizmetler/patlatmali-bina-yikimi", note: "İnceleme, yöntem, güvenlik ve saha yönetimi" },
        ],
      },
      {
        title: "Yapı ve mühendislik",
        items: [
          { label: "Yapı sistemleri", href: "/yapi-sistemleri", note: "Prefabrik, çelik, hafif çelik ve hibrit" },
          { label: "Mühendislik hizmetleri", href: "/muhendislik", note: "Sistem, analiz, detay, BIM ve saha" },
        ],
      },
    ],
  },
  {
    label: "DİJİTAL ARAÇLAR",
    href: "/dijital-donusum",
    description: "Ürün adı aramanıza gerek kalmadan yapmak istediğiniz işi seçin; teknik ayrıntılar gerektiğinde açılır.",
    sections: [
      {
        title: "Ne yapmak istiyorsunuz?",
        items: [
          { label: "Arsayı değerlendirin", href: "/arsa-fizibilite-studyosu", note: "Konum, parsel ve ön fizibilite" },
          { label: "Yeni proje başlat", href: "/proje-baslat", note: "Teknik bilgi gerekmeden beş sade adım" },
          { label: "Mevcut projeme devam et", href: "/musteri-proje-portali", note: "Sıradaki iş, kararlar ve dosyalar" },
        ],
      },
    ],
  },
  {
    label: "PROJELER",
    href: "/projeler",
    description: "Seçilmiş çalışmalar ve teknik proje kayıtları.",
    sections: [],
  },
  {
    label: "ARKEM",
    href: "/arkem",
    description: "Kurumsal yapı, mühendislik yaklaşımı ve teknik liderlik.",
    sections: [],
  },
  {
    label: "İLETİŞİM",
    href: "/iletisim",
    description: "Projenizin konumunu, yapı türünü, kapsamını ve mevcut belgelerini ARKEM’e iletin.",
    sections: [],
  },
] as const;
