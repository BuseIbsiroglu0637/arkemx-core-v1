// Conservative limits for the buffered multipart path; large CAD sets need a separate handoff.
export const MAX_INTAKE_FILE_BYTES = 6_000_000;
export const MAX_INTAKE_TOTAL_BYTES = 10_000_000;
export function validIntakeRequestKey(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function intakeReferenceForKey(key: string) { if (!validIntakeRequestKey(key)) throw new Error("Invalid request key"); return `ARK-TD-${key.toUpperCase()}`; }
export function intakeSubmissionMatches(previous: Record<string, unknown>, fields: Record<string, string>, previousFiles: Array<{ fileName: string; size: number; sha: string }>, files: Array<{ fileName: string; size: number; sha: string }>) {
  const sameFields = Object.entries(fields).every(([key, value]) => previous[key] === value);
  const fingerprint = (items: typeof files) => JSON.stringify(items.map(f => [f.fileName, f.size, f.sha]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  return sameFields && fingerprint(previousFiles) === fingerprint(files);
}
