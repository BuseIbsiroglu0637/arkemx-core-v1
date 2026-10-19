export const goals = [
  ["konut", "Konut / villa"],
  ["sanayi", "Sanayi tesisi / fabrika / depo"],
  ["ticari", "Ticari veya sosyal yapı"],
  ["tarimsal", "Tarımsal yapı"],
  ["mevcut", "Mevcut yapı incelemesi"],
  ["yikim", "Kontrollü veya patlatmalı yıkım"],
] as const;

export const stages = [
  ["fikir", "Fikir veya arsa aşaması"],
  ["on-proje", "Ön proje / mimari çalışma mevcut"],
  ["ruhsat", "Ruhsat veya uygulama projesi mevcut"],
  ["teklif", "Teklif toplama / firma seçimi"],
  ["santiye", "Üretim veya şantiye aşaması"],
  ["mevcut", "Mevcut yapı / dönüşüm aşaması"],
] as const;

export const systems = [
  ["kararsiz", "Henüz karar verilmedi"],
  ["hafif-celik", "Hafif çelik"],
  ["celik", "Çelik"],
  ["prefabrik", "Betonarme prefabrik"],
  ["betonarme", "Betonarme"],
  ["karma", "Karma sistem"],
] as const;

export const documentOptions = [
  ["arsa", "Arsa / imar bilgileri"],
  ["mimari", "Mimari plan veya eskiz"],
  ["zemin", "Zemin etüdü"],
  ["statik", "Statik proje veya hesap"],
  ["gorsel", "Fotoğraf / video / mevcut durum kaydı"],
] as const;

export const priorityOptions = [
  ["sure", "Hızlı teslim"],
  ["butce", "Bütçe kontrolü"],
  ["esneklik", "Mimari esneklik"],
  ["enerji", "Enerji performansı"],
  ["guvenlik", "Teknik risk ve güvenlik"],
] as const;

export const labelOf = (options: readonly (readonly [string, string])[], value: string) => options.find(([key]) => key === value)?.[1] || "Belirtilmedi";


export function restoreBriefDraft(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const choice = (options: readonly (readonly [string, string])[], value: unknown, fallback = "") => options.some(([id]) => id === value) ? String(value) : fallback;
  const list = (options: readonly (readonly [string, string])[], values: unknown) => Array.isArray(values) ? [...new Set(values.filter(v => options.some(([id]) => id === v)))] as string[] : [];
  return { goal: choice(goals, input.goal), stage: choice(stages, input.stage), system: choice(systems, input.system, "kararsiz"), location: typeof input.location === "string" ? input.location.slice(0, 500) : "", area: typeof input.area === "string" ? input.area.slice(0, 50) : "", documents: list(documentOptions, input.documents), priorities: list(priorityOptions, input.priorities) };
}
