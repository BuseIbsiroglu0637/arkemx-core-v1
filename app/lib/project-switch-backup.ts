export const PROJECT_VAULT_KEY = "arkem-project-vault-v1";
type BackupStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type Snapshot = { id: string; name: string; revision: string; savedAt: string; data: unknown };

function readVault(storage: BackupStorage): Snapshot[] {
  const raw = storage.getItem(PROJECT_VAULT_KEY);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Proje kasası okunamadı; mevcut kayıtların üzerine yazılmadı.");
  return value;
}
/** Compare an actual saved snapshot; a requested download is not preservation evidence. */
export function hasCurrentProjectBackup(storage: BackupStorage, project: unknown) {
  try { const content = JSON.stringify(project); return readVault(storage).some(snapshot => snapshot && JSON.stringify(snapshot.data) === content); }
  catch { return false; }
}
export function preserveProjectSwitchBackup(storage: BackupStorage, project: { id: string; name: string; revision: string }, savedAt = new Date().toISOString()) {
  if (hasCurrentProjectBackup(storage, project)) return;
  const previous = readVault(storage);
  const snapshot = { id: `${project.id}-new-project-${crypto.randomUUID()}`, name: project.name, revision: project.revision, savedAt, data: project };
  storage.setItem(PROJECT_VAULT_KEY, JSON.stringify([snapshot, ...previous]));
  if (!hasCurrentProjectBackup(storage, project)) throw new Error("Geri dönüş kopyası cihazda doğrulanamadı.");
}
