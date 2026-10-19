import type { StructuralConceptInput } from "./engineering";
/** UI-supported ranges only; this is not a code, material or safety verification. */
export const structuralDraftRanges = {
  width: [6, 80], depth: [6, 60], floors: [1, 20], floorHeight: [2.6, 8], baysX: [1, 12], baysY: [1, 10],
  columnSize: [.12, 1.2], beamDepth: [.25, 1.5], slabThickness: [.08, .4], superDeadLoad: [.5, 8], liveLoad: [1.5, 15],
  roofSnowLoad: [0, 5], basicWindSpeed: [20, 55], sds: [.1, 2.5], sd1: [.05, 1.5], importance: [1, 1.5], behaviorFactor: [2, 8],
  concreteStrength: [25, 50], steelYield: [275, 460],
} as const;
export function parseStructuralDraft(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!["concrete", "precast", "steel", "light", "hybrid"].includes(String(raw.system)) || !["residential", "office", "industrial", "storage", "assembly"].includes(String(raw.usage))) return null;
  for (const [key, [min, max]] of Object.entries(structuralDraftRanges)) {
    const n = raw[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max || (["floors", "baysX", "baysY"].includes(key) && !Number.isInteger(n))) return null;
  }
  if (![25, 30, 35, 40, 45, 50].includes(raw.concreteStrength as number) || ![275, 355, 460].includes(raw.steelYield as number)) return null;
  return Object.fromEntries(["system", "usage", ...Object.keys(structuralDraftRanges)].map(key => [key, raw[key]])) as unknown as StructuralConceptInput;
}
