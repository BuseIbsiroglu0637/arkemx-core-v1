/** Customer declarations only: never a design, quotation or regulatory decision. */
export const DIGITAL_BRIEF_SCHEMA = "ARKEM-DIGITAL-BRIEF/1.0";
export const DIGITAL_RULES_VERSION = "1.0";
export const DIGITAL_DRAFT_SCHEMA = "ARKEM-DIGITAL-DRAFT/1.0";
export const DIGITAL_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export type DigitalSubmission = { reference: string; sourceSignature: string; submittedMessage: string; submittedFields: Record<string, string>; restored?: boolean };
export const digitalGoals = [
  { id: "new", label: "Yeni bir yapı planlıyorum", detail: "İhtiyaçlarımı ve ilk hizmet adımını netleştirmek", tool: "/proje-baslat", toolLabel: "Yönlendirmeli proje hazırlığı", service: "Proje ihtiyaçlarının ve hizmet kapsamının değerlendirilmesi" },
  { id: "land", label: "Arsamı değerlendirmek istiyorum", detail: "Parselim için gerekli bilgileri ve kontrolleri görmek", tool: "/arsa-fizibilite-studyosu", toolLabel: "Arsa çalışma alanı", service: "Arsa ve yapılaşma girdilerinin ön değerlendirmesi" },
  { id: "system", label: "Yapı sistemlerini karşılaştıracağım", detail: "Önceliklerimi belirlemek; kararı uzmanla birlikte almak", tool: "/yapi-sistemi-karsilastirma", toolLabel: "Sistem karşılaştırma çalışma alanı", service: "Taşıyıcı sistem alternatiflerinin teknik değerlendirmesi" },
  { id: "manage", label: "Mevcut projemi ilerleteceğim", detail: "Dosyalarımı, açık kararlarımı ve sıradaki işi düzenlemek", tool: "/musteri-proje-portali", toolLabel: "Müşteri proje portalı", service: "Mevcut proje verilerinin ve koordinasyon ihtiyaçlarının değerlendirilmesi" },
] as const;
export type DigitalGoal = typeof digitalGoals[number]["id"];
export const digitalUsageLabels = { unknown: "Uzmanla belirleyelim", residential: "Konut / villa", industrial: "Sanayi / üretim / depo", commercial: "Ticari yapı", agricultural: "Tarımsal yapı", mixed: "Karma kullanım" } as const;
export const digitalStageLabels = { idea: "Fikir / ihtiyaç aşaması", land: "Arsa araştırması", design: "Proje / tasarım aşaması", tender: "Teklif / ihale hazırlığı", construction: "Yapım / saha aşaması", existing: "Mevcut yapı / revizyon" } as const;
export const digitalDocuments = [
  { id: "parcel", label: "Ada / parsel ve tapu bilgisi" },
  { id: "zoning", label: "İmar durumu ve plan notları" },
  { id: "survey", label: "Kotlu kroki / arazi ölçümü" },
  { id: "soil", label: "Zemin ve temel etüdü" },
  { id: "plans", label: "Mevcut proje / çizimler" },
] as const;
export type DocumentState = "unknown" | "available" | "missing";
export const digitalDocumentStateLabels: Record<DocumentState, string> = { unknown: "Durumunu bilmiyorum", available: "Bende var · henüz incelenmedi", missing: "Henüz yok" };
export type DigitalBrief = {
  schema: typeof DIGITAL_BRIEF_SCHEMA;
  goal: DigitalGoal | "";
  name: string;
  location: string;
  locationUnknown: boolean;
  usage: keyof typeof digitalUsageLabels;
  stage: keyof typeof digitalStageLabels;
  area: string;
  priority: "safety" | "cost" | "time" | "flexibility";
  notes: string;
  documents: Record<typeof digitalDocuments[number]["id"], DocumentState>;
};
export const digitalPriorityLabels = { safety: "Teknik güvenlik", cost: "Bütçe kontrolü", time: "Süre ve planlama", flexibility: "Kullanım / mimari esneklik" } as const;
export function emptyDigitalBrief(): DigitalBrief {
  return { schema: DIGITAL_BRIEF_SCHEMA, goal: "", name: "", location: "", locationUnknown: false, usage: "unknown", stage: "idea", area: "", priority: "safety", notes: "", documents: { parcel: "unknown", zoning: "unknown", survey: "unknown", soil: "unknown", plans: "unknown" } };
}
/** A draft may be incomplete or contain an area being edited; it is never a result. */
export function parseDigitalBriefDraft(value: unknown): DigitalBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (b.schema !== DIGITAL_BRIEF_SCHEMA || typeof b.goal !== "string" || (b.goal !== "" && !digitalGoals.some(g => g.id === b.goal))
    || typeof b.name !== "string" || b.name.length > 100 || typeof b.location !== "string" || b.location.length > 160
    || typeof b.locationUnknown !== "boolean" || typeof b.area !== "string" || b.area.length > 12
    || typeof b.notes !== "string" || b.notes.length > 2000 || typeof b.usage !== "string" || !Object.hasOwn(digitalUsageLabels, b.usage)
    || typeof b.stage !== "string" || !Object.hasOwn(digitalStageLabels, b.stage) || typeof b.priority !== "string" || !Object.hasOwn(digitalPriorityLabels, b.priority)
    || !b.documents || typeof b.documents !== "object" || Array.isArray(b.documents)) return null;
  const documents = b.documents as Record<string, unknown>;
  if (!digitalDocuments.every(d => typeof documents[d.id] === "string" && Object.hasOwn(digitalDocumentStateLabels, documents[d.id] as string))) return null;
  return {
    schema: DIGITAL_BRIEF_SCHEMA, goal: b.goal as DigitalBrief["goal"], name: b.name, location: b.location,
    locationUnknown: b.locationUnknown, area: b.area, notes: b.notes, usage: b.usage as DigitalBrief["usage"],
    stage: b.stage as DigitalBrief["stage"], priority: b.priority as DigitalBrief["priority"],
    documents: Object.fromEntries(digitalDocuments.map(d => [d.id, documents[d.id]])) as DigitalBrief["documents"],
  };
}
export function restoreDigitalBriefDraft(value: unknown, projectId: string, storedInput: unknown, now = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  const brief = parseDigitalBriefDraft(draft.brief);
  if (!brief || draft.projectId !== projectId || (draft.mode !== "new" && draft.mode !== "existing")) return null;
  const currentSignature = isDigitalBrief(storedInput) ? digitalBriefSignature(storedInput) : "";
  if (draft.draftSchema !== DIGITAL_DRAFT_SCHEMA) return null;
  {
    const savedAt = typeof draft.savedAt === "string" ? Date.parse(draft.savedAt) : NaN;
    if (!Number.isFinite(savedAt) || savedAt > now + 60_000 || now - savedAt > DIGITAL_DRAFT_MAX_AGE_MS) return null;
    // A draft based on another account revision must not replace the newer record.
    if (draft.mode === "existing" && draft.baseSignature !== currentSignature) return null;
  }
  const generatedAt = isDigitalBrief(brief) && draft.rulesVersion === DIGITAL_RULES_VERSION
    && typeof draft.generatedAt === "string" && Number.isFinite(Date.parse(draft.generatedAt)) ? draft.generatedAt : "";
  return { brief, mode: draft.mode, generatedAt, step: generatedAt ? 2 : brief.goal && draft.step !== 0 ? 1 : 0,
    receipt: draft.receipt, separateProject: draft.separateProject };
}
export function parseDigitalArea(value: string): number | null {
  if (!value.trim()) return null;
  // Thousands separators are deliberately unsupported: 1.200 must not silently become 1.2.
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value.trim())) return NaN;
  const area = Number(value.trim().replace(",", "."));
  return area > 0 && area <= 1_000_000 ? area : NaN;
}
export function digitalBriefErrors(brief: DigitalBrief): Partial<Record<keyof DigitalBrief, string>> {
  const errors: Partial<Record<keyof DigitalBrief, string>> = {};
  if (!digitalGoals.some(goal => goal.id === brief.goal)) errors.goal = "Önce yapmak istediğiniz işi seçin.";
  if (brief.name.trim().length < 3 || brief.name.length > 100) errors.name = "Çalışmanıza 3–100 karakterlik bir ad verin.";
  if (!brief.locationUnknown && (brief.location.trim().length < 2 || brief.location.length > 160)) errors.location = "İl / ilçe yazın veya konumun henüz belli olmadığını işaretleyin.";
  if (!Number.isFinite(parseDigitalArea(brief.area)) && brief.area.trim()) errors.area = "0'dan büyük, en fazla 1.000.000 m² girin. Binlik ayırıcı kullanmayın; örnek: 1200,5.";
  if (brief.notes.length > 2000) errors.notes = "Notlar en fazla 2.000 karakter olabilir.";
  return errors;
}
export function isDigitalBrief(value: unknown): value is DigitalBrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const b = value as DigitalBrief;
  return b.schema === DIGITAL_BRIEF_SCHEMA && typeof b.name === "string" && typeof b.location === "string" && typeof b.area === "string" && typeof b.notes === "string"
    && typeof b.locationUnknown === "boolean" && Object.hasOwn(digitalUsageLabels, b.usage) && Object.hasOwn(digitalStageLabels, b.stage) && Object.hasOwn(digitalPriorityLabels, b.priority)
    && !!b.documents && !Array.isArray(b.documents) && digitalDocuments.every(d => Object.hasOwn(digitalDocumentStateLabels, b.documents[d.id])) && Object.keys(digitalBriefErrors(b)).length === 0;
}
export function digitalBriefSignature(brief: DigitalBrief): string {
  return JSON.stringify({ schema: brief.schema, goal: brief.goal, name: brief.name.trim(), location: brief.locationUnknown ? "" : brief.location.trim(), locationUnknown: brief.locationUnknown, usage: brief.usage, stage: brief.stage, area: parseDigitalArea(brief.area), priority: brief.priority, notes: brief.notes.trim(), documents: digitalDocuments.map(d => [d.id, brief.documents[d.id]]) });
}
export function createDigitalSubmission(brief: DigitalBrief, reference: string, message: string, fields: Record<string, string> = {}): DigitalSubmission {
  return { reference, sourceSignature: digitalBriefSignature(brief), submittedMessage: message.trim().slice(0, 20000), submittedFields: Object.fromEntries(["location", "buildingType", "area", "stage", "requestType"].map(key => [key, String(fields[key] ?? "").trim().slice(0, key === "area" ? 80 : 160)])) };
}
export function restoreDigitalSubmission(value: unknown, brief: DigitalBrief): DigitalSubmission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as DigitalSubmission;
  if (typeof r.reference !== "string" || !/^[A-Za-z0-9-]{3,64}$/.test(r.reference) || r.sourceSignature !== digitalBriefSignature(brief) || typeof r.submittedMessage !== "string") return null;
  const fields = r.submittedFields && typeof r.submittedFields === "object" && !Array.isArray(r.submittedFields) ? r.submittedFields : {};
  return { ...createDigitalSubmission(brief, r.reference, r.submittedMessage, fields), restored: true };
}
export function digitalBriefOpenState(value: unknown): { step: 0 | 1 | 2; generatedAt: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { step: 0, generatedAt: "" };
  const record = value as Record<string, unknown>;
  if (!isDigitalBrief(record.input)) return { step: 0, generatedAt: "" };
  const date = record.rulesVersion === DIGITAL_RULES_VERSION && typeof record.generatedAt === "string" && Number.isFinite(Date.parse(record.generatedAt)) ? record.generatedAt : "";
  return { step: date ? 2 : 1, generatedAt: date };
}
export function digitalBriefResult(brief: DigitalBrief) {
  if (!isDigitalBrief(brief)) throw new Error("Önce çalışma bilgilerini kontrol edin.");
  const goal = digitalGoals.find(g => g.id === brief.goal)!;
  const required = brief.goal === "land" ? ["parcel", "zoning", "survey", "soil"] : brief.goal === "manage" ? ["plans", "parcel"] : ["parcel", "zoning", "soil", "plans"];
  const missing = digitalDocuments.filter(d => required.includes(d.id) && brief.documents[d.id] !== "available").map(d => ({ ...d, state: brief.documents[d.id], action: brief.documents[d.id] === "missing" ? "Temini için uzmanla kapsam belirleyin." : "Belgenin durumunu ve kaynağını netleştirin." }));
  const review = digitalDocuments.filter(d => brief.documents[d.id] === "available").map(d => d.label);
  const unknowns = [brief.locationUnknown ? "Konum" : "", !parseDigitalArea(brief.area) ? "Yaklaşık toplam yapı alanı" : "", brief.usage === "unknown" ? "Kullanım amacı" : "", ...(brief.goal === "system" ? ["Açıklıklar, katlar ve kat yüksekliği", "Vinç, ağır ekipman ve diğer özel yük ihtiyaçları", "Mimari çizimler ile statik proje / hesapların kapsamı"] : [])].filter(Boolean);
  const services = [
    { title: "Girdileri ve kapsamı netleştirme", owner: "Müşteri + ARKEM", prerequisite: "Müşteri hedefi ve mevcut bilgi / belge durumu", output: "İhtiyaçlar, belge kaynakları ve açık soruların birlikte değerlendirilmesi." },
    { title: brief.stage === "tender" ? "Teklif girdileri ve teknik kapsam değerlendirmesi" : "İlgili uzman değerlendirmesi", owner: brief.stage === "tender" ? "Teknik proje + teklif / tedarik uzmanları" : brief.goal === "land" ? "Parsel / imar ve proje uzmanları" : brief.goal === "system" ? "Taşıyıcı sistem ve proje uzmanları" : "Proje ve koordinasyon uzmanları", prerequisite: brief.stage === "tender" ? "Mevcut çizimler, şartname / kapsam listesi, teklif sınırları ve eksiklerin temin planı" : "İlk adımın kapsam ve kaynak değerlendirmesi; eksik girdilerin temin planı", output: goal.service + ". Belgeler, uygulanabilirlik ve kapsam ayrıca incelenir." + (brief.stage === "tender" ? " Teklif kapsamı, metraj dayanakları, hariç işler, malzeme şartları ve teslim koşulları açık soru listesiyle değerlendirilir; bağlayıcı teklif ayrı hazırlanır." : "") + (brief.goal === "system" ? " Birleşim ve ankrajların yük aktarımı, rijitliklerinin global model kabulleriyle uyumu ve imalat / montaj detayları ayrıca kontrol edilir." : "") },
    { title: "Hizmet ve teslim planı", owner: "Müşteri + ARKEM", prerequisite: "Uzman değerlendirmesinin bulguları ve müşterinin kapsam kararı", output: "Kapsam, gerekli teslimler, sorumlular ve takvim için mutabakat; gerekiyorsa ayrı teklif." },
  ];
  const flags = ["Beyan edilen belgelerin içeriği, güncelliği ve resmî kaynağı henüz doğrulanmadı.", "Sistem seçimi; zemin, mimari ihtiyaç, deprem, yangın, bağlantılar ve yapım koşulları birlikte incelenmeden kesinleştirilmez.", ...(brief.stage === "construction" ? ["Şantiye ve montaja başlamadan önce geçici destek / kalıp iskelesi, montaj sırası ve stabilitesi, yapım aşaması yükleri, kaldırma planı ve iş güvenliği; nihai yapı hesabından ayrı yetkili uzman değerlendirmesi gerektirir."] : []), ...(brief.stage === "existing" ? ["Mevcut yapı için yerinde inceleme ve mevcut proje / ölçüm verileri gerekir; bu dosya güvenlik veya yıkım yöntemi kararı vermez."] : [])];
  if (brief.goal === "land") flags.push("Parsel geometrisi, ölçüm kaynağı / tarihi ve koordinat sistemi / datum bilinmeden hassas yerleşim veya yapılaşma kararı verilmez; resmî imar ve zemin verileri ayrıca incelenir.");
  if (brief.priority === "cost" || brief.priority === "time" || brief.stage === "tender") flags.push("Malzeme şartnamesi, kalite kabul belgeleri, tedarik süreleri ve teslim koşulları kapsam teyidinde ayrıca ele alınır; fiyat veya termin varsayımı yapılmaz.");
  if (brief.priority === "cost") flags.push("Bütçe önceliği müşteri hedefidir; bu dosya maliyet, nakit akışı, yatırım getirisi veya finansman uygunluğu hesabı üretmez.");
  if (brief.stage === "construction") flags.push("Bu dosya çalışma izni, kaldırma onayı veya güvenli uygulama talimatı değildir; saha yöntemi ve İSG izinleri yetkili kişilerce ayrıca hazırlanır ve teyit edilir.");
  return { goal, area: parseDigitalArea(brief.area), missing, review, unknowns, services, flags, method: "rule-based-user-declarations" as const };
}
export function digitalBriefText(brief: DigitalBrief, generatedAt: string): string {
  const r = digitalBriefResult(brief);
  // Customer-authored newlines must not impersonate report sections in PDF/text output.
  const copy = (value: string) => value.replace(/\s+/g, " ").trim();
  brief = { ...brief, name: copy(brief.name), location: copy(brief.location), notes: copy(brief.notes) };
  return ["ARKEM YAPI SİSTEMLERİ · ÖN GÖRÜŞME DOSYASI", `Çalışma: ${brief.name.trim()}`, `Hazırlanma: ${new Date(generatedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} (Türkiye saati)`, `Şema: ${DIGITAL_BRIEF_SCHEMA}`, "", "1. HEDEF VE MÜŞTERİ BEYANLARI", r.goal.label, `Konum: ${brief.locationUnknown ? "Henüz belli değil" : brief.location.trim()}`, `Kullanım: ${digitalUsageLabels[brief.usage]}`, `Aşama: ${digitalStageLabels[brief.stage]}`, `Yaklaşık toplam alan: ${r.area === null ? "Uzmanla belirlenecek" : `${r.area.toLocaleString("tr-TR")} m²`}`, `Öncelik: ${digitalPriorityLabels[brief.priority]}`, ...(brief.notes.trim() ? [`Müşteri notu: ${brief.notes.trim()}`] : []), "", "2. BELGE DURUMLARI (MÜŞTERİ BEYANI)", ...digitalDocuments.map(d => `${d.label}: ${digitalDocumentStateLabels[brief.documents[d.id]]}`), "", "3. NETLEŞMESİ GEREKENLER", ...r.unknowns.map(u => `Bilgi: ${u}`), ...r.missing.map(d => `${d.label}: ${digitalDocumentStateLabels[d.state]}. ${d.action}`), ...(r.review.length ? [`İçerik ve kaynak incelemesi bekleyen belgeler: ${r.review.join("; ")}`] : ["Henüz incelenmiş belge bulunmuyor."]), "", "4. ÖNERİLEN HİZMET AKIŞI", ...r.services.map((s, i) => `${i + 1}. ${s.title} (${s.owner})\n   Ön koşul: ${s.prerequisite}\n   Beklenen çalışma: ${s.output}`), "", "5. SINIRLAR VE UZMAN KONTROLLERİ", ...r.flags, "Bu dosya yanıtlarınıza göre kurallı ön yönlendirmedir; uzman değerlendirmesi yapılmış değildir. Ruhsat, statik hesap, güvenlik kararı, bağlayıcı fiyat, kesin takvim veya iş kabulü yerine geçmez. Hizmet kapsamı ve teslimler ayrıca teyit edilir."].join("\n");
}
