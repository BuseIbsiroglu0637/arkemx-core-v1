import type { V3ProjectRecord } from "../data/projects-v3";
import {
  ENGINEERING_CAPABILITY_IDS,
  type EngineeringCapabilityId,
} from "../data/engineering-v3.ts";

export const PROJECT_EVIDENCE_STATES = [
  "received",
  "in_review",
  "verified",
  "published",
  "rejected",
] as const;

export const PROJECT_EVIDENCE_ACTIONS = [
  "start_review",
  "verify",
  "publish",
  "withdraw",
  "reject",
  "restore",
] as const;

export const PROJECT_EVIDENCE_TARGET_TYPES = ["fact", "stage", "capability", "media"] as const;

export const PROJECT_FACT_KEYS = [
  "location",
  "buildingType",
  "system",
  "year",
  "area",
  "client",
  "arkemRole",
  "projectStatus",
] as const;

export const PROJECT_STAGE_KEYS = ["01", "02", "03", "04", "05", "06", "07"] as const;

export type ProjectEvidenceState = typeof PROJECT_EVIDENCE_STATES[number];
export type ProjectEvidenceAction = typeof PROJECT_EVIDENCE_ACTIONS[number];
export type ProjectEvidenceTargetType = typeof PROJECT_EVIDENCE_TARGET_TYPES[number];
export type ProjectFactKey = typeof PROJECT_FACT_KEYS[number];

export type PublishedProjectEvidenceItem = {
  id: string;
  projectSlug: string;
  targetType: ProjectEvidenceTargetType;
  targetKey: string;
  claimValue: string;
  sourceLabel: string;
  status: ProjectEvidenceState;
  fileName: string | null;
  contentType: string | null;
};

export type PublishedProjectMedia = {
  id: string;
  caption: string;
  sourceLabel: string;
  fileName: string;
  contentType: string;
  href: string;
};

export type PublishedEngineeringEvidence = {
  id: string;
  capabilityId: EngineeringCapabilityId;
  summary: string;
  sourceLabel: string;
  fileName: string;
  contentType: string;
  href: string;
};

export type V3PublishedProjectRecord = V3ProjectRecord & {
  publishedMedia: readonly PublishedProjectMedia[];
  engineeringEvidence: readonly PublishedEngineeringEvidence[];
};

const transitions: Record<ProjectEvidenceState, Partial<Record<ProjectEvidenceAction, ProjectEvidenceState>>> = {
  received: { start_review: "in_review", reject: "rejected" },
  in_review: { verify: "verified", reject: "rejected" },
  verified: { publish: "published", start_review: "in_review", reject: "rejected" },
  published: { withdraw: "verified" },
  rejected: { restore: "received" },
};

export function resolveProjectEvidenceTransition(
  current: ProjectEvidenceState,
  action: ProjectEvidenceAction,
): ProjectEvidenceState {
  const next = transitions[current]?.[action];
  if (!next) throw new Error(`Geçersiz proje kanıtı durum geçişi: ${current} → ${action}`);
  return next;
}

export function isProjectEvidenceState(value: unknown): value is ProjectEvidenceState {
  return PROJECT_EVIDENCE_STATES.includes(value as ProjectEvidenceState);
}

export function isProjectEvidenceAction(value: unknown): value is ProjectEvidenceAction {
  return PROJECT_EVIDENCE_ACTIONS.includes(value as ProjectEvidenceAction);
}

export function isProjectEvidenceTarget(
  targetType: unknown,
  targetKey: unknown,
): targetType is ProjectEvidenceTargetType {
  if (!PROJECT_EVIDENCE_TARGET_TYPES.includes(targetType as ProjectEvidenceTargetType)) return false;
  if (typeof targetKey !== "string") return false;
  if (targetType === "fact") return PROJECT_FACT_KEYS.includes(targetKey as ProjectFactKey);
  if (targetType === "stage") return PROJECT_STAGE_KEYS.includes(targetKey as typeof PROJECT_STAGE_KEYS[number]);
  if (targetType === "capability") return ENGINEERING_CAPABILITY_IDS.includes(targetKey as EngineeringCapabilityId);
  return targetKey === "media";
}

export function canPublishProjectEvidence(item: {
  status: ProjectEvidenceState;
  targetType: ProjectEvidenceTargetType;
  targetKey: string;
  claimValue: string;
  sourceLabel: string;
  fileKey: string | null;
}): boolean {
  if (item.status !== "verified") return false;
  if (!isProjectEvidenceTarget(item.targetType, item.targetKey)) return false;
  if (item.sourceLabel.trim().length < 3 || !item.fileKey) return false;
  return item.targetType === "media" || item.claimValue.trim().length > 0;
}

export function applyPublishedProjectEvidence(
  project: V3ProjectRecord,
  items: readonly PublishedProjectEvidenceItem[],
): V3PublishedProjectRecord {
  const facts = { ...project.facts };
  const stages = project.caseStudy.map((stage) => ({ ...stage }));
  const publishedMedia: PublishedProjectMedia[] = project.archiveMedia.map((item) => ({ ...item }));
  const engineeringEvidence: PublishedEngineeringEvidence[] = [];

  for (const item of items) {
    if (item.status !== "published" || item.projectSlug !== project.slug) continue;
    if (item.targetType === "fact" && PROJECT_FACT_KEYS.includes(item.targetKey as ProjectFactKey)) {
      const key = item.targetKey as ProjectFactKey;
      facts[key] = {
        ...facts[key],
        value: item.claimValue,
        status: "doğrulandı",
        source: item.sourceLabel,
      };
      continue;
    }
    if (item.targetType === "stage" && PROJECT_STAGE_KEYS.includes(item.targetKey as typeof PROJECT_STAGE_KEYS[number])) {
      const index = stages.findIndex((stage) => stage.code === item.targetKey);
      if (index >= 0) stages[index] = {
        ...stages[index],
        summary: item.claimValue,
        evidenceNeeded: item.sourceLabel,
        status: "doğrulandı",
      };
      continue;
    }
    if (item.targetType === "capability"
      && ENGINEERING_CAPABILITY_IDS.includes(item.targetKey as EngineeringCapabilityId)
      && item.fileName
      && item.contentType) {
      engineeringEvidence.push({
        id: item.id,
        capabilityId: item.targetKey as EngineeringCapabilityId,
        summary: item.claimValue,
        sourceLabel: item.sourceLabel,
        fileName: item.fileName,
        contentType: item.contentType,
        href: `/api/project-evidence/file/${encodeURIComponent(item.id)}`,
      });
      continue;
    }
    if (item.targetType === "media" && item.fileName && item.contentType) {
      if (publishedMedia.some((mediaItem) => mediaItem.id === item.id)) continue;
      publishedMedia.push({
        id: item.id,
        caption: item.claimValue,
        sourceLabel: item.sourceLabel,
        fileName: item.fileName,
        contentType: item.contentType,
        href: `/api/project-evidence/file/${encodeURIComponent(item.id)}`,
      });
    }
  }

  const identity = project.sourceManifest.find((item) => item.label === "Proje kimliği");
  const mediaManifest = publishedMedia.length ? {
    label: "Medya ve yayın hakkı",
    value: `${publishedMedia.length} doğrulanmış medya kaydı`,
    status: "doğrulandı" as const,
    source: project.archiveMedia.length
      ? "ARKEM proje arşivi ve Proje Kanıt Merkezi yayın kapısı"
      : "Proje Kanıt Merkezi yayın kapısı",
  } : project.sourceManifest.find((item) => item.label === "Medya ve yayın hakkı");
  const sourceManifest = [identity, ...Object.values(facts), mediaManifest].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    ...project,
    facts,
    caseStudy: stages,
    sourceManifest,
    publishedMedia,
    engineeringEvidence,
    evidenceStatus: publishedMedia.length > 0 ? "kısmi doğrulama" : project.evidenceStatus,
    media: publishedMedia.length ? {
      status: "doğrulandı",
      note: "Yayımlanan medya kayıtları kaynak dosya, dosya özeti ve yayın kapısı ile ilişkilidir.",
      items: publishedMedia.map((item) => item.href),
    } : project.media,
  };
}
