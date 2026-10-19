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
export function saveLibraryProject(storage: DeviceStorage, project: ProjectKernelState): ProjectKernelState[] {
  if (!isKernelProject(project)) throw new Error("Proje kaydı geçerli değil.");
  const projects = loadProjectLibrary(storage);
  const previous = projects.find(p => p.id === project.id);
  if (previous && Date.parse(previous.updatedAt) > Date.parse(project.updatedAt)) return projects;
  const next = [...projects.filter(p => p.id !== project.id), project].sort((a,b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const raw = storage.getItem(PROJECT_LIBRARY_KEY);
  if (parse(raw)) storage.setItem(PROJECT_LIBRARY_BACKUP_KEY, raw!);
  storage.setItem(PROJECT_LIBRARY_KEY, encodeProjectEnvelope(next));
  return next;
}
