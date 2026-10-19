/** Validate account acknowledgements before claiming that a project is saved. */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid account response");
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) throw new Error("Invalid account revision");
  return value;
}
export function accountProjectsFromResponse(value: unknown) {
  const data = record(value);
  if (!Array.isArray(data.projects)) throw new Error("Missing account project list");
  return data.projects.map(value => {
    const item = record(value);
    if (typeof item.id !== "string" || !item.id.trim()) throw new Error("Invalid account project");
    return { id: item.id, updatedAt: timestamp(item.updatedAt), payload: item.payload };
  });
}
export function accountSavedAt(value: unknown): string {
  return timestamp(record(value).updatedAt);
}
