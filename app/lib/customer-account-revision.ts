// This device-local token is only a compare-and-swap hint. The server remains
// authoritative and checks both account ownership and the stored revision.
const key = (id: string) => `arkem-account-revision:${id}`;
export function rememberAccountRevision(id: string, updatedAt: string) {
  if (!id || !updatedAt) return;
  try { window.sessionStorage.setItem(key(id), updatedAt); } catch { /* Optional continuity hint. */ }
}
export function readAccountRevision(id: string): string | null {
  try { return window.sessionStorage.getItem(key(id)); } catch { return null; }
}
