import { DEMO_STORAGE_KEY, DEMO_BACKUP_KEY } from "./demo.ts";
export const PROJECT_STORAGE_KEY = DEMO_STORAGE_KEY;
export const PROJECT_BACKUP_KEY = DEMO_BACKUP_KEY;

export type ProjectStorageEnvelope<T> = {
  schema: "ARKEM-STORAGE/2.0";
  savedAt: string;
  checksum: string;
  payload: T;
};

export type ProjectStorageResult<T> = {
  value: T | null;
  source: "primary" | "backup" | "legacy" | "empty";
  integrity: "verified" | "legacy" | "missing";
  savedAt: string;
};

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
  if (primary.value) return primary;
  const backup = decodeProjectEnvelope<T>(storage.getItem(PROJECT_BACKUP_KEY));
  if (backup.value) return { ...backup, source: "backup" };
  const legacy = decodeProjectEnvelope<T>(storage.getItem(legacyKey));
  return legacy.value ? legacy : { value: null, source: "empty", integrity: "missing", savedAt: "" };
}

export function saveProjectToStorage<T>(storage: Storage, payload: T, savedAt = new Date().toISOString()) {
  const previous = storage.getItem(PROJECT_STORAGE_KEY);
  if (previous && decodeProjectEnvelope(previous).value) storage.setItem(PROJECT_BACKUP_KEY, previous);
  storage.setItem(PROJECT_STORAGE_KEY, encodeProjectEnvelope(payload, savedAt));
  return {
    savedAt,
    backupAvailable: Boolean(decodeProjectEnvelope(storage.getItem(PROJECT_BACKUP_KEY)).value),
    bytes: new Blob([JSON.stringify(payload)]).size,
  };
}
