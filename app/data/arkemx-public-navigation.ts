import type { PublicArkemXNavigationItem } from "./arkemx-public-types";

/**
 * Browser-facing navigation index. It intentionally contains no validation
 * evidence, dependency graph, development note or internal working route.
 * A synchronization test compares these public identities and states with the
 * canonical server registry.
 */
export const publicArkemXNavigation: readonly PublicArkemXNavigationItem[] = [
  { id: "proje-modeli", code: "01", title: "Proje Modeli", status: "AKTİF · GELİŞTİRİLİYOR" },
  { id: "yapisal-analiz", code: "02", title: "Yapısal Analiz", status: "DOĞRULANIYOR" },
  { id: "deprem-muhendisligi", code: "03", title: "Deprem Mühendisliği", status: "DOĞRULANIYOR" },
  { id: "betonarme", code: "04", title: "Betonarme", status: "DOĞRULANIYOR" },
  { id: "prefabrik-betonarme", code: "05", title: "Prefabrik Betonarme", status: "DOĞRULANIYOR" },
  { id: "yapisal-celik", code: "06", title: "Yapısal Çelik", status: "DOĞRULANIYOR" },
  { id: "hafif-celik", code: "07", title: "Hafif Çelik", status: "DOĞRULANIYOR" },
  { id: "hibrit-sistemler", code: "08", title: "Hibrit Sistemler", status: "DOĞRULANIYOR" },
  { id: "temel-zemin", code: "09", title: "Temel ve Zemin Etkileşimi", status: "DOĞRULANIYOR" },
  { id: "detay-imalat", code: "10", title: "Detay ve İmalat", status: "AKTİF · GELİŞTİRİLİYOR" },
  { id: "metraj-maliyet", code: "11", title: "Metraj ve Maliyet", status: "DOĞRULANIYOR" },
  { id: "dogrulama-izlenebilirlik", code: "12", title: "Doğrulama ve İzlenebilirlik", status: "AKTİF · GELİŞTİRİLİYOR" },
  { id: "yapim-saha", code: "13", title: "Yapım Aşaması ve Saha", status: "DOĞRULANIYOR" },
] as const;
