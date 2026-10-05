export type ProjectDataTrust = "verified" | "declared" | "derived" | "missing";

export type ProjectModuleStamp = {
  schema: "ARKEM-MODULE-LINK/1.0";
  projectId: string;
  projectRevision: string;
  sourceModule: string;
  recordedAt: string;
  action: "created" | "updated" | "imported" | "handoff";
};

export type ProjectCoreField = {
  id: string;
  label: string;
  value: string;
  trust: ProjectDataTrust;
  sourceModule: string;
  sourceLabel: string;
  boundary: string;
};

export type ProjectCoreSnapshot = {
  schema: "ARKEM-PROJECT-CORE/1.0";
  projectId: string;
  projectRevision: string;
  generatedAt: string;
  fields: ProjectCoreField[];
  metrics: {
    complete: number;
    total: number;
    completion: number;
    verified: number;
    declared: number;
    derived: number;
    missing: number;
  };
  missing: Array<Pick<ProjectCoreField, "id" | "label" | "sourceModule">>;
  policy: {
    oneOwnerPerField: true;
    officialDataIsExplicit: true;
    derivedDataIsNotApproval: true;
  };
};

type UnknownRecord = Record<string, unknown>;

type ProjectLike = {
  id: string;
  name: string;
  revision: string;
  phase: string;
  updatedAt: string;
  modules: Record<string, unknown>;
};

type ThreadLike = {
  canonical: {
    site: {
      reference: string;
      dataStatus: string;
      parcelArea: number;
      geometryValid: boolean;
      allowedFootprint: number;
      allowedGross: number;
      maxHeight: number;
    };
    architecture: {
      use: string;
      floors: number;
      floorHeight: number;
      grossArea: number;
    };
    structure: {
      system: string;
    };
    coordination: {
      openIssues: number;
    };
  };
  metrics: {
    activeCount: number;
    totalCount: number;
  };
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function hasText(value: string, patterns: string[]) {
  const normalized = value.toLocaleLowerCase("tr-TR");
  return patterns.some((pattern) => normalized.includes(pattern.toLocaleLowerCase("tr-TR")));
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString("tr-TR", { maximumFractionDigits });
}

function field(
  id: string,
  label: string,
  value: string,
  trust: ProjectDataTrust,
  sourceModule: string,
  sourceLabel: string,
  boundary: string,
): ProjectCoreField {
  return { id, label, value: value || "Bekleniyor", trust: value ? trust : "missing", sourceModule, sourceLabel, boundary };
}

export function stampProjectModule(
  value: unknown,
  stamp: Omit<ProjectModuleStamp, "schema">,
) {
  const moduleValue = record(value);
  const preservedValue = value && typeof value === "object" && !Array.isArray(value)
    ? moduleValue
    : { _payload: value };
  return {
    ...preservedValue,
    _kernel: {
      schema: "ARKEM-MODULE-LINK/1.0",
      ...stamp,
    } satisfies ProjectModuleStamp,
  };
}

export function ensureProjectModuleStamps(
  modules: Record<string, unknown>,
  identity: Pick<ProjectModuleStamp, "projectId" | "projectRevision" | "recordedAt">,
) {
  return Object.fromEntries(Object.entries(modules).map(([key, value]) => {
    const moduleValue = record(value);
    const existing = record(moduleValue._kernel);
    if (existing.schema === "ARKEM-MODULE-LINK/1.0" && existing.projectId === identity.projectId) return [key, value];
    return [key, stampProjectModule(value, {
      ...identity,
      sourceModule: key,
      action: "imported",
    })];
  }));
}

export function deriveProjectCore(project: ProjectLike, thread: ThreadLike): ProjectCoreSnapshot {
  const modules = project.modules;
  const started = Object.keys(modules).length > 0;
  const decision = record(modules["decision-assistant"]);
  const decisionInput = record(decision.input);
  const geo = record(modules["geo-parcel"]);
  const geoMetrics = record(geo.metrics);
  const terrainModel = record(geo.terrainModel);
  const terrainSamples = record(terrainModel.samples);
  const terrainElevation = record(terrainModel.elevation);
  const terrainParameters = record(terrainModel.parameters);
  const massingModel = record(geo.massingModel);
  const massingEnvelope = record(massingModel.envelope);
  const massingLimits = record(massingModel.limits);
  const massingSource = record(massingModel.source);
  const parcelRecord = record(geo.parcelRecord);
  const parcelRecordIdentity = record(parcelRecord.identity);
  const parcelRecordGeometry = record(parcelRecord.geometry);
  const parcelRecordEvidence = record(parcelRecord.evidence);
  const hasParcelRecord = parcelRecord.schema === "ARKEM-PARCEL-RECORD/1.0";
  const zoning = { ...record(geo.planning), ...record(geo.zoning) };
  const architecture = record(modules["architectural-program"]);
  const architectureInput = record(architecture.input);
  const architectureResult = record(architecture.result);
  const architecturalScheme = record(architecture.architecturalScheme);
  const architecturalSchemeSource = record(architecturalScheme.source);
  const architecturalSchemePlate = record(architecturalScheme.plate);
  const architecturalSchemeCirculation = record(architecturalScheme.circulation);
  const plan = record(modules["plan-editor"]);
  const comparison = record(modules["system-comparison"]);
  const comparisonInput = record(comparison.input);
  const structure = record(modules["structural-concept"]);
  const structureInput = record(structure.input);
  const structuralStudio = record(structure.structuralStudio);
  const structuralStudioSource = record(structuralStudio.source);
  const structuralStudioGeometry = record(structuralStudio.geometry);
  const structuralRecommendation = record(structuralStudio.recommendation);
  const structuralAlternatives = Array.isArray(structuralStudio.alternatives) ? structuralStudio.alternatives.map(record) : [];
  const coordination = record(modules["engineering-coordination"]);
  const bimCoordination = record(coordination.bimCoordination);
  const bimFederation = record(bimCoordination.federation);
  const bimSchedule4D = record(bimCoordination.schedule4D);
  const bimCost5D = record(bimCoordination.cost5D);
  const bimInteroperability = record(bimCoordination.interoperability);
  const bimClashes = Array.isArray(bimCoordination.clashes) ? bimCoordination.clashes.map(record) : [];
  const projectOs = record(modules["project-os"]);
  const projectOperatingModel = record(projectOs.operatingModel);
  const projectOsWorkItems = Array.isArray(projectOperatingModel.workItems) ? projectOperatingModel.workItems.map(record) : [];
  const projectOsHealthGates = Array.isArray(projectOperatingModel.healthGates) ? projectOperatingModel.healthGates.map(record) : [];
  const budgetLabels: Record<string, string> = {
    undecided: "Bütçe kararı bekleniyor",
    "under-five": "5 milyon TL altı",
    "five-fifteen": "5–15 milyon TL",
    "fifteen-fifty": "15–50 milyon TL",
    "over-fifty": "50 milyon TL üzeri",
  };
  const timelineLabels: Record<string, string> = {
    urgent: "0–3 ay",
    "six-months": "3–6 ay",
    "twelve-months": "6–12 ay",
    flexible: "Esnek takvim",
  };
  const documentLabels: Record<string, string> = {
    "title-deed": "Tapu",
    "parcel-id": "Ada/parsel",
    zoning: "İmar",
    survey: "Harita",
    soil: "Zemin",
    "existing-plan": "Mevcut proje",
  };
  const budget = textValue(decisionInput.budget);
  const timeline = textValue(decisionInput.timeline);
  const budgetLabel = budgetLabels[budget] ?? budget;
  const timelineLabel = timelineLabels[timeline] ?? timeline;
  const declaredDocuments = Array.isArray(decisionInput.documents)
    ? decisionInput.documents.filter((value): value is string => typeof value === "string")
    : [];

  const dataStatus = textValue(geo.dataStatus, thread.canonical.site.dataStatus);
  const officialParcelResponse = hasParcelRecord
    ? textValue(parcelRecordEvidence.sourceKind) === "tkgm-open-service"
      && textValue(parcelRecordEvidence.trust) === "verified"
      && textValue(parcelRecordIdentity.block).length > 0
      && textValue(parcelRecordIdentity.parcelNo).length > 0
    : hasText(dataStatus, ["TKGM", "MEGSİS"])
      && !hasText(dataStatus, ["bekleniyor", "kullanıcı beyanı", "doğrulanmamış", "önizleme"]);
  const licensedSurvey = hasText(dataStatus, ["harita mühendisi", "onaylı aplikasyon"]);
  const geometryReady = hasParcelRecord
    ? parcelRecord.projectEligible === true && parcelRecordGeometry.valid === true
    : thread.canonical.site.geometryValid || geoMetrics.geometryValid === true;
  const parcelArea = hasParcelRecord
    ? numberValue(parcelRecordGeometry.computedArea)
    : numberValue(geoMetrics.area) || thread.canonical.site.parcelArea;
  const parcelIdentity = [
    textValue(parcelRecordIdentity.province, textValue(geo.province)),
    textValue(parcelRecordIdentity.district, textValue(geo.district)),
    textValue(parcelRecordIdentity.neighborhood, textValue(geo.neighborhood)),
    textValue(parcelRecordIdentity.block, textValue(geo.block)) ? `Ada ${textValue(parcelRecordIdentity.block, textValue(geo.block))}` : "",
    textValue(parcelRecordIdentity.parcelNo, textValue(geo.parcelNo)) ? `Parsel ${textValue(parcelRecordIdentity.parcelNo, textValue(geo.parcelNo))}` : "",
  ].filter(Boolean).join(" · ");
  const parcelTrust: ProjectDataTrust = officialParcelResponse && parcelIdentity ? "verified" : parcelIdentity ? "declared" : "missing";
  const geometryTrust: ProjectDataTrust = geometryReady && (officialParcelResponse || licensedSurvey)
    ? "verified"
    : geometryReady
      ? "declared"
      : "missing";
  const terrainBasis = textValue(terrainModel.basis);
  const terrainReady = terrainModel.schema === "ARKEM-TERRAIN-MODEL/1.0";
  const terrainTrust: ProjectDataTrust = !terrainReady
    ? "missing"
    : terrainBasis === "measured-z"
      ? textValue(terrainModel.trust) === "verified" ? "verified" : "declared"
      : "derived";
  const terrainValue = terrainBasis === "measured-z"
    ? `${numberValue(terrainSamples.measured)} kot · ${formatNumber(numberValue(terrainElevation.range), 2)} m fark`
    : terrainReady
      ? `Parametrik yüzey · %${formatNumber(numberValue(terrainParameters.indicativeSlopePercent), 1)} eğim`
      : "";
  const massingReady = massingModel.schema === "ARKEM-ZONING-MASSING/1.0";
  const massingTrust: ProjectDataTrust = !massingReady
    ? "missing"
    : massingSource.authoritative === true
      ? "verified"
      : "derived";
  const massingValue = massingReady
    ? `${formatNumber(numberValue(massingEnvelope.width), 1)} × ${formatNumber(numberValue(massingEnvelope.depth), 1)} m zarf · ${formatNumber(numberValue(massingLimits.allowedGrossArea))} m² emsal üst sınırı`
    : "";

  const zoningVerification = textValue(zoning.verification);
  const zoningValues = [
    numberValue(zoning.taks) > 0 ? `TAKS ${numberValue(zoning.taks).toFixed(2)}` : "",
    numberValue(zoning.kaks) > 0 ? `KAKS ${numberValue(zoning.kaks).toFixed(2)}` : "",
    numberValue(zoning.hmax) > 0 ? `Hmax ${numberValue(zoning.hmax).toFixed(2)} m` : "",
    textValue(zoning.buildingOrder),
  ].filter(Boolean);
  const zoningTrust: ProjectDataTrust = hasText(zoningVerification, ["certified", "approved-plan"])
    ? "verified"
    : zoningValues.length
      ? "declared"
      : "missing";

  const grossArea = numberValue(architectureResult.grossDemand)
    || numberValue(architectureInput.targetGross)
    || thread.canonical.architecture.grossArea;
  const grossAreaTrust: ProjectDataTrust = numberValue(architectureResult.grossDemand) > 0
    ? "derived"
    : grossArea > 0
      ? "declared"
      : "missing";
  const architecturalSchemeReady = architecturalScheme.schema === "ARKEM-ARCH-SCHEME/3.0";
  const architecturalSchemeTrust: ProjectDataTrust = !architecturalSchemeReady
    ? "missing"
    : architecturalSchemeSource.authoritativeMassing === true
      ? "verified"
      : "derived";
  const architecturalSchemeValue = architecturalSchemeReady
    ? `${formatNumber(numberValue(architecturalSchemePlate.width), 1)} × ${formatNumber(numberValue(architecturalSchemePlate.depth), 1)} m · ${Array.isArray(architecturalScheme.nodes) ? architecturalScheme.nodes.length : 0} mahal düğümü · ${formatNumber(numberValue(architecturalSchemeCirculation.maximumTravelDistance), 1)} m kaçış göstergesi`
    : "";
  const floors = numberValue(plan.floorCount) || numberValue(architectureInput.floors) || thread.canonical.architecture.floors;
  const floorHeight = numberValue(structureInput.floorHeight)
    || numberValue(architectureInput.floorHeight)
    || thread.canonical.architecture.floorHeight;
  const floorTrust: ProjectDataTrust = numberValue(plan.floorCount) > 0
    ? "derived"
    : floors > 0
      ? "declared"
      : "missing";

  const structuralSystem = textValue(structureInput.system)
    || textValue(thread.canonical.structure.system)
    || textValue(comparisonInput.preferredSystem)
    || textValue(geo.system);
  const structuralTrust: ProjectDataTrust = textValue(structureInput.system)
    ? "derived"
    : structuralSystem && structuralSystem !== "undecided" && !hasText(structuralSystem, ["karar bekleniyor"])
      ? "declared"
      : "missing";
  const structuralStudioReady = structuralStudio.schema === "ARKEM-STRUCTURAL-STUDIO/3.0";
  const recommendedStructuralAlternative = structuralAlternatives.find((alternative) => textValue(alternative.system) === textValue(structuralRecommendation.system)) ?? {};
  const recommendedPreliminary = record(recommendedStructuralAlternative.preliminary);
  const structuralSizingTrust: ProjectDataTrust = structuralStudioReady ? "derived" : "missing";
  const structuralSizingValue = structuralStudioReady
    ? `${textValue(structuralRecommendation.label, textValue(structuralRecommendation.system))} · ${formatNumber(numberValue(structuralRecommendation.score), 1)}/100 · ${formatNumber(numberValue(structuralStudioGeometry.maximumSpan), 1)} m açıklık · ${textValue(recommendedPreliminary.column, "kesit sınıfı bekleniyor")}`
    : "";
  const bimCoordinationReady = bimCoordination.schema === "ARKEM-BIM-COORDINATION/3.0";
  const bimCriticalClashes = bimClashes.filter((clash) => textValue(clash.severity) === "critical").length;
  const bimCoordinationValue = bimCoordinationReady
    ? `${numberValue(bimFederation.connectedCount)}/6 bağlı katman · ${bimClashes.length} issue (${bimCriticalClashes} kritik) · ${formatNumber(numberValue(bimSchedule4D.totalWeeks), 1)} hf 4B · ${formatNumber(numberValue(bimCost5D.relativeStructuralCost), 0)} göreli 5B`
    : "";
  const projectOsReady = projectOperatingModel.schema === "ARKEM-PROJECT-OS/2.0";
  const projectOsOpen = projectOsWorkItems.filter((item) => textValue(item.status) !== "closed").length;
  const projectOsBlocked = projectOsWorkItems.filter((item) => textValue(item.status) === "blocked").length;
  const projectOsValue = projectOsReady
    ? `${projectOsOpen} açık iş · ${projectOsBlocked} bloke · ${projectOsHealthGates.filter((gate) => textValue(gate.status) === "passed").length}/${projectOsHealthGates.length} kontrol kapısı`
    : "";

  const fields: ProjectCoreField[] = [
    field("project-id", "Proje kimliği", started ? project.id : "", started ? "verified" : "missing", "project-kernel", "ARKEMX proje çekirdeği", "Sistem tarafından oluşturulan değişmez çalışma kodu."),
    field("project-name", "Proje adı", started && project.name !== "Yeni Yapı Yatırımı" ? project.name : "", started ? "declared" : "missing", "decision-assistant", "Müşteri briefi", "Kullanıcı tarafından tanımlanır; resmî proje adı değildir."),
    field("budget-timeline", "Bütçe ve hedef süre", budget || timeline ? `${budgetLabel || "Bütçe bekleniyor"} · ${timelineLabel || "Takvim bekleniyor"}` : "", "declared", "decision-assistant", "Müşteri briefi", "Müşteri hedefidir; keşif, teklif veya iş programı değildir."),
    field("document-readiness", "Belge hazırlığı", declaredDocuments.length ? declaredDocuments.map((value) => documentLabels[value] ?? value).join(" · ") : "", "declared", "decision-assistant", "Müşteri briefi", "Belgenin mevcut olduğu beyanıdır; içerik ve güncellik uzman tarafından doğrulanmalıdır."),
    field("location", "Başlangıç konumu", textValue(geo.reference).replace("Parsel seçimi bekleniyor", ""), officialParcelResponse ? "verified" : "declared", "geo-parcel", "GIS / parsel", dataStatus || "Konum kaynağı henüz sınıflandırılmadı."),
    field("parcel-id", "Parsel kimliği", parcelIdentity, parcelTrust, "geo-parcel", "GIS / parsel", officialParcelResponse ? "TKGM servis yanıtından okunmuştur; tapu kaydı değildir." : "Kullanıcı girdisi; resmî kaynaktan doğrulanmalıdır."),
    field("parcel-geometry", "Parsel geometrisi", geometryReady ? `${formatNumber(parcelArea)} m² · ${Array.isArray(geo.parcel) ? geo.parcel.length : 0} köşe` : "", geometryTrust, "geo-parcel", "GIS / parsel", geometryReady ? dataStatus : "Koordinatlı sınır henüz oluşturulmadı."),
    field("terrain-model", "Arazi ve kot modeli", terrainValue, terrainTrust, "geo-parcel", "GIS + 3B arazi", terrainBasis === "measured-z" ? "Kaynak dosya kotlarına dayalı enterpolasyondur; düşey datum ve ölçüm yetkisi doğrulanmalıdır." : "Parametrik yüzey sistem türevidir; plankote veya arazi ölçümü değildir."),
    field("massing-model", "Yapı zarfı ve kütle", massingValue, massingTrust, "geo-parcel", "V112 imar uyumlu kütle", massingSource.authoritative === true ? "Doğrulanmış imar girdilerinden türetilmiştir; yine de ruhsat projesi değildir." : "Kullanıcı beyanlı imar girdilerinden türetilen kavramsal ön değerlendirmedir."),
    field("zoning", "İmar koşulları", zoningValues.join(" · "), zoningTrust, "zoning-integration", "İmar kanıt zinciri", zoningVerification ? `Doğrulama statüsü: ${zoningVerification}.` : "TAKS, KAKS, Hmax ve nizam belgeden doğrulanmalıdır."),
    field("program", "Mimari program", grossArea > 0 ? `${formatNumber(grossArea)} m² · ${textValue(architectureInput.use, thread.canonical.architecture.use) || "kullanım bekleniyor"}` : "", grossAreaTrust, "architectural-program", "Mimari program", grossAreaTrust === "derived" ? "Mimari program motorunun hesapladığı brüt taleptir." : "Müşteri hedef alanıdır; mimari çözüm değildir."),
    field("architectural-scheme", "Mekânsal şema", architecturalSchemeValue, architecturalSchemeTrust, "architectural-program", "V113 mimari şema", architecturalSchemeReady ? "Mahal düğümü, komşuluk, dolaşım, çekirdek, günışığı ve kaçış ön göstergelerinden türetilir; avan veya ruhsat projesi değildir." : "V113 mekânsal şeması henüz üretilmedi."),
    field("floors", "Kat ve yükseklik", floors > 0 ? `${floors} kat · ${floorHeight ? `${floorHeight.toFixed(2)} m/kat` : "yükseklik bekleniyor"}` : "", floorTrust, numberValue(plan.floorCount) > 0 ? "plan-editor" : "architectural-program", numberValue(plan.floorCount) > 0 ? "Plan ve aks modeli" : "Müşteri briefi", floorTrust === "derived" ? "Plan modelinden okunur." : "Başlangıç hedefidir; imar ve tasarımla doğrulanır."),
    field("structure", "Taşıyıcı sistem", structuralSystem && structuralSystem !== "undecided" ? structuralSystem : "", structuralTrust, textValue(structureInput.system) ? "structural-concept" : "system-comparison", textValue(structureInput.system) ? "Taşıyıcı ön tasarım" : "Sistem tercihi", structuralTrust === "derived" ? "Taşıyıcı model girdisidir; statik hesap onayı değildir." : "Ön tercihtir; zemin, açıklık, deprem ve yangın verileriyle karşılaştırılır."),
    field("structural-sizing", "Taşıyıcı ön boyutlandırma", structuralSizingValue, structuralSizingTrust, "structural-concept", "V114 taşıyıcı sistem stüdyosu", structuralStudioReady ? `Beş sistem aynı geometri üzerinde karşılaştırılmıştır; kaynak güveni ${textValue(structuralStudioSource.architectureTrust, "türetilmiş")}. Kesit, maliyet, süre ve karbon değerleri statik analiz, teklif veya uygulama projesi değildir.` : "V114 taşıyıcı sistem karşılaştırması henüz üretilmedi."),
    field("coordination", "BIM koordinasyonu", bimCoordinationValue || (Object.keys(coordination).length ? `${thread.canonical.coordination.openIssues} açık issue · ${thread.metrics.activeCount}/${thread.metrics.totalCount} modül` : ""), bimCoordinationReady || Object.keys(coordination).length ? "derived" : "missing", "engineering-coordination", bimCoordinationReady ? "V115 BIM ve disiplin koordinasyonu" : "Disiplin koordinasyonu", bimCoordinationReady ? `V113–V114 kaynaklarından türetilen federasyon ve çakışma kaydıdır. ${textValue(bimInteroperability.profile, "IFC/BCF hazırlık manifestosu")}; native IFC/BCF, onaylı metraj, LCA, iş programı veya maliyet hesabı değildir.` : Object.keys(coordination).length ? "Aktif modül ve issue kayıtlarından türetilir." : "Mimari, statik ve MEP verisi henüz koordine edilmedi."),
    field("project-control", "Proje kontrolü", projectOsValue, projectOsReady ? "derived" : "missing", "project-os", "V116 Project OS 2.0", projectOsReady ? "Görev, RFI, revizyon ve kontrol kapıları Project Kernel kayıtlarından türetilir; kurumsal CDE, onaylı iş programı veya kesin maliyet kaydı değildir." : "V116 proje kontrol modeli henüz üretilmedi."),
  ];

  const counts = fields.reduce((total, item) => {
    total[item.trust] += 1;
    return total;
  }, { verified: 0, declared: 0, derived: 0, missing: 0 });
  const complete = fields.length - counts.missing;

  return {
    schema: "ARKEM-PROJECT-CORE/1.0",
    projectId: project.id,
    projectRevision: project.revision,
    generatedAt: project.updatedAt,
    fields,
    metrics: {
      complete,
      total: fields.length,
      completion: Math.round(complete / fields.length * 100),
      ...counts,
    },
    missing: fields.filter((item) => item.trust === "missing").map(({ id, label, sourceModule }) => ({ id, label, sourceModule })),
    policy: {
      oneOwnerPerField: true,
      officialDataIsExplicit: true,
      derivedDataIsNotApproval: true,
    },
  };
}
