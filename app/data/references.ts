export type ReferenceMedia = {
  kind: "image" | "video" | "pdf";
  label: string;
  url: string;
  poster?: string;
};

export type ReferenceRecord = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  archiveMeta: string;
  image: string;
  imageAlt: string;
  types: ("3B Model" | "PDF" | "Video")[];
  verifiedEvidence: string[];
  scopeBoundary: string;
  media: ReferenceMedia[];
  relatedService: { title: string; href: string };
};

export const referenceRecords: ReferenceRecord[] = [
  {
    slug: "romon-group-yapi-modeli",
    title: "ROMON Group Yapı Modeli",
    category: "Prefabrik ve Çelik",
    summary: "Taşıyıcı sistem geometrisi, çatı makasları ve yapı bileşenlerinin üç boyutlu teknik model üzerinden değerlendirildiği arşiv çalışması.",
    archiveMeta: "Gerçek proje arşivi · 3B model görüntüsü",
    image: "https://static.wixstatic.com/media/44ce0e_b689c732462945e78a9f4ed35d25f5d4~mv2.png",
    imageAlt: "ROMON Group prefabrik ve çelik yapı üç boyutlu teknik modeli",
    types: ["3B Model"],
    verifiedEvidence: [
      "Üç boyutlu taşıyıcı sistem model görüntüsü",
      "Prefabrik ve çelik yapı bileşenlerinin birlikte gösterimi",
      "Çatı makasları ile taşıyıcı aks düzeninin görsel kaydı",
    ],
    scopeBoundary: "Arşiv kaydında proje konumu, yapım yılı, toplam alan, sözleşme kapsamı ve uygulama sonucu bilgileri bulunmadığı için bu veriler yayımlanmamıştır.",
    media: [
      { kind: "image", label: "3B model görüntüsünü aç", url: "https://static.wixstatic.com/media/44ce0e_b689c732462945e78a9f4ed35d25f5d4~mv2.png" },
    ],
    relatedService: { title: "Projelendirme", href: "/hizmetler/projelendirme" },
  },
  {
    slug: "diyanet-tasiyici-sistem-modeli",
    title: "DİYANET Taşıyıcı Sistem Modeli",
    category: "3B Projelendirme",
    summary: "Prefabrikasyon, çelik çerçeve ve yapı bileşenlerinin bütüncül olarak incelendiği dijital mühendislik arşiv çalışması.",
    archiveMeta: "Gerçek proje arşivi · Model görüntüsü ve PDF",
    image: "https://static.wixstatic.com/media/44ce0e_f81db79215f24f048da62f06351b4d60~mv2.png",
    imageAlt: "DİYANET üç boyutlu taşıyıcı sistem modeli",
    types: ["3B Model", "PDF"],
    verifiedEvidence: [
      "Üç boyutlu taşıyıcı sistem model görüntüsü",
      "Model kaydıyla ilişkili teknik PDF dosyası",
      "Prefabrik ve çelik taşıyıcı bileşenlerin dijital temsili",
    ],
    scopeBoundary: "Arşiv kaydında proje konumu, toplam alan, işveren kapsamı, teslim tarihi ve uygulama sonucu bilgileri bulunmadığı için bu veriler yayımlanmamıştır.",
    media: [
      { kind: "image", label: "3B model görüntüsünü aç", url: "https://static.wixstatic.com/media/44ce0e_f81db79215f24f048da62f06351b4d60~mv2.png" },
      { kind: "pdf", label: "Teknik PDF dosyasını aç", url: "https://d68d317f-d589-4260-b3db-f7c0dc79ed55.usrfiles.com/ugd/44ce0e_cf2016d3507743f182d18b46ec4e23e0.pdf" },
    ],
    relatedService: { title: "Projelendirme", href: "/hizmetler/projelendirme" },
  },
  {
    slug: "plaza-yapi-incelemesi",
    title: "Plaza Yapı İncelemesi",
    category: "Teknik Değerlendirme",
    summary: "Taşıyıcı sistem ve mevcut saha verilerinin görsel kayıt üzerinden incelendiği teknik çalışma arşivi.",
    archiveMeta: "Gerçek proje arşivi · 64 saniyelik video",
    image: "https://static.wixstatic.com/media/44ce0e_f4dbc637852345b4af72dc83dd8177c9f002.jpg",
    imageAlt: "Plaza projesi teknik inceleme videosu kapak görüntüsü",
    types: ["Video"],
    verifiedEvidence: [
      "Altmış dört saniyelik teknik inceleme videosu",
      "Mevcut yapı ve saha koşullarına ait görsel kayıt",
      "Taşıyıcı sistemin görsel değerlendirmesine yönelik arşiv materyali",
    ],
    scopeBoundary: "Arşiv kaydında yapının açık adresi, toplam alanı, inceleme tarihi, rapor sonucu veya müdahale kapsamı bulunmadığı için bu veriler yayımlanmamıştır.",
    media: [
      { kind: "video", label: "Teknik inceleme videosunu aç", url: "https://video.wixstatic.com/video/44ce0e_f4dbc637852345b4af72dc83dd8177c9/720p/mp4/file.mp4", poster: "https://static.wixstatic.com/media/44ce0e_f4dbc637852345b4af72dc83dd8177c9f002.jpg" },
    ],
    relatedService: { title: "Teknik Danışmanlık", href: "/hizmetler/danismanlik" },
  },
];

export const getReferenceRecord = (slug: string) => {
  const normalizedSlug = slug === "diyamet-tasiyici-sistem-modeli" ? "diyanet-tasiyici-sistem-modeli" : slug;
  return referenceRecords.find((record) => record.slug === normalizedSlug);
};
