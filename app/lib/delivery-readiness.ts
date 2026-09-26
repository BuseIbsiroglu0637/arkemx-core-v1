/**
 * V117 working-delivery gate. The current Project Kernel is device-local and
 * entirely user-editable; no stored enum, boolean, filename or phase is proof
 * of professional or statutory approval.
 */
import { normalizeUntrustedZoningVerification } from "./zoning.ts";

type UnknownRecord = Record<string, unknown>;
function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord : {};
}
function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function safeIssue(value: unknown) {
  const issue = record(value);
  return {
    id: text(issue.guid, text(issue.id, "unidentified")),
    title: text(issue.title, "Koordinasyon konusu"),
    severity: text(issue.severity, "review"),
    evidence: text(issue.evidence),
  };
}

export type DeliveryReadinessInput = {
  projectId: string;
  projectRevision: string;
  projectName?: string;
  projectPhase?: string;
  modules: Record<string, unknown>;
  threadIssues?: readonly {
    id: string;
    severity: "critical" | "review" | "info";
    title: string;
  }[];
};

export function createDeliveryReadiness(input: DeliveryReadinessInput) {
  const geo = record(input.modules["geo-parcel"]);
  const zoning = record(geo.zoning);
  const zoningProvenance = record(geo.zoningProvenance);
  const sourceDocument = text(zoning.sourceDocument);
  const untrustedVerification = normalizeUntrustedZoningVerification(
    zoning.verification, Boolean(sourceDocument),
  );
  const architecture = record(input.modules["architectural-program"]);
  const structural = record(input.modules["structural-concept"]);
  const coordination = record(input.modules["engineering-coordination"]);
  const projectOs = record(input.modules["project-os"]);
  const bim = record(coordination.bimCoordination);
  const osModel = record(projectOs.operatingModel);
  const osHandoff = record(projectOs.coordination);
  const originalBim = record(osHandoff.bimCoordination);
  const currentClashes = Array.isArray(bim.clashes)
    ? bim.clashes.map(safeIssue)
    : [];
  const reviewed = Array.isArray(coordination.reviewed)
    ? coordination.reviewed.filter((id): id is string => typeof id === "string")
    : Array.isArray(coordination.resolved)
      ? coordination.resolved.filter((id): id is string => typeof id === "string")
      : [];
  const bimPresent = bim.schema === "ARKEM-BIM-COORDINATION/3.0";
  // A saved OS issueGate/technicalApproval and uploaded PDF name are not a trust anchor.
  const criticalClashes = currentClashes.filter((issue) => issue.severity === "critical");
  const threadCritical = (input.threadIssues ?? [])
    .filter((issue) => issue.severity === "critical")
    .map((issue) => ({ id: issue.id, title: issue.title, severity: issue.severity }));
  const osSnapshotCritical = !bimPresent && originalBim.schema === "ARKEM-BIM-COORDINATION/3.0"
    && Array.isArray(originalBim.clashes)
    ? originalBim.clashes.map(safeIssue).filter((issue) => issue.severity === "critical")
    : [];
  const activeCriticalCount = criticalClashes.length + threadCritical.length + osSnapshotCritical.length;
  const zoningHasValues = ["taks", "kaks", "hmax"].some(
    (key) => typeof zoning[key] === "number" && Number.isFinite(zoning[key]) && zoning[key] > 0,
  ) || Boolean(text(zoning.buildingOrder));
  const scheme = record(architecture.architecturalScheme);
  const structuralStudio = record(structural.structuralStudio);
  const architecturePresent = scheme.schema === "ARKEM-ARCH-SCHEME/3.0";
  const structurePresent = structuralStudio.schema === "ARKEM-STRUCTURAL-STUDIO/3.0";
  const osPresent = osModel.schema === "ARKEM-PROJECT-OS/2.0";
  const osUpstreamCurrent = osPresent
    && bimPresent
    && record(osHandoff.bimCoordination).schema === "ARKEM-BIM-COORDINATION/3.0";
  const checks = [
    {
      code: "DEL-01", label: "Parsel ve imar kanıtı",
      status: "review" as const,
      source: "geo-parcel",
      detail: !zoningHasValues
        ? "İmar koşulları ve yetkili plan belgesi henüz bağlı değil."
        : sourceDocument
          ? "Belge adı kaydedildi; içeriği, imzası ve plan geçerliliği yetkili kaynaktan doğrulanmadı."
          : "İmar girdileri kullanıcı beyanı; resmî plan belgesi doğrulanmadı.",
      evidence: {
        zoningInputsPresent: zoningHasValues,
        declaredVerification: untrustedVerification,
        sourceDocumentPresent: Boolean(sourceDocument),
        authorityVerified: false as const,
        storedAuthorityClaimIgnored: zoningProvenance.authoritative === true,
      },
    },
    {
      code: "DEL-02", label: "Mimari program ve ön tasarım",
      status: (architecturePresent ? "review" : "missing") as "review" | "missing",
      source: "architectural-program",
      detail: architecturePresent
        ? "Mekânsal şema bağlı; yetkili mimari onay ve uygulama projesi yok."
        : "Mimari mekânsal şema bekleniyor.",
      evidence: { modelPresent: architecturePresent, professionalApproval: false as const },
    },
    {
      code: "DEL-03", label: "Taşıyıcı sistem ve hesap",
      status: (structurePresent ? "review" : "missing") as "review" | "missing",
      source: "structural-concept",
      detail: structurePresent
        ? "Taşıyıcı ön boyutlandırma var; imzalı statik hesap ve yetkili mühendis onayı yok."
        : "Taşıyıcı ön model bekleniyor.",
      evidence: { modelPresent: structurePresent, professionalApproval: false as const },
    },
    {
      code: "DEL-04", label: "BIM çakışmaları ve inceleme",
      status: (!bimPresent ? "missing" : activeCriticalCount > 0 ? "blocked" : "review") as "missing" | "blocked" | "review",
      source: "engineering-coordination",
      detail: !bimPresent
        ? "Güncel BIM koordinasyon modeli bekleniyor."
        : activeCriticalCount > 0
          ? activeCriticalCount + " kritik konu açık; incelendi işareti teknik çözüm değildir."
          : "Güncel kurallarda kritik konu yok; model ve disiplin onayları ayrıca gerekli.",
      evidence: {
        modelPresent: bimPresent,
        criticalClashes: criticalClashes.length,
        threadCritical: threadCritical.length,
        staleOsCritical: osSnapshotCritical.length,
        reviewedCritical: criticalClashes.filter((issue) => reviewed.includes(issue.id)).length,
        nativeIfcDelivered: false as const,
        nativeBcfDelivered: false as const,
      },
    },
    {
      code: "DEL-05", label: "Proje OS / 4B / 5B",
      status: (activeCriticalCount > 0 ? "blocked" : osUpstreamCurrent ? "review" : "missing") as "blocked" | "review" | "missing",
      source: "project-os",
      detail: activeCriticalCount > 0
        ? "Kritik koordinasyon konuları nedeniyle 4B/5B onay kapısı kapalı."
        : osUpstreamCurrent
          ? "Koordinasyon ve Proje OS bağlı; süre ve maliyet yalnızca kavramsal."
          : "Güncel koordinasyon → Proje OS veri bağlantısı bekleniyor.",
      evidence: {
        modelPresent: osPresent,
        upstreamConnected: osUpstreamCurrent,
        storedApprovalIgnored: record(osHandoff.issueGate).technicalApproval === true,
        approvedSchedule: false as const,
        approvedBudget: false as const,
      },
    },
  ];
  const reasons = [
    "AUTHENTICATED_DELIVERY_APPROVAL_NOT_CONFIGURED",
    "ZONING_AUTHORITY_NOT_VERIFIED",
    "STRUCTURAL_APPROVAL_NOT_VERIFIED",
    ...(!architecturePresent ? ["ARCHITECTURE_MISSING"] : []),
    ...(!structurePresent ? ["STRUCTURAL_MODEL_MISSING"] : []),
    ...(!bimPresent ? ["BIM_COORDINATION_MISSING"] : []),
    ...(activeCriticalCount > 0 ? ["CRITICAL_ISSUES_OPEN"] : []),
    ...(!osUpstreamCurrent ? ["PROJECT_OS_HANDOFF_NOT_CURRENT"] : []),
  ];

  return {
    schema: "ARKEM-WORKING-DELIVERY-GATE/1.0" as const,
    project: {
      id: text(input.projectId, "PROJE-KIMLIGI-BEKLENIYOR"),
      revision: text(input.projectRevision, "P01"),
      name: text(input.projectName),
      phase: text(input.projectPhase),
    },
    state: activeCriticalCount ? "critical-blocked" as const : "review-required" as const,
    officialReleaseEligible: false as const,
    workingExportEligible: true as const,
    criticalIssueCount: activeCriticalCount,
    checks,
    reasons,
    limitations: [
      "Bu manifestoda resmî belge doğrulama ve elektronik onay altyapısı bulunmaz.",
      "Kaybolan parametrik uyarı, kontrol edilen gerçek modelin teknik onayı anlamına gelmez.",
      "Yerel proje kaydı kullanıcı tarafından değiştirilebilir; belge imzası ve yetki sunucu tarafında doğrulanmalıdır.",
    ],
  };
}

export function createWorkingDeliveryManifest(input: DeliveryReadinessInput) {
  const gate = createDeliveryReadiness(input);
  const coordination = record(input.modules["engineering-coordination"]);
  const bim = record(coordination.bimCoordination);
  const clashes = Array.isArray(bim.clashes) ? bim.clashes.map(safeIssue) : [];
  const reviewed = Array.isArray(coordination.reviewed) ? coordination.reviewed : [];
  return {
    schema: "ARKEM-WORKING-DELIVERY-MANIFEST/1.0" as const,
    generatedAt: new Date().toISOString(),
    identity: gate.project,
    status: "WORKING_DRAFT_NOT_APPROVED" as const,
    officialReleaseEligible: false as const,
    electronicSignatureVerified: false as const,
    nativeIfcAttached: false as const,
    nativeBcfZipAttached: false as const,
    source: {
      storage: "DEVICE_LOCAL_PROJECT_KERNEL" as const,
      architecture: "architectural-program",
      structure: "structural-concept",
      coordination: "engineering-coordination",
      projectControl: "project-os",
      originalDocumentHashVerified: false as const,
    },
    gate,
    issues: clashes.map((issue) => ({
      ...issue,
      status: reviewed.includes(issue.id) ? "REVIEWED_STILL_OPEN" as const : "OPEN" as const,
      technicalClosureVerified: false as const,
    })),
    boundary: "Yalnızca kaynaklı çalışma verisi ve ön değerlendirme; ruhsat, statik onay, onaylı IFC/BCF veya resmî dijital teslim değildir.",
  };
}
