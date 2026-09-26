import type { PublishedProjectEvidenceItem } from "./project-evidence";

export async function projectEvidenceDatabase() {
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  if (!db) throw new Error("D1 binding unavailable");
  return db;
}

export async function projectEvidenceBucket() {
  const { env } = await import("cloudflare:workers");
  const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!bucket) throw new Error("R2 binding unavailable");
  return bucket;
}

export function projectEvidenceObjectMatchesRecord(
  storedObject: { size: number; customMetadata?: Record<string, string> } | null,
  expected: { fileSize: number; fileSha256: string },
) {
  return Boolean(storedObject
    && storedObject.size === expected.fileSize
    && storedObject.customMetadata?.fileSha256 === expected.fileSha256);
}

export function projectEvidenceSchemaIsReady(schema: {
  tables: readonly string[];
  itemColumns: readonly string[];
  eventColumns: readonly string[];
  itemIndexes: readonly string[];
  eventIndexes: readonly string[];
  singlePublishedIndexSql: string;
}) {
  const tables = new Set(schema.tables);
  const itemColumns = new Set(schema.itemColumns);
  const eventColumns = new Set(schema.eventColumns);
  const itemIndexes = new Set(schema.itemIndexes);
  const eventIndexes = new Set(schema.eventIndexes);
  return tables.has("project_evidence_items")
    && tables.has("project_evidence_events")
    && ["file_key", "file_size", "file_sha256", "transition_token"].every((name) => itemColumns.has(name))
    && eventColumns.has("transition_token")
    && itemIndexes.has("project_evidence_single_published_idx")
    && eventIndexes.has("project_evidence_events_transition_idx")
    && schema.singlePublishedIndexSql.includes("'capability'");
}

export async function getProjectEvidenceRuntimeStatus() {
  let database: "ready" | "outdated" | "unavailable" = "unavailable";
  let storage: "ready" | "unavailable" = "unavailable";
  try {
    const db = await projectEvidenceDatabase();
    const [tables, itemColumns, eventColumns, itemIndexes, eventIndexes, singlePublishedIndex] = await Promise.all([
      db.prepare(`SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('project_evidence_items', 'project_evidence_events')`)
        .all<{ name: string }>(),
      db.prepare("PRAGMA table_info(project_evidence_items)").all<{ name: string }>(),
      db.prepare("PRAGMA table_info(project_evidence_events)").all<{ name: string }>(),
      db.prepare("PRAGMA index_list(project_evidence_items)").all<{ name: string }>(),
      db.prepare("PRAGMA index_list(project_evidence_events)").all<{ name: string }>(),
      db.prepare(`SELECT sql FROM sqlite_master
      WHERE type = 'index' AND name = 'project_evidence_single_published_idx'`)
        .first<{ sql: string }>(),
    ]);
    database = projectEvidenceSchemaIsReady({
      tables: tables.results.map((table) => table.name),
      itemColumns: itemColumns.results.map((column) => column.name),
      eventColumns: eventColumns.results.map((column) => column.name),
      itemIndexes: itemIndexes.results.map((index) => index.name),
      eventIndexes: eventIndexes.results.map((index) => index.name),
      singlePublishedIndexSql: singlePublishedIndex?.sql || "",
    })
      ? "ready"
      : "outdated";
  } catch {
    database = "unavailable";
  }
  try {
    const bucket = await projectEvidenceBucket();
    await bucket.list({ limit: 1 });
    storage = "ready";
  } catch {
    storage = "unavailable";
  }
  return { database, storage } as const;
}

export function resolveProjectEvidenceHealthStatus(runtime: {
  database: "ready" | "outdated" | "unavailable";
  storage: "ready" | "unavailable";
}) {
  return runtime.database === "ready" && runtime.storage === "ready" ? "ok" : "degraded";
}

type EvidenceRow = {
  id: string;
  projectSlug: string;
  targetType: PublishedProjectEvidenceItem["targetType"];
  targetKey: string;
  claimValue: string;
  sourceLabel: string;
  status: PublishedProjectEvidenceItem["status"];
  fileName: string | null;
  contentType: string | null;
};

export async function getPublishedProjectEvidence(projectSlug: string): Promise<readonly PublishedProjectEvidenceItem[]> {
  try {
    const db = await projectEvidenceDatabase();
    const result = await db.prepare(`SELECT id, project_slug AS projectSlug, target_type AS targetType,
      target_key AS targetKey, claim_value AS claimValue, source_label AS sourceLabel,
      status, file_name AS fileName, content_type AS contentType
      FROM project_evidence_items
      WHERE project_slug = ? AND status = 'published'
      ORDER BY published_at ASC, updated_at ASC LIMIT 200`)
      .bind(projectSlug)
      .all<EvidenceRow>();
    return result.results;
  } catch {
    return [];
  }
}
