export type GuidedProjectType = "new" | "existing" | "demolition";
export type GuidedProjectUsage = "residential" | "industrial" | "commercial" | "agricultural" | "mixed";
export type GuidedStructuralSystem = "undecided" | "concrete" | "precast" | "steel" | "light" | "hybrid";
export type GuidedParcelStatus = "unknown" | "searching" | "identified" | "verified";
export type GuidedBudget = "undecided" | "under-five" | "five-fifteen" | "fifteen-fifty" | "over-fifty";
export type GuidedTimeline = "urgent" | "six-months" | "twelve-months" | "flexible";
export type GuidedExperienceMode = "guided" | "technical";
export type GuidedDocumentId = "title-deed" | "parcel-id" | "zoning" | "survey" | "soil" | "existing-plan";

export type GuidedProjectIntake = {
  name: string;
  projectType: GuidedProjectType;
  usage: GuidedProjectUsage;
  location: string;
  parcelStatus: GuidedParcelStatus;
  targetArea: number;
  floors: number;
  floorHeight: number;
  system: GuidedStructuralSystem;
  priorities: string[];
  budget: GuidedBudget;
  timeline: GuidedTimeline;
  documents: GuidedDocumentId[];
  experienceMode: GuidedExperienceMode;
};

export type GuidedGateStatus =
  | "complete"
  | "ready"
  | "missing"
  | "official-review"
  | "client-decision"
  | "expert-review"
  | "analysis";

export type GuidedJourneyGate = {
  id: "brief" | "parcel" | "zoning" | "architecture" | "system" | "budget" | "coordination" | "delivery";
  label: string;
  detail: string;
  status: GuidedGateStatus;
  route: string;
};

export type GuidedProjectRoadmap = {
  schema: "ARKEM-GUIDED-JOURNEY/1.0";
  readiness: number;
  gates: GuidedJourneyGate[];
  nextAction: {
    title: string;
    copy: string;
    route: string;
  };
  missingDocuments: string[];
  verificationItems: string[];
  policy: {
    userDeclarationsAreNotOfficialData: true;
    officialZoningRequiresEvidence: true;
    engineeringOutputsRequireExpertReview: true;
  };
};

export const GUIDED_DOCUMENT_OPTIONS: ReadonlyArray<{ id: GuidedDocumentId; label: string; short: string }> = [
  { id: "title-deed", label: "Tapu veya malik bilgisi", short: "Tapu" },
  { id: "parcel-id", label: "Ada / parsel ya da koordinat", short: "Parsel" },
  { id: "zoning", label: "İmar durumu / plan notu", short: "İmar" },
  { id: "survey", label: "Aplikasyon / kotlu kroki", short: "Harita" },
  { id: "soil", label: "Zemin ve temel etüdü", short: "Zemin" },
  { id: "existing-plan", label: "Mevcut proje / rölöve / eskiz", short: "Proje" },
];

export const GUIDED_GATE_LABELS: Record<GuidedGateStatus, string> = {
  complete: "Tamamlandı",
  ready: "Sonraki aşamaya hazır",
  missing: "Eksik bilgi var",
  "official-review": "Resmî doğrulama bekliyor",
  "client-decision": "Müşteri kararı bekliyor",
  "expert-review": "Arkem uzmanı incelemeli",
  analysis: "ARKEMX analizi bekliyor",
};

function hasDocument(intake: GuidedProjectIntake, id: GuidedDocumentId) {
  return intake.documents.includes(id);
}

function calculateReadiness(intake: GuidedProjectIntake) {
  const parcelKnown = intake.parcelStatus === "identified" || intake.parcelStatus === "verified";
  const score = 10
    + (intake.name.trim().length >= 3 ? 8 : 0)
    + (intake.location.trim().length >= 2 ? 8 : 0)
    + (parcelKnown ? 10 : 0)
    + (intake.parcelStatus === "verified" ? 8 : 0)
    + (intake.targetArea > 0 && intake.floors > 0 ? 15 : 0)
    + (intake.priorities.length > 0 ? 8 : 0)
    + (intake.system !== "undecided" ? 8 : 0)
    + (intake.budget !== "undecided" ? 8 : 0)
    + (intake.timeline !== "flexible" ? 5 : 0)
    + Math.min(12, intake.documents.length * 3);
  return Math.min(100, score);
}

export function deriveGuidedProjectRoadmap(intake: GuidedProjectIntake): GuidedProjectRoadmap {
  const parcelKnown = intake.parcelStatus === "identified" || intake.parcelStatus === "verified";
  const parcelVerified = intake.parcelStatus === "verified";
  const zoningProvided = hasDocument(intake, "zoning");
  const requiredDocuments: GuidedDocumentId[] = intake.projectType === "demolition"
    ? ["title-deed", "parcel-id", "existing-plan"]
    : intake.projectType === "existing"
      ? ["title-deed", "parcel-id", "zoning", "existing-plan"]
      : ["title-deed", "parcel-id", "zoning"];
  const missingDocuments = requiredDocuments
    .filter((id) => !hasDocument(intake, id))
    .map((id) => GUIDED_DOCUMENT_OPTIONS.find((item) => item.id === id)?.label ?? id);

  const verificationItems = [
    ...(parcelKnown ? ["Ada / parsel numarası — başlangıç formunda henüz girilmedi."] : []),
    ...(parcelKnown ? ["Resmî parsel geometrisi — doğrulama bekliyor."] : []),
    ...(hasDocument(intake, "parcel-id")
      ? ["Parsel kaynağı — mevcut olarak beyan edildi; içerik ve resmî kimlik doğrulanacak."]
      : parcelKnown
        ? ["Parsel kimliği / koordinat kaynağı — eksik."]
        : []),
    ...(!zoningProvided && parcelKnown
      ? ["İmar durumu / plan notları — resmî kaynaktan doğrulama bekliyor."]
      : []),
    ...(intake.projectType === "new"
      ? ["Zemin / temel etüdü — taşıyıcı sistem kararı öncesinde gerekliliği değerlendirilecek."]
      : []),
  ];

  const gates: GuidedJourneyGate[] = [
    {
      id: "brief",
      label: "İhtiyaç ve yatırım hedefi",
      detail: "Kullanım, alan, öncelik ve çalışma türü müşteri beyanıyla kaydedildi.",
      status: intake.name.trim().length >= 3 ? "complete" : "missing",
      route: "/proje-baslat",
    },
    {
      id: "parcel",
      label: parcelKnown ? "Parsel ve arazi kimliği" : "Arsa araştırması ve aday seçimi",
      detail: parcelVerified
        ? "Ada / parsel bilgisinin hazır olduğu kullanıcı tarafından beyan edildi; numara ve resmî geometri bu başlangıç adımında doğrulanmış sayılmaz."
        : parcelKnown
          ? "Parsel biliniyor; koordinatlı sınır ve resmî kimlik kontrol edilmelidir."
          : "Yatırım kriterleriyle aday arsalar araştırılır; seçilen adayın parsel kimliği ve sınırı sonraki aşamada doğrulanır.",
      status: parcelKnown ? "official-review" : "missing",
      route: parcelKnown ? "/arsa-fizibilite-studyosu?stage=locate#geo-studyo" : "/arsa-arastirma",
    },
    {
      id: "zoning",
      label: "İmar ve plan koşulları",
      detail: zoningProvided
        ? "Belge mevcut olarak işaretlendi; TAKS, KAKS, Hmax, nizam ve çekmeler kaynağından okunmalıdır."
        : "Resmî plan, belediye/e-Plan kaynağı veya imar belgesi henüz eklenmedi.",
      status: zoningProvided ? "expert-review" : "official-review",
      route: "/arsa-fizibilite-studyosu?stage=zoning#geo-studyo",
    },
    {
      id: "architecture",
      label: "Mimari ihtiyaç programı",
      detail: `${intake.targetArea.toLocaleString("tr-TR")} m² ve ${intake.floors} kat hedefi mimari programa aktarılmaya hazır.`,
      status: intake.targetArea > 0 && intake.floors > 0 ? "ready" : "missing",
      route: "/mimari-program-studyosu",
    },
    {
      id: "system",
      label: "Yapı sistemi kararı",
      detail: intake.system === "undecided"
        ? "Betonarme, prefabrik, çelik, hafif çelik ve hibrit alternatifler karşılaştırılmalıdır."
        : "Ön sistem tercihi girildi; zemin, açıklık, deprem, yangın, üretim ve maliyetle doğrulanmalıdır.",
      status: intake.system === "undecided" ? "analysis" : "expert-review",
      route: "/sistem-karsilastirma",
    },
    {
      id: "budget",
      label: "Bütçe ve hedef süre",
      detail: intake.budget === "undecided"
        ? "Bütçe aralığı müşteriyle netleştirilerek metraj ve alternatif senaryoya bağlanmalıdır."
        : "Bütçe ve zaman hedefi ön fizibilite hesabına aktarılmaya hazır.",
      status: intake.budget === "undecided" ? "client-decision" : "expert-review",
      route: "/proje-takibi",
    },
    {
      id: "coordination",
      label: "Mühendislik koordinasyonu",
      detail: "Mimari, taşıyıcı ve tesisat verileri oluştukça aks, kot, şaft ve çakışma kontrolleri açılır.",
      status: "expert-review",
      route: "/bim-koordinasyon",
    },
    {
      id: "delivery",
      label: "Bilgi teslim planı ve kapanış",
      detail: "Doğrulanan brief, koordinasyon kayıtları ve teknik çıktılar teslim gereksinimleriyle eşleştirilir.",
      status: "expert-review",
      route: "/bilgi-teslim-plani",
    },
  ];

  const nextAction = intake.projectType === "demolition"
    ? {
      title: "Mevcut yapı ve çevre risklerini tanımlayın",
      copy: "Yıkım yöntemine geçmeden önce taşıyıcı sistem, komşu mesafeleri, kullanım ve belge durumu kaydedilir.",
      route: "/yikim-karar-studyosu",
    }
    : !parcelKnown
      ? {
        title: "Kriterlerinize göre aday arsaları araştırın",
        copy: "Bölge, arsa bütçesi ve alan kriterlerini belirleyin. ARKEMX kaynaklarda adayları araştırır; kısa listeye alınan adaylar parsel ve imar incelemesine geçer.",
        route: "/arsa-arastirma",
      }
      : {
        title: "Parsel ve imar kanıtını doğrulayın",
        copy: zoningProvided
          ? "Beyan edilen parsel bilgisini, resmî sınırı ve mevcut imar belgesini kaynağıyla doğrulayın."
          : "Resmî parsel sınırı ile ulaşılabilen plan ve belediye kaynaklarını tek kanıt zincirinde kontrol edin.",
        route: "/arsa-fizibilite-studyosu?stage=locate#geo-studyo",
      };

  return {
    schema: "ARKEM-GUIDED-JOURNEY/1.0",
    readiness: calculateReadiness(intake),
    gates,
    nextAction,
    missingDocuments,
    verificationItems,
    policy: {
      userDeclarationsAreNotOfficialData: true,
      officialZoningRequiresEvidence: true,
      engineeringOutputsRequireExpertReview: true,
    },
  };
}
