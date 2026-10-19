import type { ProjectCoreSnapshot, ProjectDataTrust } from "./project-core";
import type { ProjectThread } from "./project-graph";
import { isDigitalBrief } from "./digital-brief.ts";

export type PortalProject = {
  schema: "ARKEM-PROJECT/1.0";
  id: string;
  name: string;
  revision: string;
  phase: string;
  updatedAt: string;
  modules: Record<string, unknown>;
  events: unknown[];
};

export type AccountProjectRecord = {
  id: string;
  name: string;
  phase: string;
  revision: string;
  status: string;
  updatedAt: string;
  payload: PortalProject | null;
};

export type PortalLoadState = "loading" | "ready" | "signed-out" | "error";
export type PortalRecordState =
  | "loading"
  | "empty"
  | "device-only"
  | "account-only"
  | "aligned"
  | "conflict"
  | "error";

export type ProjectRecordResolution = {
  state: PortalRecordState;
  label: string;
  detail: string;
  matchingProject: AccountProjectRecord | null;
  accountProjectCount: number;
};

export type PortalWorkItem = {
  id: string;
  title: string;
  detail: string;
  owner: string;
  status: "Sıradaki adım" | "Eksik" | "İnceleme" | "Karar bekliyor";
  target: string;
  route: string;
  tone: "next" | "warning" | "review" | "decision";
};

export type PortalProjectSection = {
  id: "parcel" | "architecture" | "structure" | "coordination";
  label: string;
  route: string;
  trust: ProjectDataTrust;
  status: string;
  fields: ProjectCoreSnapshot["fields"];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function boundedText(value: unknown, minimum: number, maximum: number) {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum;
}

function isoTimestamp(value: unknown) {
  return boundedText(value, 20, 40)
    && Number.isFinite(Date.parse(value as string))
    && new Date(value as string).toISOString() === value;
}

function safeJsonTree(value: unknown, depth = 0, budget = { nodes: 0 }): boolean {
  budget.nodes += 1;
  if (budget.nodes > 50_000 || depth > 14) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 100_000;
  if (Array.isArray(value)) {
    return value.length <= 2_000
      && value.every((item) => safeJsonTree(item, depth + 1, budget));
  }
  if (!value || typeof value !== "object") return false;
  const entries = Object.entries(value as UnknownRecord);
  return entries.length <= 500
    && entries.every(([key, item]) => (
      key.length > 0
      && key.length <= 160
      && key !== "__proto__"
      && key !== "prototype"
      && key !== "constructor"
      && safeJsonTree(item, depth + 1, budget)
    ));
}

function validModuleStamp(
  projectId: string,
  moduleId: string,
  value: unknown,
) {
  const moduleValue = record(value);
  if (!Object.prototype.hasOwnProperty.call(moduleValue, "_kernel")) return true;
  const stamp = record(moduleValue._kernel);
  const action = text(stamp.action);
  return stamp.schema === "ARKEM-MODULE-LINK/1.0"
    && stamp.projectId === projectId
    && boundedText(stamp.projectRevision, 1, 24)
    && boundedText(stamp.sourceModule, 1, 64)
    && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(stamp.sourceModule as string)
    && (action === "handoff" || stamp.sourceModule === moduleId)
    && isoTimestamp(stamp.recordedAt)
    && ["created", "updated", "imported", "handoff"].includes(action);
}

export function isPortalProject(value: unknown): value is PortalProject {
  const candidate = record(value);
  const modules = record(candidate.modules);
  return candidate.schema === "ARKEM-PROJECT/1.0"
    && boundedText(candidate.id, 1, 64)
    && /^[A-Za-z0-9_-]+$/.test(candidate.id as string)
    && boundedText(candidate.name, 1, 160)
    && boundedText(candidate.revision, 1, 24)
    && boundedText(candidate.phase, 1, 80)
    && isoTimestamp(candidate.updatedAt)
    && candidate.modules === modules
    && Object.keys(modules).length <= 64
    && Object.entries(modules).every(([moduleId, moduleValue]) => (
      /^[a-z0-9][a-z0-9-]{0,63}$/i.test(moduleId)
      && validModuleStamp(
        candidate.id as string,
        moduleId,
        moduleValue,
      )
    ))
    && Array.isArray(candidate.events)
    && candidate.events.length <= 500
    && candidate.events.every((event) => {
      const eventRecord = record(event);
      return eventRecord === event
        && Object.keys(eventRecord).length <= 16
        && safeJsonTree(eventRecord);
    })
    && safeJsonTree(candidate);
}

export function validateAccountProjectPayload(expectedId: string, value: unknown) {
  if (!isPortalProject(value)) {
    return {
      ok: false as const,
      error: "Proje veri paketi doğrulanamadı.",
      project: null,
    };
  }
  if (value.id !== expectedId) {
    return {
      ok: false as const,
      error: "Proje kodu ile veri paketi kimliği eşleşmiyor.",
      project: null,
    };
  }
  return {
    ok: true as const,
    error: "",
    project: value,
  };
}

export function resolveAccountProjectWritePrecondition(
  expectedAccountUpdatedAt: unknown,
  existingAccountUpdatedAt: string | null,
) {
  if (
    expectedAccountUpdatedAt !== null
    && (
      typeof expectedAccountUpdatedAt !== "string"
      || expectedAccountUpdatedAt.length === 0
      || expectedAccountUpdatedAt.length > 64
    )
  ) {
    return {
      ok: false as const,
      status: 400 as const,
      error: "Hesap proje sürümü belirtilmedi.",
    };
  }
  if (existingAccountUpdatedAt === null) {
    return expectedAccountUpdatedAt === null
      ? { ok: true as const, mode: "create" as const }
      : {
          ok: false as const,
          status: 409 as const,
          error: "Hesap projesi başka bir oturumda kaldırıldı. Kayıtlar yenilenmeden üzerine yazılmadı.",
        };
  }
  if (expectedAccountUpdatedAt === null) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "Aynı proje kodu hesabınızda zaten var. Mevcut kayıt açılmadan üzerine yazılmadı.",
    };
  }
  if (expectedAccountUpdatedAt !== existingAccountUpdatedAt) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "Hesap projesi başka bir cihazda güncellendi. Son kayıt açılmadan üzerine yazılmadı.",
    };
  }
  return { ok: true as const, mode: "update" as const };
}

export function hasMeaningfulProject(project: PortalProject) {
  return Object.keys(project.modules).length > 0
    || project.name.trim().toLocaleLowerCase("tr-TR") !== "yeni yapı yatırımı";
}

function comparableProject(project: PortalProject) {
  return JSON.stringify({
    schema: project.schema,
    id: project.id,
    name: project.name,
    revision: project.revision,
    phase: project.phase,
    modules: project.modules,
  });
}

export function resolveProjectRecord(
  project: PortalProject,
  accountProjects: AccountProjectRecord[],
  loadState: PortalLoadState,
): ProjectRecordResolution {
  const meaningful = hasMeaningfulProject(project);
  const matchingProject = accountProjects.find((item) => item.id === project.id) ?? null;
  const base = {
    matchingProject,
    accountProjectCount: accountProjects.length,
  };

  if (loadState === "loading") {
    return {
      ...base,
      state: "loading",
      label: "Hesap kayıtları yükleniyor",
      detail: "Bu cihazdaki taslak korunurken güvenli hesap kayıtları kontrol ediliyor.",
    };
  }
  if (loadState === "error") {
    return {
      ...base,
      state: "error",
      label: "Hesap bağlantısı kurulamadı",
      detail: "Bu cihazdaki proje korunuyor. Bağlantıyı yeniden deneyebilirsiniz.",
    };
  }
  if (!meaningful && !accountProjects.length) {
    return {
      ...base,
      state: "empty",
      label: "Henüz proje yok",
      detail: "Kısa bir brief oluşturarak ilk proje kaydınızı başlatın.",
    };
  }
  if (!meaningful && accountProjects.length) {
    return {
      ...base,
      state: "account-only",
      label: "Hesabınızda kayıtlı proje var",
      detail: "Açmak istediğiniz hesabı seçmeden bu cihazdaki alan değiştirilmeyecek.",
    };
  }
  if (loadState === "signed-out" || !matchingProject) {
    return {
      ...base,
      state: "device-only",
      label: "Bu cihazdaki taslak",
      detail: loadState === "signed-out"
        ? "Proje bu cihazda kayıtlı. Farklı cihazlarda açmak için hesabınıza giriş yapın."
        : "Bu proje henüz hesabınıza kaydedilmedi; diğer hesap projeleri değiştirilmedi.",
    };
  }
  if (
    matchingProject.payload
    && comparableProject(project) === comparableProject(matchingProject.payload)
  ) {
    return {
      ...base,
      state: "aligned",
      label: "Hesap ve cihaz kayıtları eşleşiyor",
      detail: `${project.revision} revizyonu güvenli hesap kaydıyla aynı içerikte.`,
    };
  }
  return {
    ...base,
    state: "conflict",
    label: "Kayıt çakışması",
    detail: "Hesap ve cihaz sürümleri farklı. Karşılaştırmadan hiçbir kayıt diğerinin üzerine yazılmayacak.",
  };
}

function guidedJourney(project: PortalProject) {
  const decision = record(project.modules["decision-assistant"]);
  const result = record(decision.result);
  return record(result.guidedJourney);
}

export function readPortalDecisions(project: PortalProject) {
  const portal = record(project.modules["client-portal"]);
  if (!Array.isArray(portal.decisions)) return [];
  return portal.decisions
    .map((value) => record(value))
    .filter((value) => typeof value.id === "string" && typeof value.text === "string")
    .map((value) => ({
      id: text(value.id),
      text: text(value.text),
      owner: text(value.owner, "Proje sahibi"),
      status: text(value.status, "Açık"),
      target: text(value.target, "Tarih belirlenmedi"),
      createdAt: text(value.createdAt),
    }));
}

export function derivePortalWorkItems(
  project: PortalProject,
  thread: ProjectThread,
): PortalWorkItem[] {
  const items: PortalWorkItem[] = [{
    id: "next-action",
    title: thread.nextAction.label,
    detail: thread.nextAction.blockedBy.length
      ? `${thread.nextAction.blockedBy.length} ön koşul tamamlandığında açılır.`
      : "Mevcut proje verisine göre şimdi tamamlanabilir ilk çalışma.",
    owner: "Proje sahibi + Arkem",
    status: "Sıradaki adım",
    target: "Bugün",
    route: thread.nextAction.route,
    tone: "next",
  }];

  const missingDocuments = guidedJourney(project).missingDocuments;
  if (Array.isArray(missingDocuments) && missingDocuments.length) {
    items.push({
      id: "missing-document",
      title: text(missingDocuments[0], "Eksik proje belgesi"),
      detail: missingDocuments.length > 1
        ? `${missingDocuments.length} belge proje yolculuğunda eksik görünüyor.`
        : "Bu belge sonraki teknik doğrulama için gerekli.",
      owner: "Proje sahibi",
      status: "Eksik",
      target: "Sonraki adım öncesi",
      route: "/proje-baslat?edit=1&step=1",
      tone: "warning",
    });
  }

  const criticalIssue = thread.issues.find((issue) => issue.severity === "critical")
    ?? thread.issues.find((issue) => issue.severity === "review");
  if (criticalIssue) {
    items.push({
      id: criticalIssue.id,
      title: criticalIssue.title,
      detail: criticalIssue.action,
      owner: "Arkem mühendislik",
      status: criticalIssue.severity === "critical" ? "İnceleme" : "Karar bekliyor",
      target: "Teknik görüşme öncesi",
      route: criticalIssue.route,
      tone: "review",
    });
  }

  const openDecision = readPortalDecisions(project).find((decision) => decision.status !== "Kapalı");
  if (openDecision) {
    items.push({
      id: openDecision.id,
      title: openDecision.text,
      detail: "Karar kaydı sonuçlandırılmayı bekliyor.",
      owner: openDecision.owner,
      status: "Karar bekliyor",
      target: openDecision.target,
      route: "#kararlar-ve-dosyalar",
      tone: "decision",
    });
  }

  const brief = record(project.modules["digital-tools-brief"]);
  if (isDigitalBrief(brief.input)) items.unshift({ id: "digital-brief", title: "Ön görüşme dosyanıza devam edin", detail: "Müşteri beyanlarını, açık konuları ve önerilen hizmet yolunu gözden geçirin. Uzman değerlendirmesi yapılmış sayılmaz.", owner: "Proje sahibi + ARKEM", status: "Sıradaki adım", target: "Kapsam görüşmesi öncesi", route: "/dijital-donusum", tone: "next" });
  return items.slice(0, 4);
}

function sectionTrust(fields: ProjectCoreSnapshot["fields"]): ProjectDataTrust {
  if (fields.every((field) => field.trust === "missing")) return "missing";
  // One identifier cannot certify a whole parcel/geometry/zoning section.
  if (fields.length && fields.every((field) => field.trust === "verified")) return "verified";
  if (fields.some((field) => field.trust === "derived")) return "derived";
  return "declared";
}

export function derivePortalProjectSections(core: ProjectCoreSnapshot): PortalProjectSection[] {
  const definitions: Array<{
    id: PortalProjectSection["id"];
    label: string;
    route: string;
    fieldIds: string[];
  }> = [
    {
      id: "parcel",
      label: "Parsel ve imar",
      route: "/imar-entegrasyon-merkezi",
      fieldIds: ["location", "parcel-id", "parcel-geometry", "zoning"],
    },
    {
      id: "architecture",
      label: "Mimari program",
      route: "/mimari-program-studyosu",
      fieldIds: ["program", "floors"],
    },
    {
      id: "structure",
      label: "Taşıyıcı sistem",
      route: "/yapi-sistemi-karsilastirma",
      fieldIds: ["structure"],
    },
    {
      id: "coordination",
      label: "Koordinasyon",
      route: "/muhendislik-koordinasyon",
      fieldIds: ["coordination"],
    },
  ];

  return definitions.map((definition) => {
    const fields = core.fields.filter((field) => definition.fieldIds.includes(field.id));
    const trust = sectionTrust(fields);
    const complete = fields.filter((field) => field.trust !== "missing").length;
    return {
      ...definition,
      fields,
      trust,
      status: complete === fields.length
        ? "Bilgi mevcut"
        : complete
          ? `${complete}/${fields.length} bilgi hazır`
          : "Başlangıç bilgisi bekleniyor",
    };
  });
}
