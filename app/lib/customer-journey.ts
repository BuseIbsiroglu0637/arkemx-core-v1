import type { GuidedProjectIntake } from "./guided-project";

export const customerRecord = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
export const customerUsageLabels: Record<string, string> = { residential: "Konut / villa", industrial: "Sanayi / üretim / depo", commercial: "Ticari yapı", agricultural: "Tarımsal yapı", mixed: "Karma kullanım" };
export const customerSystemLabels: Record<string, string> = { undecided: "Uzmanla birlikte karar vereceğim", concrete: "Betonarme", precast: "Betonarme prefabrik", steel: "Yapısal çelik", light: "Hafif çelik", hybrid: "Karma / hibrit sistem" };
export const customerBudgetLabels: Record<string, string> = { undecided: "Bütçe için danışmanlık istiyorum", "under-five": "5 milyon TL altı", "five-fifteen": "5–15 milyon TL", "fifteen-fifty": "15–50 milyon TL", "over-fifty": "50 milyon TL üzeri" };
export const customerTimelineLabels: Record<string, string> = { urgent: "0–3 ay", "six-months": "3–6 ay", "twelve-months": "6–12 ay", flexible: "Esnek takvim" };
export const customerStepLabels = ["İhtiyaçlarınız", "Arsa ve belgeler", "Mekânlarınız", "Yapı sistemi", "Bütçe ve takvim", "İncelemeye gönder"];

export function normalizeCustomerIntake(value: unknown, fallback: GuidedProjectIntake): GuidedProjectIntake {
  const raw = customerRecord(value);
  const choice = <T extends string>(key: string, values: readonly T[], otherwise: T): T => values.includes(raw[key]) ? raw[key] : otherwise;
  const number = (key: string, min: number, max: number) => typeof raw[key] === "number" && Number.isFinite(raw[key]) && raw[key] >= min && raw[key] <= max ? raw[key] : fallback[key as keyof GuidedProjectIntake] as number;
  return { name: typeof raw.name === "string" ? raw.name.slice(0, 160) : fallback.name, location: typeof raw.location === "string" ? raw.location.slice(0, 160) : fallback.location,
    projectType: choice("projectType", ["new", "existing", "demolition"], fallback.projectType), usage: choice("usage", Object.keys(customerUsageLabels) as GuidedProjectIntake["usage"][], fallback.usage),
    parcelStatus: choice("parcelStatus", ["unknown", "searching", "identified", "verified"], fallback.parcelStatus),
    targetArea: number("targetArea", 20, 1_000_000), floors: Math.floor(number("floors", 1, 100)), floorHeight: number("floorHeight", 2.4, 30),
    system: choice("system", Object.keys(customerSystemLabels) as GuidedProjectIntake["system"][], fallback.system), budget: choice("budget", Object.keys(customerBudgetLabels) as GuidedProjectIntake["budget"][], fallback.budget), timeline: choice("timeline", Object.keys(customerTimelineLabels) as GuidedProjectIntake["timeline"][], fallback.timeline),
    priorities: Array.isArray(raw.priorities) ? [...new Set(raw.priorities.filter((v: unknown) => ["safety", "cost", "time", "flexibility", "carbon", "operation"].includes(String(v))))] as string[] : fallback.priorities,
    documents: Array.isArray(raw.documents) ? [...new Set(raw.documents.filter((v: unknown) => ["title-deed", "parcel-id", "zoning", "survey", "soil", "existing-plan"].includes(String(v))))] as GuidedProjectIntake["documents"] : fallback.documents,
    experienceMode: choice("experienceMode", ["guided", "technical"], fallback.experienceMode),
  };
}

export function intakeStepError(intake: GuidedProjectIntake, step: number): string {
  if (step === 0 && intake.name.trim().length < 3) return "Projenize en az 3 karakterlik bir ad verin.";
  if (step === 1 && intake.location.trim().length < 2) return "Arsanız yoksa düşündüğünüz il veya bölgeyi yazın.";
  if (step === 2 && (!Number.isFinite(intake.targetArea) || intake.targetArea < 20 || intake.targetArea > 1_000_000 || !Number.isInteger(intake.floors) || intake.floors < 1 || intake.floors > 100 || !Number.isFinite(intake.floorHeight) || intake.floorHeight < 2.4 || intake.floorHeight > 30)) return "Alan 20–1.000.000 m², kat sayısı 1–100 tam sayı, kat yüksekliği 2,4–30 m olmalı.";
  if (step === 3 && intake.priorities.length === 0) return "Kararınız için en az bir öncelik seçin.";
  return "";
}

export function customerBriefSignature(modules: Record<string, unknown>): string {
  return JSON.stringify(customerRecord(modules["decision-assistant"]).input ?? {});
}

export function customerSubmissionText(project: { id: string; name: string; modules: Record<string, unknown> }): string {
  const intake = customerRecord(customerRecord(project.modules["decision-assistant"]).input);
  const journey = customerRecord(project.modules["customer-journey"]);
  const architecture = customerRecord(project.modules["architectural-program"]);
  const spaces = Array.isArray(architecture.spaces) ? architecture.spaces : [];
  const documents: Record<string, string> = { "title-deed": "Tapu", "parcel-id": "Ada/parsel", zoning: "İmar durumu", survey: "Harita", soil: "Zemin etüdü", "existing-plan": "Mevcut proje" };
  const priorities: Record<string, string> = { safety: "Güvenlik", cost: "Maliyet", time: "Süre", flexibility: "Esneklik", carbon: "Karbon", operation: "İşletme" };
  const projectType = ({ new: "Yeni yapı", existing: "Mevcut yapı / dönüşüm", demolition: "Yıkım ön değerlendirmesi" } as Record<string, string>)[intake.projectType] || "Belirlenmedi";
  return [`ARKEMX proje özeti — ${project.name} (${project.id})`, `Proje türü: ${projectType}`, `Konum: ${intake.location || "Belirlenmedi"}`, `Kullanım: ${customerUsageLabels[intake.usage] || "Belirlenmedi"}`, `Hedef: ${intake.targetArea || "—"} m² / ${intake.floors || "—"} kat`, `Kat yüksekliği ön hedefi: ${intake.floorHeight || "Belirlenmedi"} m`, `Arsa: ${["identified", "verified"].includes(intake.parcelStatus) ? "Parsel bilgisi mevcut; doğrulama bekleniyor" : "Arsa araştırması / danışmanlık gerekiyor"}`, `Beyan edilen belgeler: ${(Array.isArray(intake.documents) ? intake.documents : []).map((id: string) => documents[id]).join(", ") || "Henüz yok"}`, `Mekânlar: ${spaces.map((s: any) => `${s.name}: ${s.count} × ${s.unitArea} m²`).join("; ") || "Uzmanla belirlenecek"}`, `Sistem ön tercihi: ${customerSystemLabels[journey.systemDecision || intake.system] || "Uzmanla belirlenecek"}`, `Bütçe: ${customerBudgetLabels[intake.budget] || "Belirlenmedi"}`, `Başlangıç: ${customerTimelineLabels[intake.timeline] || "Belirlenmedi"}`, `Öncelikler: ${(Array.isArray(intake.priorities) ? intake.priorities : []).map((id: string) => priorities[id]).join(", ")}`, "Bu bilgiler müşteri beyanıdır; mühendislik veya resmî uygunluk onayı değildir."].join("\n");
}

export function deriveCustomerJourney(project: { id: string; name: string; modules: Record<string, unknown> }) {
  const modules = project.modules;
  const intake = customerRecord(customerRecord(modules["decision-assistant"]).input);
  const saved = customerRecord(modules["customer-journey"]);
  const confirmations = customerRecord(saved.confirmations);
  const signature = customerBriefSignature(modules);
  const spaces = customerRecord(modules["architectural-program"]).spaces;
  const spaceSignature = JSON.stringify(spaces || []);
  const hasBrief = typeof intake.name === "string" && intake.name.trim().length >= 3 && typeof intake.location === "string" && intake.location.trim().length >= 2;
  const validSpaces = Array.isArray(spaces) && spaces.length > 0 && spaces.every((s: any) => typeof s.name === "string" && s.name.trim() && s.name.length <= 100 && Number.isInteger(s.count) && s.count > 0 && s.count <= 1000 && Number.isFinite(s.unitArea) && s.unitArea > 0 && s.unitArea <= 1_000_000);
  const summary = customerSubmissionText(project);
  const complete = [hasBrief, hasBrief && confirmations.land === signature, hasBrief && validSpaces && confirmations.spaces === spaceSignature, hasBrief && !!saved.systemDecision && confirmations.system === signature, hasBrief && confirmations.budget === signature, !!saved.submission?.reference && saved.submission.signature === summary];
  return { complete, count: complete.filter(Boolean).length, next: Math.max(0, complete.findIndex(done => !done) === -1 ? 5 : complete.findIndex(done => !done)), signature, spaceSignature, validSpaces, summary };
}
