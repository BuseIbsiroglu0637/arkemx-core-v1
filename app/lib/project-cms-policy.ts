export function parseProjectCmsEditors(value: unknown): readonly string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((email) => email.trim().toLocaleLowerCase("en-US")).filter(Boolean))];
}

export function isCmsEditorEmail(email: string, configuredEditors: unknown): boolean {
  return parseProjectCmsEditors(configuredEditors).includes(email.trim().toLocaleLowerCase("en-US"));
}

export function resolveCmsEditorAccess(email: string | null, configuredEditors: unknown): "authorized" | "unauthenticated" | "forbidden" {
  if (!email) return "unauthenticated";
  return isCmsEditorEmail(email, configuredEditors) ? "authorized" : "forbidden";
}
