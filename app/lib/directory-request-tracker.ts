export type DirectoryLevel = 'province' | 'district' | 'neighborhood';

/** A finished or cancelled request may clear only its own generation. */
export function createDirectoryRequestTracker() {
  const pending = new Map<DirectoryLevel, symbol>();
  return {
    level(): DirectoryLevel | 'idle' {
      return (['neighborhood', 'district', 'province'] as const).find(level => pending.has(level)) ?? 'idle';
    },
    begin(level: DirectoryLevel) {
      const token = Symbol(level);
      pending.set(level, token);
      return () => { if (pending.get(level) === token) pending.delete(level); };
    },
  };
}
