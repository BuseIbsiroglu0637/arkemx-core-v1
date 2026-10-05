import { buildMcdaProjectSnapshot, mcdaInputMatchesSource, mcdaSourceKey, mcdaSourceMatches, type McdaSourceSnapshot } from "./mcda-source.ts";
import { assessLandCandidate, readLandResearch } from "./land-research.ts";

export type ProjectModuleKey =
  | "decision-assistant"
  | "geo-parcel"
  | "quick-site-scenario"
  | "architectural-program"
  | "plan-editor"
  | "system-comparison"
  | "structural-concept"
  | "engineering-coordination"
  | "digital-delivery-scope"
  | "arkem-x"
  | "project-os"
  | "model-library-review"
  | "demolition-screening";

export type ProjectModuleDefinition = {
  id: ProjectModuleKey;
  code: string;
  label: string;
  discipline: string;
  stage: "Tanım" | "Arsa" | "Tasarım" | "Koordinasyon" | "Teslim";
  route: string;
  output: string;
  dependencies: ProjectModuleKey[];
};

export type ProjectGraphNode = ProjectModuleDefinition & {
  active: boolean;
  readiness: number;
  blockedBy: ProjectModuleKey[];
  status: string;
  milestoneComplete: boolean;
};

export type ProjectThreadIssue = {
  id: string;
  severity: "critical" | "review" | "info";
  discipline: string;
  title: string;
  evidence: string;
  action: string;
  route: string;
  routeLabel?: string;
  secondaryRoute?: string;
  secondaryRouteLabel?: string;
};

export type CompletedControl = {
  code: string;
  title: string;
  summary: string;
  routeLabel: string;
  route: string;
};

export type ProjectHandoff = {
  id: string;
  source: ProjectModuleKey;
  target: ProjectModuleKey;
  label: string;
  payload: string[];
  state: "ready" | "waiting" | "conflict";
};

export const PROJECT_MODULES: ProjectModuleDefinition[] = [
  { id: "decision-assistant", code: "PIR", label: "Yatırım briefi", discipline: "İşveren / PM", stage: "Tanım", route: "/proje-karar-asistani#karar-motoru", output: "İhtiyaç, öncelik ve veri hazırlığı", dependencies: [] },
  { id: "geo-parcel", code: "GIS", label: "Parsel & bağlam", discipline: "GIS / Planlama", stage: "Arsa", route: "/arsa-fizibilite-studyosu?stage=zoning&focus=source#geo-studyo", output: "Koordinatlı sınır, planlama ve kütle", dependencies: [] },
  { id: "quick-site-scenario", code: "MAS", label: "Yapı yerleşimi", discipline: "Planlama", stage: "Arsa", route: "/arsa-fizibilite-studyosu?stage=design#geo-studyo", output: "İmar koşullarına uyan kavramsal yerleşim", dependencies: ["geo-parcel"] },
  { id: "architectural-program", code: "ARC", label: "Mimari program", discipline: "Mimari", stage: "Tasarım", route: "/mimari-program-studyosu", output: "Mahal programı, zonlama ve kabuk", dependencies: ["geo-parcel"] },
  { id: "plan-editor", code: "BIM", label: "Plan & aks modeli", discipline: "Mimari", stage: "Tasarım", route: "/plan-ve-aks", output: "Kat, aks, mahal, çekirdek ve plan koordinasyonu", dependencies: ["architectural-program"] },
  { id: "system-comparison", code: "MCDA", label: "Sistem seçimi", discipline: "Yapı mühendisliği", stage: "Tasarım", route: "/sistem-karsilastirma", output: "Gerekçeli taşıyıcı sistem kısa listesi", dependencies: ["geo-parcel", "architectural-program"] },
  { id: "structural-concept", code: "STR", label: "Taşıyıcı ön tasarım", discipline: "Yapı mühendisliği", stage: "Tasarım", route: "/tasiyici-on-tasarim", output: "Geometri, yük izi, kontrol ve metraj", dependencies: ["plan-editor", "system-comparison"] },
  { id: "engineering-coordination", code: "ICE", label: "Disiplin koordinasyonu", discipline: "Mimari / Statik / MEP", stage: "Koordinasyon", route: "/bim-koordinasyon", output: "Çakışma, kot, şaft ve issue kaydı", dependencies: ["architectural-program", "plan-editor", "structural-concept"] },
  { id: "digital-delivery-scope", code: "BEP", label: "Bilgi teslim planı", discipline: "BIM / PM", stage: "Koordinasyon", route: "/bilgi-teslim-plani", output: "Bilgi gereksinimi ve karar kapıları", dependencies: ["decision-assistant"] },
  { id: "arkem-x", code: "LCA", label: "Performans laboratuvarı", discipline: "Karbon / DfMA / AIM", stage: "Koordinasyon", route: "/performans-laboratuvari", output: "Karbon, üretim, saha ve pasaport", dependencies: ["structural-concept"] },
  { id: "project-os", code: "CDE", label: "Proje OS", discipline: "PM / Yapım", stage: "Teslim", route: "/proje-takibi", output: "Program, karar, maliyet ve teslim", dependencies: ["digital-delivery-scope", "engineering-coordination"] },
  { id: "model-library-review", code: "3DM", label: "3B model inceleme", discipline: "BIM / Görselleştirme", stage: "Teslim", route: "/3b-model-kutuphanesi#model-kutuphanesi", output: "Model inceleme ve revizyon notu", dependencies: ["plan-editor"] },
  { id: "demolition-screening", code: "DEM", label: "Yıkım risk modeli", discipline: "Yıkım mühendisliği", stage: "Arsa", route: "/yikim-karar-studyosu#yikim-motoru", output: "Yöntem ön eleme ve risk kaydı", dependencies: ["geo-parcel"] },
];

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function firstRecord(value: unknown) {
  return Array.isArray(value) ? record(value[0]) : {};
}

function structuralSystemLabel(value: string) {
  return ({ concrete: "Betonarme", steel: "Yapısal Çelik", light: "Hafif Çelik", hybrid: "Karma Sistem", precast: "Betonarme Prefabrik" } as Record<string, string>)[value] ?? value;
}

function structuralSystemId(value: string) {
  const normalized = value.trim().toLocaleLowerCase("tr-TR");
  if (normalized === "light" || normalized.includes("hafif")) return "light";
  if (normalized === "hybrid" || normalized.includes("karma")) return "hybrid";
  if (normalized === "precast" || normalized.includes("prefabrik")) return "precast";
  if (normalized === "steel" || normalized.includes("çelik")) return "steel";
  if (normalized === "concrete" || normalized.includes("beton")) return "concrete";
  return normalized;
}

function resolvedStructuralSystem(value: string) {
  const normalized = value.trim().toLocaleLowerCase("tr-TR");
  return Boolean(normalized)
    && !["karar bekleniyor", "undecided", "belirsiz", "—", "-"].includes(normalized);
}

function closeEnough(first: number, second: number, tolerance: number) {
  return first > 0 && second > 0 && Math.abs(first - second) <= tolerance;
}

export function deriveProjectThread(modules: Record<string, unknown>) {
  const brief = record(modules["decision-assistant"]);
  const briefInput = record(brief.input);
  const research = readLandResearch(brief.landResearch);
  const selectedCandidate = research?.shortlist.find(candidate => candidate.id === research.selectedId);
  const selectedCandidateReady = Boolean(research && selectedCandidate && assessLandCandidate(selectedCandidate, research.criteria).mismatch.length === 0);
  const needsLandResearch = briefInput.projectType !== "demolition" && ["unknown", "searching"].includes(text(briefInput.parcelStatus));
  const geo = record(modules["geo-parcel"]);
  const geoMetrics = record(geo.metrics);
  const geoPlanning = record(geo.planning);
  const geoParcelRecord = record(geo.parcelRecord);
  const geoParcelGeometry = record(geoParcelRecord.geometry);
  const geoZoningProvenance = record(geo.zoningProvenance);
  const geoZoningSource = record(geoZoningProvenance.source);
  const geoZoningExpertReview = record(geoZoningProvenance.expertReview);
  const geoZoningPlan = record(geoZoningProvenance.plan);
  const geoZoningConditions = record(geoZoningProvenance.conditions);
  const geoZoningSetbacks = record(geoZoningConditions.setbacks);
  const parcelReadyForNextStage = (
    geoParcelRecord.projectEligible === true
    && geoParcelGeometry.valid === true
  ) || (
    geoMetrics.geometryValid === true
    && number(geoMetrics.area) > 0
  );
  const zoningConditionsReadyForNextStage = Boolean(
    text(geoZoningPlan.scale)
    && text(geoZoningConditions.buildingOrder)
    && number(geoZoningConditions.taks, -1) >= 0
    && number(geoZoningConditions.kaks, -1) >= 0
    && number(geoZoningConditions.hmax, -1) >= 0
    && number(geoZoningSetbacks.front, -1) >= 0
    && number(geoZoningSetbacks.side, -1) >= 0
    && number(geoZoningSetbacks.rear, -1) >= 0
  );
  const zoningSourceReferenceReady = Boolean(
    text(geoZoningSource.document)
    || text(geoZoningSource.url)
    || text(geoZoningPlan.planId)
    || (text(geoZoningSource.type) === "Kullanıcı beyanı" && text(geoZoningSource.note))
  );
  const zoningSourceReadyForNextStage = Boolean(
    text(geoZoningSource.type)
    && text(geoZoningSource.date)
    && zoningSourceReferenceReady
  );
  const zoningAuthoritative = geoZoningProvenance.authoritative === true;
  const zoningExpertReviewed = zoningAuthoritative || geoZoningProvenance.expertReviewed === true;
  const zoningReadyForNextStage = zoningConditionsReadyForNextStage && zoningSourceReadyForNextStage;
  const architecture = record(modules["architectural-program"]);
  const architectureInput = record(architecture.input);
  const architectureResult = record(architecture.result);
  const architectureSpaces = Array.isArray(architecture.spaces) ? architecture.spaces : [];
  const architectureTargetGross = number(architectureInput.targetGross);
  const architectureProgramGross = number(architectureResult.grossDemand);
  const architectureRequirementsConfirmed = architectureInput.programRequirementsConfirmed === true;
  const architectureJourneyReady = architectureTargetGross > 0
    && architectureProgramGross > 0
    && architectureSpaces.length > 0
    && architectureRequirementsConfirmed
    && Math.abs(architectureProgramGross - architectureTargetGross) / architectureTargetGross <= .1;
  const plan = record(modules["plan-editor"]);
  const planMetrics = record(plan.metrics);
  // Legacy plan snapshots lack explicit provenance flags. Only entered mass
  // zones AND placed columns/walls can support a conceptual KM-KR estimate.
  // A fallback to the geometric plate centre is never evidence of rigidity.
  const massBasis = planMetrics.massPointCount !== undefined
    ? number(planMetrics.massPointCount) > 0
    : number(planMetrics.rooms) > 0 || number(planMetrics.totalLiveLoad) > 0;
  const rigidityBasis = planMetrics.rigidityPointCount !== undefined
    ? number(planMetrics.rigidityPointCount) > 0
    : number(planMetrics.columns) > 0 || number(planMetrics.walls) > 0;
  const eccentricityEvaluable = planMetrics.eccentricityEvaluable === false
    ? false : massBasis && rigidityBasis;

  const structure = record(modules["structural-concept"]);
  const structureInput = record(structure.input);
  const structureResult = record(structure.result);
  const structureGeometry = record(structureResult.geometry);
  const structureLoads = record(structureResult.loads);
  const structureQuantities = record(structureResult.quantities);
  const comparison = record(modules["system-comparison"]);
  const comparisonInput = record(comparison.input);
  const comparisonSourceSnapshot = record(comparison.sourceSnapshot);
  const comparisonWinner = firstRecord(comparison.ranking);
  const comparisonDecision = record(comparison.decision);
  const coordination = record(modules["engineering-coordination"]);
  const coordinationResult = record(coordination.result);
  const delivery = record(modules["digital-delivery-scope"]);
  const deliveryResult = record(delivery.result);
  const projectOs = record(modules["project-os"]);

  const planWidth = number(plan.baysX) * number(plan.spanX);
  const planDepth = number(plan.baysY) * number(plan.spanY);
  const planGross = number(planMetrics.floorArea) * number(plan.floorCount);
  const geoGross = number(geoMetrics.gross);
  const architectureGross = number(architectureResult.grossDemand) || number(architectureInput.targetGross);
  const structuralGross = number(structureGeometry.totalArea);
  const floors = number(plan.floorCount) || number(architectureInput.floors) || number(geo.floors) || number(structureInput.floors);
  const floorHeight = number(structureInput.floorHeight) || number(geo.floorHeight) || number(architectureInput.floorHeight);
  const grossArea = architectureGross || planGross || geoGross || structuralGross;
  const currentMcdaSource = buildMcdaProjectSnapshot({
    use: text(architectureInput.use) || text(geo.usage),
    floors,
    grossArea,
    spanX: number(plan.spanX) || number(structureGeometry.spanX),
    spanY: number(plan.spanY) || number(structureGeometry.spanY),
  });
  const hasStoredMcdaSource = Boolean(Object.keys(comparisonSourceSnapshot).length);
  const mcdaSourceCurrent = currentMcdaSource
    ? hasStoredMcdaSource
      ? mcdaSourceMatches(comparisonSourceSnapshot as McdaSourceSnapshot, currentMcdaSource)
        && mcdaInputMatchesSource(comparisonInput, currentMcdaSource)
      : mcdaInputMatchesSource(comparisonInput, currentMcdaSource)
    : true;
  const currentMcdaSourceKey = mcdaSourceKey(currentMcdaSource);
  const comparisonHasResult = Boolean(
    Object.keys(comparisonInput).length
    || (Array.isArray(comparison.ranking) && comparison.ranking.length)
  );
  const footprint = number(planMetrics.floorArea) || number(geoMetrics.footprint) || number(structureGeometry.floorArea);
  const width = planWidth || number(geo.buildingWidth) || number(structureInput.width) || number(architectureResult.plateWidth);
  const depth = planDepth || number(geo.buildingDepth) || number(structureInput.depth) || number(architectureResult.plateDepth);
  // Arazi/Yapı Yerleşimi taşıyıcı sistem kararı üretmez. Yapısal sistem
  // yalnız yapı sistemi karşılaştırması veya taşıyıcı ön tasarım kaynaklarından gelir.
  const system = structuralSystemLabel(text(structureInput.system) || (mcdaSourceCurrent ? text(comparisonWinner.name) : ""));
  const modeledSystemId = structuralSystemId(text(structureInput.system));
  const recommendedSystemId = mcdaSourceCurrent
    ? structuralSystemId(text(comparisonWinner.id) || text(comparisonWinner.name))
    : "";
  const systemMismatch = Boolean(modeledSystemId && recommendedSystemId && modeledSystemId !== recommendedSystemId);
  const systemDecisionRecorded = Boolean(
    mcdaSourceCurrent
    && text(comparisonDecision.status) === "recorded"
    && structuralSystemId(text(comparisonDecision.selectedSystem)) === modeledSystemId
    && structuralSystemId(text(comparisonDecision.recommendedSystem)) === recommendedSystemId
    && text(comparisonDecision.mcdaSourceKey) === currentMcdaSourceKey
    && text(comparisonDecision.rationale).trim().length >= 10
    && text(comparisonDecision.decidedBy).trim()
    && text(comparisonDecision.role).trim()
    && text(comparisonDecision.date).trim()
  );

  const canonical = {
    site: {
      reference: text(geo.reference, "Parsel tanımlanmadı"),
      crs: text(geo.sourceCrs, "Koordinat sistemi tanımlanmadı"),
      dataStatus: text(geo.dataStatus, "Kaynak doğrulanmadı"),
      parcelArea: number(geoMetrics.area),
      parcelPerimeter: number(geoMetrics.perimeter),
      allowedFootprint: number(geoMetrics.allowedFootprint),
      allowedGross: number(geoMetrics.allowedGross),
      maxHeight: number(geoPlanning.maxHeight),
      proposedFootprint: footprint,
      proposedGross: grossArea,
      setbackPass: geoMetrics.setbackPass === true,
      geometryValid: geoMetrics.geometryValid === true,
    },
    architecture: {
      use: text(architectureInput.use) || text(geo.usage) || text(comparisonInput.usage),
      floors,
      floorHeight,
      grossArea,
      netArea: number(architectureResult.netArea),
      efficiency: number(architectureResult.efficiency),
      occupants: number(architectureResult.occupants),
      plateWidth: number(architectureResult.plateWidth) || width,
      plateDepth: number(architectureResult.plateDepth) || depth,
      daylightCoverage: number(architectureResult.daylightCoverage),
      travelDistance: number(architectureResult.travelDistance),
      targetTravel: number(architectureInput.targetTravel),
    },
    structure: {
      system,
      width,
      depth,
      baysX: number(plan.baysX) || number(structureInput.baysX),
      baysY: number(plan.baysY) || number(structureInput.baysY),
      spanX: number(plan.spanX) || number(structureGeometry.spanX),
      spanY: number(plan.spanY) || number(structureGeometry.spanY),
      beamDepth: number(structureInput.beamDepth),
      slabThickness: number(structureInput.slabThickness),
      permanentLoad: number(structureLoads.permanentLoad),
      liveLoad: number(structureLoads.variableLoad),
      factoredGravity: number(structureLoads.totalFactoredGravity),
      concreteVolume: number(structureQuantities.concreteVolume),
      steelTonnage: number(structureQuantities.steelTonnage),
      reinforcementTonnage: number(structureQuantities.reinforcementTonnage),
      openingRatio: number(planMetrics.openingRatio),
      eccentricityRatio: number(planMetrics.eccentricityRatio),
      recommendedSystem: mcdaSourceCurrent ? text(comparisonWinner.name) : "",
      recommendationScore: mcdaSourceCurrent ? number(comparisonWinner.score) : 0,
    },
    coordination: {
      clearHeight: number(coordinationResult.clearHeight),
      shaftRatio: number(coordinationResult.shaftRatio),
      bearingUtilization: number(coordinationResult.bearingUtilization),
      rainwaterFlow: number(coordinationResult.rainwaterFlow),
      openIssues: number(coordinationResult.openIssues),
    },
    delivery: {
      informationMaturity: number(deliveryResult.informationMaturity),
      activeCapabilities: number(deliveryResult.active),
      projectHealth: number(projectOs.projectHealth),
      week: number(projectOs.week),
      status: text(projectOs.status, "Proje OS kaydı yok"),
    },
  };

  const systemDecisionReady = resolvedStructuralSystem(canonical.structure.system);
  const quickSiteScenarioReady = Boolean(
    parcelReadyForNextStage
    && zoningConditionsReadyForNextStage
    && geoMetrics.geometryValid === true
    && geoMetrics.buildingFits === true
    && geoMetrics.setbackPass === true
    && number(geoMetrics.footprint) > 0
    && number(geoMetrics.gross) > 0
    && number(geoMetrics.allowedFootprint) > 0
    && number(geoMetrics.allowedGross) > 0
    && number(geoMetrics.footprint) <= number(geoMetrics.allowedFootprint) + .01
    && number(geoMetrics.gross) <= number(geoMetrics.allowedGross) + .01
    && number(geoMetrics.buildingHeight) > 0
    && number(geoPlanning.maxHeight) > 0
    && number(geoMetrics.buildingHeight) <= number(geoPlanning.maxHeight) + .01
  );

  const footprintSource = number(planMetrics.floorArea) > 0
    ? { label: "Plan & aks modeli", route: "/tasarim-calismalari/plan-duzeltme", actionLabel: "Plan tabanını düzelt" }
    : number(geoMetrics.footprint) > 0
      ? { label: "Yapı Yerleşimi", route: "/arsa-fizibilite-studyosu?stage=design#geo-studyo", actionLabel: "Kütleyi düzelt" }
      : number(structureGeometry.floorArea) > 0
        ? { label: "Taşıyıcı ön tasarım", route: "/tasiyici-on-tasarim", actionLabel: "Taşıyıcı tabanını düzelt" }
        : { label: "Bilinmeyen kaynak", route: "/arsa-fizibilite-studyosu?stage=design#geo-studyo", actionLabel: "Kütleyi incele" };

  const grossSource = architectureGross > 0
    ? { label: "Mimari program", route: "/mimari-program-studyosu/kaks-duzeltme", actionLabel: "Programı düzelt" }
    : planGross > 0
      ? { label: "Plan & aks modeli", route: "/tasarim-calismalari#plan-editor", actionLabel: "Plan alanını düzelt" }
      : geoGross > 0
        ? { label: "Yapı Yerleşimi", route: "/arsa-fizibilite-studyosu?stage=design#geo-studyo", actionLabel: "Kütleyi düzelt" }
        : { label: "Taşıyıcı ön tasarım", route: "/tasiyici-on-tasarim", actionLabel: "Taşıyıcı alanını düzelt" };

  const floorCountSource = number(plan.floorCount) > 0
    ? { label: "Plan & aks modeli", route: "/tasarim-calismalari/yukseklik-duzeltme", actionLabel: "Kat adedini düzelt" }
    : number(architectureInput.floors) > 0
      ? { label: "Mimari program", route: "/tasarim-calismalari/yukseklik-duzeltme", actionLabel: "Kat adedini düzelt" }
      : number(geo.floors) > 0
        ? { label: "Yapı Yerleşimi", route: "/tasarim-calismalari/yukseklik-duzeltme", actionLabel: "Kat adedini düzelt" }
        : { label: "Taşıyıcı ön tasarım", route: "/tasarim-calismalari/yukseklik-duzeltme", actionLabel: "Kat adedini düzelt" };

  const floorHeightSource = number(structureInput.floorHeight) > 0
    ? "Taşıyıcı ön tasarım"
    : number(geo.floorHeight) > 0
      ? "Yapı Yerleşimi"
      : number(architectureInput.floorHeight) > 0
        ? "Mimari program"
        : "Bilinmeyen kaynak";

  const issues: ProjectThreadIssue[] = [];
  const push = (issue: ProjectThreadIssue) => issues.push(issue);
  if (geoMetrics.geometryValid === false) push({ id: "GIS-001", severity: "critical", discipline: "GIS", title: "Parsel geometrisi geçerli değil", evidence: "Sınır; kapalı, çakışmasız ve en az üç noktalı bir poligon üretmiyor.", action: "Koordinat veya KML/GeoJSON sınırını doğrulayın.", route: "/arsa-fizibilite-studyosu?stage=draw#geo-studyo" });
  if (parcelReadyForNextStage && zoningReadyForNextStage && !zoningExpertReviewed) push({
    id: "PLN-010",
    severity: "review",
    discipline: "Planlama",
    title: "İmar kaynağı uzman doğrulaması bekliyor",
    evidence: "İmar koşulları ve kaynak referansı kayıtlı ancak proje içi uzman inceleme kaydı tamamlanmadı.",
    action: "Plan paftası, plan notu ve yetkili idare imar durumunu inceleyip uzman inceleme kaydını tamamlayın.",
    route: "/arsa-fizibilite-studyosu?stage=zoning&focus=source#geo-studyo",
    routeLabel: "İmar kaynağını incele",
  });
  if (canonical.site.allowedFootprint > 0 && canonical.site.proposedFootprint > canonical.site.allowedFootprint * 1.001) push({
    id: "PLN-011",
    severity: "critical",
    discipline: "Planlama + Mimari",
    title: "Öneri taban alanı TAKS girdisini aşıyor",
    evidence: `${footprintSource.label}: ${canonical.site.proposedFootprint.toFixed(1)} m² / TAKS girdisine göre azami ${canonical.site.allowedFootprint.toFixed(1)} m²`,
    action: `${footprintSource.label} taban alanını en az ${(canonical.site.proposedFootprint - canonical.site.allowedFootprint).toFixed(1)} m² azaltın; TAKS girdisi kaynağa göre yanlışsa imar girdisini yeniden inceleyin.`,
    route: footprintSource.route,
    routeLabel: footprintSource.actionLabel,
    secondaryRoute: "/arsa-fizibilite-studyosu?stage=zoning&focus=taks#geo-studyo",
    secondaryRouteLabel: "TAKS girdisini incele",
  });
  if (canonical.site.allowedGross > 0 && canonical.site.proposedGross > canonical.site.allowedGross * 1.001) push({
    id: "PLN-012",
    severity: "critical",
    discipline: "Planlama + Mimari",
    title: "Brüt alan KAKS/emsal girdisini aşıyor",
    evidence: `${grossSource.label}: ${canonical.site.proposedGross.toFixed(1)} m² / KAKS girdisine göre azami ${canonical.site.allowedGross.toFixed(1)} m²`,
    action: `${grossSource.label} toplam brüt alanını en az ${(canonical.site.proposedGross - canonical.site.allowedGross).toFixed(1)} m² azaltın; KAKS girdisi kaynağa göre yanlışsa imar girdisini yeniden inceleyin.`,
    route: grossSource.route,
    routeLabel: grossSource.actionLabel,
    secondaryRoute: "/arsa-fizibilite-studyosu?stage=zoning&focus=kaks#geo-studyo",
    secondaryRouteLabel: "KAKS girdisini incele",
  });
  const proposedHeight = floors * floorHeight;
  if (canonical.site.maxHeight > 0 && proposedHeight > canonical.site.maxHeight + .01) push({
    id: "PLN-013",
    severity: "critical",
    discipline: "Planlama + Mimari",
    title: "Yapı yüksekliği planlama girdisini aşıyor",
    evidence: `${floors} kat (${floorCountSource.label}) × ${floorHeight.toFixed(2)} m (${floorHeightSource}) = ${proposedHeight.toFixed(2)} m / Hmax ${canonical.site.maxHeight.toFixed(2)} m`,
    action: `Toplam yapı yüksekliğini en az ${(proposedHeight - canonical.site.maxHeight).toFixed(2)} m azaltın; kat adedi veya kat yüksekliği kaydını koordine edin.`,
    route: floorCountSource.route,
    routeLabel: floorCountSource.actionLabel,
    secondaryRoute: "/arsa-fizibilite-studyosu?stage=zoning&focus=hmax#geo-studyo",
    secondaryRouteLabel: "Hmax girdisini incele",
  });
  if (architectureGross > 0 && planGross > 0 && Math.abs(architectureGross - planGross) / architectureGross > .1) push({ id: "ARC-021", severity: "review", discipline: "Mimari", title: "Mahal programı ile plan alanı eşleşmiyor", evidence: `${architectureGross.toFixed(1)} m² program / ${planGross.toFixed(1)} m² plan`, action: "Mahal programı ile mevcut plan kapasitesini aynı toplam alanda koordine edin.", route: "/mimari-program-studyosu/plan-koordinasyonu", routeLabel: "Program ve planı koordine et" });
  if (comparisonHasResult && currentMcdaSource && !mcdaSourceCurrent) push({
    id: "SYS-040",
    severity: "review",
    discipline: "Yapı mühendisliği",
    title: "MCDA girdileri güncel proje verisiyle eşleşmiyor",
    evidence: `MCDA: ${number(comparisonInput.area).toFixed(1)} m² · ${number(comparisonInput.floors)} kat / güncel proje: ${currentMcdaSource.area.toFixed(1)} m² · ${currentMcdaSource.floors} kat`,
    action: "Güncel proje verisini MCDA girdilerine aktarın ve sistem sıralamasını yeniden hesaplayın.",
    route: "/yapi-sistemi-karsilastirma/mcda",
    routeLabel: "MCDA verisini güncelle",
  });

  if (number(plan.floorCount) > 0 && number(structureInput.floors) > 0 && number(plan.floorCount) !== number(structureInput.floors)) push({ id: "STR-031", severity: "critical", discipline: "Mimari + Statik", title: "Kat adedi modeller arasında farklı", evidence: `${number(plan.floorCount)} kat plan / ${number(structureInput.floors)} kat taşıyıcı model`, action: "Plan verisini taşıyıcı ön tasarıma yeniden aktarın.", route: "/tasarim-calismalari/model-senkronizasyonu", routeLabel: "Modelleri senkronize et" });
  if (planWidth > 0 && number(structureInput.width) > 0 && !closeEnough(planWidth, number(structureInput.width), .25)) push({ id: "STR-032", severity: "review", discipline: "Mimari + Statik", title: "X doğrultusu model boyu farklı", evidence: `${planWidth.toFixed(2)} m plan / ${number(structureInput.width).toFixed(2)} m statik`, action: "Plan geometrisini taşıyıcı ön tasarıma yeniden aktarın.", route: "/tasarim-calismalari/model-senkronizasyonu", routeLabel: "Modelleri senkronize et" });
  if (planDepth > 0 && number(structureInput.depth) > 0 && !closeEnough(planDepth, number(structureInput.depth), .25)) push({ id: "STR-033", severity: "review", discipline: "Mimari + Statik", title: "Y doğrultusu model boyu farklı", evidence: `${planDepth.toFixed(2)} m plan / ${number(structureInput.depth).toFixed(2)} m statik`, action: "Plan geometrisini taşıyıcı ön tasarıma yeniden aktarın.", route: "/tasarim-calismalari/model-senkronizasyonu", routeLabel: "Modelleri senkronize et" });
  if (mcdaSourceCurrent && canonical.structure.recommendedSystem && canonical.structure.system && systemMismatch && !systemDecisionRecorded) push({ id: "SYS-041", severity: "info", discipline: "Yapı mühendisliği", title: "MCDA birincisi ile modellenen sistem farklı", evidence: `${canonical.structure.recommendedSystem} öneri / ${canonical.structure.system} model`, action: "MCDA önerisini modele aktarın veya farklı seçimin gerekçesini karar kaydına bağlayın.", route: "/yapi-sistemi-karsilastirma/sistem-karari", routeLabel: "Sistem kararını kaydet" });
  if (canonical.structure.openingRatio > 25) push({ id: "BIM-051", severity: "review", discipline: "Mimari + Statik", title: "Döşeme boşluğu oranı yüksek", evidence: `%${canonical.structure.openingRatio.toFixed(1)} kavramsal boşluk oranı`, action: "Diyafram, kenar elemanı ve düşey sürekliliği inceleyin.", route: "/tasarim-calismalari" });
  if (canonical.structure.eccentricityRatio > 10 && eccentricityEvaluable) push({ id: "BIM-052", severity: "critical", discipline: "Mimari + Statik", title: "KM–KR dışmerkezlik göstergesi yüksek", evidence: `%${canonical.structure.eccentricityRatio.toFixed(1)} plan boyuna göre kavramsal gösterge · tanımlı kütle ve rijitlik noktaları`, action: "Perde/çerçeve dağılımı ile kütle yerleşimini yeniden değerlendirin.", route: "/tasarim-calismalari/km-kr-kaynaklari", routeLabel: "KM/KR yerleşimini incele" });
  if (number(planMetrics.floorArea) > 0 && !eccentricityEvaluable) push({ id: "BIM-053", severity: "review", discipline: "Mimari + Statik", title: "KM–KR ön kontrolü için kaynak nesneler eksik", evidence: !rigidityBasis ? "Aktif katta kolon/perde bulunmuyor; plaka geometrik merkezi gerçek rijitlik merkezi değildir." : "Aktif katta temsilî kütle/mahal veya yük bölgeleri bulunmuyor; kütle merkezi doğrulanamadı.", action: "Aktif kat için temsilî kütle bölgelerini ve kolon/perde yerleşimini tanımlayın; kavramsal merkezi yeniden hesaplayın.", route: "/tasarim-calismalari/km-kr-kaynaklari", routeLabel: "KM/KR kaynaklarını tamamla" });
  if (canonical.architecture.travelDistance > 0 && canonical.architecture.targetTravel > 0 && canonical.architecture.travelDistance > canonical.architecture.targetTravel) push({ id: "FIR-061", severity: "review", discipline: "Mimari + Yangın", title: "Kaçış mesafesi ön göstergesi hedefi aşıyor", evidence: `${canonical.architecture.travelDistance.toFixed(1)} m gösterge / ${canonical.architecture.targetTravel.toFixed(1)} m hedef`, action: "Çekirdek, koridor ve çıkış yerleşimini yetkili yangın tasarımıyla doğrulayın.", route: "/mimari-program-studyosu" });
  if (canonical.coordination.clearHeight > 0 && canonical.coordination.clearHeight < 2.4) push({ id: "MEP-071", severity: "critical", discipline: "Mimari + Statik + MEP", title: "Net tavan kotu koordinasyon hedefinin altında", evidence: `${canonical.coordination.clearHeight.toFixed(2)} m net yükseklik`, action: "Kiriş, servis zonu ve tavan paketini kesitte yeniden çözün.", route: "/muhendislik-koordinasyon" });

  const completedControls: CompletedControl[] = [];
  if (zoningReadyForNextStage && zoningExpertReviewed && !issues.some((issue) => issue.id === "PLN-010")) {
    completedControls.push({
      code: "PLN-010",
      title: "İmar kaynağı uzman incelemesi",
      summary: zoningAuthoritative
        ? "Yetkili/onaylı kaynak statüsü kayıtlı"
        : `${text(geoZoningExpertReview.reviewer, "Uzman")} · ${text(geoZoningExpertReview.role, "rol belirtilmedi")} · proje içi inceleme tamamlandı; resmî onay değildir`,
      routeLabel: "Görüntüle",
      route: "/arsa-fizibilite-studyosu?stage=zoning&focus=source#geo-studyo",
    });
  }

  const planFootprint = number(planMetrics.floorArea);
  if (
    planFootprint > 0
    && canonical.site.allowedFootprint > 0
    && planFootprint <= canonical.site.allowedFootprint * 1.001
    && !issues.some((issue) => issue.id === "PLN-011")
  ) {
    completedControls.push({
      code: "PLN-011",
      title: "TAKS ön kontrolü",
      summary: `Plan tabanı: ${planFootprint.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} / ${canonical.site.allowedFootprint.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²`,
      routeLabel: "Görüntüle",
      route: "/tasarim-calismalari/plan-duzeltme",
    });
  }

  if (
    architectureGross > 0
    && canonical.site.allowedGross > 0
    && architectureGross <= canonical.site.allowedGross * 1.001
    && !issues.some((issue) => issue.id === "PLN-012")
  ) {
    completedControls.push({
      code: "PLN-012",
      title: "KAKS ön kontrolü",
      summary: `Program brütü: ${architectureGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} / ${canonical.site.allowedGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²`,
      routeLabel: "Görüntüle",
      route: "/mimari-program-studyosu/kaks-duzeltme",
    });
  }

  if (
    floors > 0
    && floorHeight > 0
    && canonical.site.maxHeight > 0
    && proposedHeight <= canonical.site.maxHeight + .01
    && !issues.some((issue) => issue.id === "PLN-013")
  ) {
    completedControls.push({
      code: "PLN-013",
      title: "Hmax / yapı yüksekliği ön kontrolü",
      summary: `${floors} kat × ${floorHeight.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m = ${proposedHeight.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m / Hmax ${canonical.site.maxHeight.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`,
      routeLabel: "Görüntüle",
      route: "/tasarim-calismalari/yukseklik-duzeltme",
    });
  }

  if (
    architectureGross > 0
    && planGross > 0
    && Math.abs(architectureGross - planGross) / architectureGross <= .1
    && !issues.some((issue) => issue.id === "ARC-021")
  ) {
    completedControls.push({
      code: "ARC-021",
      title: "Program / plan alan koordinasyonu",
      summary: `Program: ${architectureGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² · Plan: ${planGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²`,
      routeLabel: "Görüntüle",
      route: "/mimari-program-studyosu/plan-koordinasyonu",
    });
  }

  if (
    number(planMetrics.floorArea) > 0
    && eccentricityEvaluable
    && !issues.some((issue) => issue.id === "BIM-053")
  ) {
    completedControls.push({
      code: "BIM-053",
      title: "KM–KR kaynak yeterliliği",
      summary: `Kütle: ${number(planMetrics.massPointCount)} · Rijitlik: ${number(planMetrics.rigidityPointCount)} kaynak · dışmerkezlik %${canonical.structure.eccentricityRatio.toFixed(1)}`,
      routeLabel: "Görüntüle",
      route: "/tasarim-calismalari/km-kr-kaynaklari",
    });
  }

  if (
    eccentricityEvaluable
    && canonical.structure.eccentricityRatio <= 10
    && !issues.some((issue) => issue.id === "BIM-052")
  ) {
    completedControls.push({
      code: "BIM-052",
      title: "KM–KR yerleşim ön kontrolü",
      summary: `Kavramsal dışmerkezlik: ${number(planMetrics.eccentricity).toFixed(2)} m · %${canonical.structure.eccentricityRatio.toFixed(1)}`,
      routeLabel: "Görüntüle",
      route: "/tasarim-calismalari/km-kr-kaynaklari",
    });
  }

  if (
    comparisonHasResult
    && currentMcdaSource
    && mcdaSourceCurrent
    && !issues.some((issue) => issue.id === "SYS-040")
  ) {
    completedControls.push({
      code: "SYS-040",
      title: "MCDA proje verisi senkronu",
      summary: `Güncel kaynak: ${currentMcdaSource.area.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² · ${currentMcdaSource.floors} kat · ${currentMcdaSource.span.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} m açıklık`,
      routeLabel: "Görüntüle",
      route: "/yapi-sistemi-karsilastirma/mcda",
    });
  }

  if (
    mcdaSourceCurrent
    && recommendedSystemId
    && modeledSystemId
    && (!systemMismatch || systemDecisionRecorded)
    && !issues.some((issue) => issue.id === "SYS-041")
  ) {
    completedControls.push({
      code: "SYS-041",
      title: "Taşıyıcı sistem karar koordinasyonu",
      summary: systemMismatch
        ? `MCDA: ${canonical.structure.recommendedSystem} · Model: ${canonical.structure.system} · farklı seçim gerekçelendirildi`
        : `MCDA önerisi ile model eşleşiyor: ${canonical.structure.system}`,
      routeLabel: "Görüntüle",
      route: "/yapi-sistemi-karsilastirma/sistem-karari",
    });
  }

  const activeKeys = new Set(Object.keys(modules));
  // quick-site-scenario is a derived gate. Old snapshots may still contain a
  // module key, but the Arsa journey must reflect the CURRENT parcel/zoning/
  // placement state, not stale historical presence.
  if (quickSiteScenarioReady) activeKeys.add("quick-site-scenario");
  else activeKeys.delete("quick-site-scenario");
  const nodes: ProjectGraphNode[] = PROJECT_MODULES.map((definition) => {
    const moduleData = record(modules[definition.id]);
    const active = activeKeys.has(definition.id);
    const blockedBy = definition.dependencies.filter((dependency) => !activeKeys.has(dependency));
    const status = text(moduleData.status, active ? "Kayıt var" : "Başlatılmadı");
    const milestoneComplete = definition.id === "quick-site-scenario"
      ? quickSiteScenarioReady
      : definition.id === "architectural-program"
        ? architectureJourneyReady
        : moduleData.journeyComplete === true;
    const readiness = definition.id === "geo-parcel" && active
      ? !parcelReadyForNextStage
        ? 35
        : !zoningConditionsReadyForNextStage
          ? 70
          : !zoningSourceReadyForNextStage
            ? 85
            : !zoningAuthoritative
              ? 95
              : 100
      : definition.id === "system-comparison" && active && comparisonHasResult && !mcdaSourceCurrent
        ? 72
        : active
          ? (blockedBy.length ? 68 : 100)
          : (blockedBy.length ? 0 : 20);
    return { ...definition, active, readiness, blockedBy, status, milestoneComplete };
  });
  const handoffDefinitions: Omit<ProjectHandoff, "state">[] = [
    { id: "H-01", source: "geo-parcel", target: "architectural-program", label: "Parsel → mimari program", payload: ["izin girdileri", "kütle", "kat", "kullanım"] },
    { id: "H-02", source: "architectural-program", target: "plan-editor", label: "Program → plan modeli", payload: ["brüt alan", "kat", "plaka oranı", "çekirdek"] },
    { id: "H-03", source: "plan-editor", target: "structural-concept", label: "Plan → taşıyıcı model", payload: ["aks", "boyut", "kat", "yük bölgeleri"] },
    { id: "H-04", source: "system-comparison", target: "structural-concept", label: "Sistem kararı → ön tasarım", payload: ["kısa liste", "açıklık", "yangın hedefi"] },
    { id: "H-05", source: "structural-concept", target: "arkem-x", label: "Metraj → karbon / DfMA", payload: ["beton", "donatı", "çelik", "çatı alanı"] },
    { id: "H-06", source: "engineering-coordination", target: "project-os", label: "Issue → Proje OS", payload: ["öncelik", "sorumlu", "durum", "karar kapısı"] },
  ];
  const conflictTargets = new Set(issues.filter((issue) => issue.severity !== "info").map((issue) => issue.route));
  const handoffs: ProjectHandoff[] = handoffDefinitions.map((handoff) => ({
    ...handoff,
    state: !activeKeys.has(handoff.source) || !activeKeys.has(handoff.target) ? "waiting" : conflictTargets.has(PROJECT_MODULES.find((item) => item.id === handoff.target)?.route ?? "") ? "conflict" : "ready",
  }));
  const activeCount = nodes.filter((node) => node.active).length;
  const readiness = Math.round(activeCount / nodes.length * 100);
  const quality = Math.max(0, 100 - issues.filter((issue) => issue.severity === "critical").length * 16 - issues.filter((issue) => issue.severity === "review").length * 7 - issues.filter((issue) => issue.severity === "info").length * 2);
  const nextNode = nodes.find((node) => !node.active && node.blockedBy.length === 0) ?? nodes.find((node) => !node.active);
  const nextAction = needsLandResearch && !parcelReadyForNextStage && !selectedCandidateReady
    ? { label: "Kriterlerine göre aday arsaları araştır", route: "/arsa-arastirma", blockedBy: [] as ProjectModuleKey[] }
    : !parcelReadyForNextStage
    ? {
      label: selectedCandidateReady ? "Seçilen adayın parselini ve sınırını doğrula" : "Parsel kimliğini ve sınırını doğrula",
      route: "/arsa-fizibilite-studyosu?stage=locate#geo-studyo",
      blockedBy: [] as ProjectModuleKey[],
    }
    : !zoningConditionsReadyForNextStage
      ? {
        label: "İmar koşullarını gir",
        route: "/arsa-fizibilite-studyosu?stage=zoning#geo-studyo",
        blockedBy: [] as ProjectModuleKey[],
      }
      : !zoningSourceReadyForNextStage
        ? {
          label: "İmar kaynağını ekle",
          route: "/arsa-fizibilite-studyosu?stage=zoning&focus=source#geo-studyo",
          blockedBy: [] as ProjectModuleKey[],
        }
        : quickSiteScenarioReady && !systemDecisionReady
          ? {
            label: "Sistemi ve yöntemi seç",
            route: "/sistem-karsilastirma",
            blockedBy: [] as ProjectModuleKey[],
          }
        : nextNode
          ? { label: nextNode.label, route: nextNode.route, blockedBy: nextNode.blockedBy }
          : { label: "Koordinasyon kayıtlarını kapatın", route: "/muhendislik-koordinasyon", blockedBy: [] as ProjectModuleKey[] };

  return {
    canonical,
    nodes,
    issues,
    completedControls,
    handoffs,
    metrics: { activeCount, totalCount: nodes.length, readiness, quality, critical: issues.filter((issue) => issue.severity === "critical").length, review: issues.filter((issue) => issue.severity === "review").length },
    nextAction,
  };
}

export type ProjectThread = ReturnType<typeof deriveProjectThread>;

