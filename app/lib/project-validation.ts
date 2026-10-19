import { isPortalProject, type PortalProject } from "./customer-portal.ts";

/** Same runtime boundary for device restore, file import and account payloads. */
export function isKernelProject(value: unknown): value is PortalProject {
  if (!isPortalProject(value)) return false;
  const candidate = value as unknown as Record<string, unknown>;
  if (!["Fikir", "Ön fizibilite", "Avan proje", "Uygulama projesi", "Yapım", "Teslim"].includes(value.phase)) return false;
  if (candidate.coordinateReference !== undefined && (typeof candidate.coordinateReference !== "string" || candidate.coordinateReference.length > 160)) return false;
  if (candidate.experience !== undefined) {
    const experience = candidate.experience as Record<string, unknown> | null;
    if (!experience || Array.isArray(experience) || typeof experience !== "object"
      || !["guided", "technical"].includes(String(experience.mode))
      || typeof experience.autoHandoff !== "boolean"
      || typeof experience.lastSynchronizedAt !== "string"
      || (experience.lastSynchronizedAt !== "" && !Number.isFinite(Date.parse(experience.lastSynchronizedAt)))) return false;
  }
  return value.events.every((item) => {
    const event = item as Record<string, unknown>;
    return typeof event.id === "string" && event.id.length > 0 && event.id.length <= 160
      && typeof event.module === "string" && event.module.length > 0 && event.module.length <= 64
      && ["create", "update", "remove", "import", "handoff"].includes(String(event.action))
      && typeof event.revision === "string" && event.revision.length > 0 && event.revision.length <= 24
      && typeof event.timestamp === "string" && Number.isFinite(Date.parse(event.timestamp));
  });
}
