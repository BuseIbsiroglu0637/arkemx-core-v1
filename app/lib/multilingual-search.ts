const conceptAliases: Record<string, string[]> = {
  parcel: ["parsel", "arsa", "parcel", "land", "torpaq", "участок", "terreno", "grundstück", "parcelle"],
  structure: ["taşıyıcı", "statik", "structure", "structural", "konstruksiya", "конструкция", "struttura", "tragwerk"],
  architecture: ["mimari", "mahal", "architecture", "architectural", "memarlıq", "архитектура", "architettura", "architektur"],
  document: ["doküman", "mevzuat", "document", "standard", "sənəd", "документ", "documento", "dokument"],
  demolition: ["yıkım", "patlatmalı", "demolition", "demolizione", "abbruch", "démolition", "снос", "söküntü"],
  coordination: ["koordinasyon", "çakışma", "coordination", "collision", "koordinasiya", "координация", "coordinamento", "koordination"],
};

export function expandMultilingualQuery(query: string, normalize: (value: string) => string) {
  const source = normalize(query);
  const terms = source.split(/\s+/).filter(Boolean);
  const expanded = new Set(terms);
  for (const aliases of Object.values(conceptAliases)) {
    const normalizedAliases = aliases.map(normalize);
    if (normalizedAliases.some((alias) => terms.includes(alias))) normalizedAliases.forEach((alias) => expanded.add(alias));
  }
  return { terms, expanded: [...expanded] };
}

export const SEARCH_LANGUAGES = ["tr", "en", "az", "ru", "it", "de", "fr"] as const;
