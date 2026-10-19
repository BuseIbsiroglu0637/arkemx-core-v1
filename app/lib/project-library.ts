import type { ProjectKernelState } from "../components/ProjectKernel";
import { decodeProjectEnvelope, encodeProjectEnvelope } from "./project-storage.ts";
import { isKernelProject } from "./project-validation.ts";

export const PROJECT_LIBRARY_KEY = "arkem-demo-v177-projects";
export const PROJECT_LIBRARY_BACKUP_KEY = "arkem-demo-v177-projects-backup";
type DeviceStorage = Pick<Storage, "getItem" | "setItem">;
function parse(raw: string | null): ProjectKernelState[] | null {
  const value = decodeProjectEnvelope<unknown>(raw).value;
  if (!Array.isArray(value) || !value.every(isKernelProject)) return null;
  if (new Set(value.map(p => p.id)).size !== value.length) return null;
  return value as ProjectKernelState[];
}
export function loadProjectLibrary(storage: DeviceStorage): ProjectKernelState[] {
  const raw = storage.getItem(PROJECT_LIBRARY_KEY);
  const backup = storage.getItem(PROJECT_LIBRARY_BACKUP_KEY);
  const projects = parse(raw) ?? parse(backup);
  if (projects) return projects;
  if (raw !== null || backup !== null) throw new Error("Proje listesi okunamadı. Kayıtların üzerine yazılmadı.");
  return [];
}
/**
 * Validate what the browser can actually save, not a transient React object.
 * Optional undefined properties are omitted by JSON in both local project
 * storage and the library. Other invalid values must still fail closed.
 */
function persistableSnapshot(project: ProjectKernelState): ProjectKernelState {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(project, (_key, value: unknown) => {
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite project number");
      if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") throw new Error("Non-JSON project value");
      return value;
    });
  } catch {
    throw new Error("Proje kaydında JSON'a dönüştürülemeyen veri var. Kayıtlar değiştirilmedi.");
  }
  if (!serialized) throw new Error("Proje kaydı boş. Kayıtlar değiştirilmedi.");
  const snapshot = JSON.parse(serialized) as unknown;
  if (!isKernelProject(snapshot)) throw new Error("Proje kaydı geçerli değil. Kimlik, modül bağlantısı veya veri yapısı kontrol edilmeli; kayıtlar değiştirilmedi.");
  return snapshot;
}

export function saveLibraryProject(storage: DeviceStorage, project: ProjectKernelState): ProjectKernelState[] {
  const snapshot = persistableSnapshot(project);
  const projects = loadProjectLibrary(storage);
  const previous = projects.find(p => p.id === snapshot.id);
  if (previous && Date.parse(previous.updatedAt) > Date.parse(snapshot.updatedAt)) return projects;
  const next = [...projects.filter(p => p.id !== snapshot.id), snapshot].sort((a,b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const raw = storage.getItem(PROJECT_LIBRARY_KEY);
  if (parse(raw)) storage.setItem(PROJECT_LIBRARY_BACKUP_KEY, raw!);
  storage.setItem(PROJECT_LIBRARY_KEY, encodeProjectEnvelope(next));
  return next;
}
