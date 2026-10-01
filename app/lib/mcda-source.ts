export type McdaUsage = "industrial" | "storage" | "residential" | "commercial";

export type McdaSourceSnapshot = {
  usage: McdaUsage;
  floors: number;
  span: number;
  area: number;
};

type McdaProjectSource = {
  use: string;
  floors: number;
  grossArea: number;
  spanX: number;
  spanY: number;
};

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function mcdaUsageFromProject(value: string): McdaUsage {
  const normalized = value.trim().toLocaleLowerCase("tr-TR");
  if (
    normalized === "residential"
    || normalized.includes("konut")
    || normalized.includes("yaşam")
  ) return "residential";
  if (
    normalized === "storage"
    || normalized.includes("depo")
    || normalized.includes("lojistik")
  ) return "storage";
  if (
    normalized === "commercial"
    || normalized === "office"
    || normalized === "education"
    || normalized.includes("ticari")
    || normalized.includes("ofis")
    || normalized.includes("eğitim")
    || normalized.includes("sosyal")
  ) return "commercial";
  return "industrial";
}

export function buildMcdaProjectSnapshot(source: McdaProjectSource): McdaSourceSnapshot | null {
  const floors = finite(source.floors);
  const area = finite(source.grossArea);
  const span = Math.max(finite(source.spanX), finite(source.spanY));
  if (!(floors > 0) || !(area > 0) || !(span > 0)) return null;
  return {
    usage: mcdaUsageFromProject(source.use),
    floors: Math.max(1, Math.min(50, Math.round(floors))),
    span: Number(Math.max(3, Math.min(60, span)).toFixed(3)),
    area: Number(Math.max(50, Math.min(100000, area)).toFixed(1)),
  };
}

export function mcdaSourceKey(snapshot: McdaSourceSnapshot | null | undefined) {
  if (!snapshot) return "";
  return [
    snapshot.usage,
    snapshot.floors,
    snapshot.span.toFixed(3),
    snapshot.area.toFixed(1),
  ].join("|");
}

export function mcdaSourceMatches(
  first: McdaSourceSnapshot | null | undefined,
  second: McdaSourceSnapshot | null | undefined,
) {
  if (!first || !second) return false;
  return (
    first.usage === second.usage
    && first.floors === second.floors
    && Math.abs(first.span - second.span) <= .01
    && Math.abs(first.area - second.area) <= .2
  );
}

export function mcdaInputMatchesSource(
  input: Record<string, unknown>,
  source: McdaSourceSnapshot | null | undefined,
) {
  if (!source) return false;
  return (
    typeof input.usage === "string"
    && mcdaUsageFromProject(input.usage) === source.usage
    && finite(input.floors) === source.floors
    && Math.abs(finite(input.span) - source.span) <= .01
    && Math.abs(finite(input.area) - source.area) <= .2
  );
}
