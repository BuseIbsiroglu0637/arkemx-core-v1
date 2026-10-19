import { restoreBriefDraft, goals, systems, labelOf } from "./brief-draft.ts";
import { positiveArea } from "./readiness-input.ts";
import { TKGM_PROVINCES } from "../data/tkgm-provinces.ts";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const normalize = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").trim();
export function briefSiteContext(projectId: string, modules: Record<string, unknown>) {
  const source = record(record(modules["decision-assistant"]).readinessScreening);
  if (!source.input) return null;
  const input = restoreBriefDraft(source.input);
  if (!input.goal || !input.stage || !input.location.trim()) return null;
  const province = TKGM_PROVINCES.features.find(item => normalize(input.location).startsWith(normalize(item.properties.text) + " ") || normalize(input.location).startsWith(normalize(item.properties.text) + "/") || normalize(input.location) === normalize(item.properties.text))?.properties.text ?? "";
  const remainder = province ? input.location.slice(province.length).replace(/^\s*\/\s*/, "").trim() : "";
  const district = remainder && !remainder.includes("/") ? remainder : "";
  const usage = ({ konut: "Konut / Villa", sanayi: "Sanayi / Depo", ticari: "Ticari Yapı", tarimsal: "Tarımsal Yapı" } as Record<string,string>)[input.goal] ?? "";
  const system = ({ kararsiz: "Karar Bekleniyor", "hafif-celik": "Hafif Çelik", celik: "Yapısal Çelik", prefabrik: "Betonarme Prefabrik", betonarme: "Betonarme", karma: "Karma Sistem" } as Record<string,string>)[input.system];
  return { schema: "ARKEM-BRIEF-SITE/1.0", projectId, signature: JSON.stringify(input), location: input.location.trim(), province, district, targetGrossArea: positiveArea(input.area), usage, goal: labelOf(goals,input.goal), system, systemLabel: labelOf(systems,input.system), documents: input.documents, priorities: input.priorities, source: "PIR müşteri beyanı; resmî parsel ve imar doğrulaması değildir" };
}
export function briefSitePatch(context: NonNullable<ReturnType<typeof briefSiteContext>>, geo: unknown) {
  const saved = record(geo);
  const hasParcel = record(saved.parcelRecord).projectEligible === true || Array.isArray(saved.parcel) && saved.parcel.length >= 3;
  // Never replace existing cadastral identity, geometry or planning evidence.
  return { briefContext: context, ...(!hasParcel ? { ...(context.usage ? { usage: context.usage } : {}), system: context.system, ...(!saved.province && !saved.block && !saved.parcelNo ? { province: context.province, district: context.district } : {}) } : {}) };
}
export function landSearchError(input: { region: string; minArea: string; maxArea: string; budget: string }) {
  if (!input.region.trim()) return "Arama bölgesini yazın.";
  for (const value of [input.minArea,input.maxArea,input.budget]) if (value.trim() && positiveArea(value) === null) return "Alan ve bütçe sıfırdan büyük bir sayı olmalı.";
  if (input.minArea.trim() && input.maxArea.trim() && positiveArea(input.minArea)! > positiveArea(input.maxArea)!) return "En büyük arsa alanı, en küçük alandan az olamaz.";
  return "";
}
