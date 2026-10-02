export const PROJECT_STORAGE_KEY = "arkem-project-kernel-v2";
export const PROJECT_BACKUP_KEY = "arkem-project-kernel-v2-backup";
export const PROJECT_RECOVERY_KEY = "arkem-project-kernel-v2-recovery";

export type ProjectStorageEnvelope<T> = {
  schema: "ARKEM-STORAGE/2.0";
  savedAt: string;
  checksum: string;
  payload: T;
};

export type ProjectStorageResult<T> = {
  value: T | null;
  source: "primary" | "backup" | "recovery" | "legacy" | "reconciled" | "empty";
  integrity: "verified" | "legacy" | "missing";
  savedAt: string;
};


type ProjectSnapshotRecord = Record<string, unknown>;
type ProjectSnapshotEvent = {
  id?: unknown;
  module?: unknown;
  action?: unknown;
  timestamp?: unknown;
};

function record(value: unknown): ProjectSnapshotRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as ProjectSnapshotRecord
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function timestampValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function moduleRecordedAt(value: unknown, fallback = 0) {
  const module = record(value);
  const kernel = record(module._kernel);
  return timestampValue(kernel.recordedAt) || fallback;
}

function projectIdentity(value: unknown) {
  const project = record(value);
  return {
    id: text(project.id),
    revision: text(project.revision),
  };
}

function projectModules(value: unknown) {
  return record(record(value).modules);
}

function projectEvents(value: unknown): ProjectSnapshotEvent[] {
  const events = record(value).events;
  return Array.isArray(events)
    ? events.filter((event) => event && typeof event === "object" && !Array.isArray(event)) as ProjectSnapshotEvent[]
    : [];
}

function latestRemoval(events: ProjectSnapshotEvent[], moduleKey: string) {
  return events.reduce((latest, event) => {
    if (text(event.module) !== moduleKey || text(event.action) !== "remove") return latest;
    return Math.max(latest, timestampValue(event.timestamp));
  }, 0);
}

function mergeEvents(a: ProjectSnapshotEvent[], b: ProjectSnapshotEvent[]) {
  const byId = new Map<string, ProjectSnapshotEvent>();
  [...a, ...b].forEach((event, index) => {
    const id = text(event.id) || `${text(event.module)}:${text(event.action)}:${text(event.timestamp)}:${index}`;
    const existing = byId.get(id);
    if (!existing || timestampValue(event.timestamp) >= timestampValue(existing.timestamp)) byId.set(id, event);
  });
  return [...byId.values()]
    .sort((left, right) => timestampValue(left.timestamp) - timestampValue(right.timestamp))
    .slice(-160);
}

/**
 * Reconciles two snapshots of the same project without allowing a stale tab
 * to delete modules that exist in a newer/richer snapshot. Module-level
 * _kernel.recordedAt timestamps decide conflicts; explicit remove events act
 * as tombstones and prevent intentionally deleted modules from returning.
 */
export function reconcileProjectSnapshots<T>(incoming: T, stored: T | null): T {
  if (!stored) return incoming;
  const incomingProject = record(incoming);
  const storedProject = record(stored);
  const incomingIdentity = projectIdentity(incoming);
  const storedIdentity = projectIdentity(stored);

  if (
    !incomingIdentity.id
    || !storedIdentity.id
    || incomingIdentity.id !== storedIdentity.id
    || (incomingIdentity.revision && storedIdentity.revision && incomingIdentity.revision !== storedIdentity.revision)
  ) return incoming;

  const incomingUpdatedAt = timestampValue(incomingProject.updatedAt);
  const storedUpdatedAt = timestampValue(storedProject.updatedAt);
  const incomingEvents = projectEvents(incoming);
  const storedEvents = projectEvents(stored);
  const events = mergeEvents(storedEvents, incomingEvents);
  const incomingModules = projectModules(incoming);
  const storedModules = projectModules(stored);
  const modules: ProjectSnapshotRecord = {};

  new Set([...Object.keys(storedModules), ...Object.keys(incomingModules)]).forEach((key) => {
    const incomingModule = incomingModules[key];
    const storedModule = storedModules[key];
    const incomingStamp = incomingModule ? moduleRecordedAt(incomingModule, incomingUpdatedAt) : 0;
    const storedStamp = storedModule ? moduleRecordedAt(storedModule, storedUpdatedAt) : 0;
    const removedAt = latestRemoval(events, key);
    const candidate = incomingStamp >= storedStamp ? incomingModule : storedModule;
    const candidateStamp = Math.max(incomingStamp, storedStamp);
    if (candidate && removedAt < candidateStamp) modules[key] = candidate;
  });

  const newerProject = incomingUpdatedAt >= storedUpdatedAt ? incomingProject : storedProject;
  const olderProject = incomingUpdatedAt >= storedUpdatedAt ? storedProject : incomingProject;
  const updatedAt = incomingUpdatedAt >= storedUpdatedAt
    ? text(incomingProject.updatedAt)
    : text(storedProject.updatedAt);

  return {
    ...olderProject,
    ...newerProject,
    modules,
    events,
    updatedAt: updatedAt || text(newerProject.updatedAt) || text(olderProject.updatedAt),
  } as T;
}

function snapshotModuleCount(value: unknown) {
  return Object.keys(projectModules(value)).length;
}

function sameProject(a: unknown, b: unknown) {
  const left = projectIdentity(a);
  const right = projectIdentity(b);
  return Boolean(left.id && right.id && left.id === right.id && (!left.revision || !right.revision || left.revision === right.revision));
}


/**
 * Recovery snapshots are fallback-only. They may restore a module that is
 * completely missing from the authoritative snapshot, but they must never
 * replace an overlapping module: doing so can resurrect stale plan/model data.
 */
export function supplementMissingProjectModules<T>(authoritative: T, fallback: T | null): T {
  if (!fallback || !sameProject(authoritative, fallback)) return authoritative;
  const primary = record(authoritative);
  const secondary = record(fallback);
  const modules = { ...projectModules(fallback), ...projectModules(authoritative) };
  const events = mergeEvents(projectEvents(fallback), projectEvents(authoritative));
  const authoritativeUpdatedAt = text(primary.updatedAt);
  return {
    ...secondary,
    ...primary,
    modules,
    events,
    updatedAt: authoritativeUpdatedAt || text(secondary.updatedAt),
  } as T;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function encodeProjectEnvelope<T>(payload: T, savedAt = new Date().toISOString()) {
  const serialized = JSON.stringify(payload);
  const envelope: ProjectStorageEnvelope<T> = {
    schema: "ARKEM-STORAGE/2.0",
    savedAt,
    checksum: hashText(serialized),
    payload,
  };
  return JSON.stringify(envelope);
}

export function decodeProjectEnvelope<T>(raw: string | null): ProjectStorageResult<T> {
  if (!raw) return { value: null, source: "empty", integrity: "missing", savedAt: "" };
  try {
    const parsed = JSON.parse(raw) as ProjectStorageEnvelope<T> | T;
    if (parsed && typeof parsed === "object" && "schema" in parsed && parsed.schema === "ARKEM-STORAGE/2.0" && "payload" in parsed) {
      const envelope = parsed as ProjectStorageEnvelope<T>;
      const verified = hashText(JSON.stringify(envelope.payload)) === envelope.checksum;
      return verified
        ? { value: envelope.payload, source: "primary", integrity: "verified", savedAt: envelope.savedAt }
        : { value: null, source: "empty", integrity: "missing", savedAt: "" };
    }
    return { value: parsed as T, source: "legacy", integrity: "legacy", savedAt: "" };
  } catch {
    return { value: null, source: "empty", integrity: "missing", savedAt: "" };
  }
}

export function loadProjectFromStorage<T>(storage: Storage, legacyKey: string): ProjectStorageResult<T> {
  const primary = decodeProjectEnvelope<T>(storage.getItem(PROJECT_STORAGE_KEY));
  const backup = decodeProjectEnvelope<T>(storage.getItem(PROJECT_BACKUP_KEY));
  const recovery = decodeProjectEnvelope<T>(storage.getItem(PROJECT_RECOVERY_KEY));
  const legacy = decodeProjectEnvelope<T>(storage.getItem(legacyKey));
  const candidates = [
    primary.value ? { ...primary, source: "primary" as const } : null,
    backup.value ? { ...backup, source: "backup" as const } : null,
    recovery.value ? { ...recovery, source: "recovery" as const } : null,
    legacy.value ? { ...legacy, source: "legacy" as const } : null,
  ].filter(Boolean) as Array<ProjectStorageResult<T> & { value: T }>;

  if (!candidates.length) return { value: null, source: "empty", integrity: "missing", savedAt: "" };

  const base = candidates[0];
  let merged = base.value;
  let recoveredMissingModules = false;
  let mergedSavedAt = base.savedAt;

  candidates.slice(1).forEach((candidate) => {
    if (!sameProject(merged, candidate.value)) return;
    const beforeCount = snapshotModuleCount(merged);
    merged = supplementMissingProjectModules(merged, candidate.value);
    if (snapshotModuleCount(merged) > beforeCount) recoveredMissingModules = true;
    if (timestampValue(candidate.savedAt) > timestampValue(mergedSavedAt)) mergedSavedAt = candidate.savedAt;
  });

  return {
    value: merged,
    source: recoveredMissingModules ? "reconciled" : base.source,
    integrity: base.integrity,
    savedAt: mergedSavedAt,
  };
}

export function saveProjectToStorage<T>(storage: Storage, payload: T, savedAt = new Date().toISOString()) {
  const previousRaw = storage.getItem(PROJECT_STORAGE_KEY);
  const previous = decodeProjectEnvelope<T>(previousRaw);
  const recovery = decodeProjectEnvelope<T>(storage.getItem(PROJECT_RECOVERY_KEY));

  // Only the immediately previous primary may win an overlapping-module
  // conflict via recordedAt. Recovery is fallback-only and can add missing
  // modules, never replace current/primary values.
  let reconciled = reconcileProjectSnapshots(payload, previous.value);
  reconciled = supplementMissingProjectModules(reconciled, recovery.value);

  if (previousRaw) storage.setItem(PROJECT_BACKUP_KEY, previousRaw);
  storage.setItem(PROJECT_STORAGE_KEY, encodeProjectEnvelope(reconciled, savedAt));

  const recoveryPayload = supplementMissingProjectModules(reconciled, recovery.value);
  storage.setItem(PROJECT_RECOVERY_KEY, encodeProjectEnvelope(recoveryPayload, savedAt));

  return {
    savedAt,
    backupAvailable: Boolean(previousRaw || storage.getItem(PROJECT_BACKUP_KEY) || storage.getItem(PROJECT_RECOVERY_KEY)),
    bytes: new Blob([JSON.stringify(reconciled)]).size,
    payload: reconciled,
    reconciled: JSON.stringify(reconciled) !== JSON.stringify(payload),
  };
}


export function clearProjectStorage(storage: Storage, legacyKey: string) {
  storage.removeItem(PROJECT_STORAGE_KEY);
  storage.removeItem(PROJECT_BACKUP_KEY);
  storage.removeItem(PROJECT_RECOVERY_KEY);
  storage.removeItem(legacyKey);
}
