export function moduleRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// Read only values compatible with the form's existing shape; preserve false, zero and empty text.
export function restoreModuleValue<T>(value: unknown, fallback: T): T {
  if (Array.isArray(fallback)) {
    if (!Array.isArray(value)) return fallback;
    if (!fallback.length) return value.filter(item => typeof item === "string") as T;
    return value.map((item, index) => restoreModuleValue(item, fallback[index] ?? fallback[0])) as T;
  }
  if (fallback && typeof fallback === "object") {
    const source = moduleRecord(value);
    return Object.fromEntries(Object.entries(fallback).map(([key, item]) => [key, restoreModuleValue(source[key], item)])) as T;
  }
  return typeof value === typeof fallback && (typeof value !== "number" || Number.isFinite(value)) ? value as T : fallback;
}


