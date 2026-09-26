export type CoordinationTopic = {
  id: string;
  title: string;
  severity: "critical" | "review" | "info";
  discipline: string;
  evidence: string;
  action: string;
  source: string;
  reviewed?: boolean;
  assignee?: string;
  location?: string;
  type?: string;
  sourceRefs?: string[];
};

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};

export function createCoordinationPackage(input: {
  projectId: string;
  coordinateReference: string;
  serviceZone: number;
  shaftArea: number;
  floorPlate: number;
  bimCoordination?: unknown;
  topics: CoordinationTopic[];
}) {
  const bim = record(input.bimCoordination);
  const federation = record(bim.federation);
  const spatial = record(bim.spatial);
  const interoperability = record(bim.interoperability);
  return {
    schema: "ARKEM-COORDINATION/3.0",
    previousSchema: "ARKEM-COORDINATION/2.0",
    interoperability: {
      profile: "BCF-compatible issue manifest",
      exchangeProfile: "IFC4 hazırlık manifestosu + BCF uyumlu issue kaydı",
      nativeIfcModel: false,
      nativeBcfZip: false,
      ifcGuidCoveragePct: interoperability.ifcGuidCoveragePct ?? 0,
      viewpointCoveragePct: interoperability.viewpointCoveragePct ?? 0,
      note: "Gerçek IFC / .bcfzip için yetkili model GUID'leri, proje yerleşimi, kamera görünüşleri ve CDE bağlantısı gerekir.",
    },
    identity: {
      projectId: input.projectId,
      coordinateReference: input.coordinateReference,
      revision: "P01",
      generatedAt: new Date().toISOString(),
    },
    servicePlanning: {
      serviceZoneM: input.serviceZone,
      shaftAreaM2: input.shaftArea,
      shaftRatioPct: input.floorPlate > 0 ? input.shaftArea / input.floorPlate * 100 : 0,
      disciplines: ["HVAC", "Electrical", "Plumbing", "Fire"],
    },
    federation: {
      commonRevision: federation.commonRevision ?? "P01",
      layers: federation.layers ?? [],
      spatial: spatial.plate ?? null,
      modelSchema: bim.schema ?? null,
    },
    topics: input.topics.map((topic) => ({
      guid: topic.id,
      title: topic.title,
      priority: topic.severity,
      assignedDiscipline: topic.discipline,
      assignedTo: topic.assignee ?? topic.discipline,
      location: topic.location ?? "Koordinasyon modeli",
      clashType: topic.type ?? "coordination",
      description: topic.evidence,
      requiredAction: topic.action,
      status: topic.reviewed ? "InReview" : "Open",
      closureVerified: false,
      note: "İnceleme kaydı, teknik çözüm veya yetkili onayı olarak yorumlanamaz.",
      source: topic.source,
      sourceRefs: topic.sourceRefs ?? [topic.source],
      nativeViewpoint: false,
    })),
  };
}
