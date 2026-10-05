import { getArkemAccountUser } from "../../chatgpt-auth";

const DRAFT_SCHEMA = "ARKEM-GUIDED-DRAFT/1.0";
const MAX_DRAFT_BYTES = 120_000;

const createDraftTableSql = `CREATE TABLE IF NOT EXISTS customer_project_drafts (
  owner_email TEXT PRIMARY KEY,
  schema TEXT NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  saved_at TEXT NOT NULL
)`;

async function database() {
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  if (!db) throw new Error("D1 binding unavailable");
  await db.prepare(createDraftTableSql).run();
  return db;
}

function unauthorized() {
  return Response.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function validDraftInput(value: unknown) {
  const body = record(value);
  if (body.schema !== DRAFT_SCHEMA) return null;
  const intake = record(body.intake);
  const step = Number(body.step);
  const savedAt = String(body.savedAt || "");

  if (
    typeof intake.name !== "string" ||
    typeof intake.projectType !== "string" ||
    typeof intake.usage !== "string" ||
    typeof intake.location !== "string" ||
    !Number.isFinite(Number(intake.targetArea)) ||
    !Number.isFinite(Number(intake.floors)) ||
    !Number.isFinite(Number(intake.floorHeight)) ||
    !Number.isInteger(step) ||
    step < 0 ||
    step > 4
  ) return null;

  const normalized = {
    schema: DRAFT_SCHEMA,
    savedAt: savedAt || new Date().toISOString(),
    step,
    intake,
  };
  const payload = JSON.stringify(normalized);
  if (payload.length > MAX_DRAFT_BYTES) return null;
  return { normalized, payload };
}

export async function GET() {
  const user = await getArkemAccountUser();
  if (!user) return unauthorized();

  try {
    const db = await database();
    const row = await db
      .prepare("SELECT schema, step, payload, saved_at AS savedAt FROM customer_project_drafts WHERE owner_email = ?")
      .bind(user.email)
      .first();

    if (!row) return Response.json({ draft: null });

    const stored = row as Record<string, unknown>;
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(stored.payload || ""));
    } catch {
      parsed = null;
    }
    const valid = validDraftInput(parsed);
    if (!valid) return Response.json({ draft: null });

    return Response.json({ draft: valid.normalized });
  } catch {
    return Response.json({ error: "Taslak hesabınızdan okunamadı." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getArkemAccountUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz taslak verisi." }, { status: 400 });
  }

  const valid = validDraftInput(body);
  if (!valid) return Response.json({ error: "Taslak biçimi geçersiz." }, { status: 400 });

  try {
    const db = await database();
    await db
      .prepare(`INSERT INTO customer_project_drafts (owner_email, schema, step, payload, saved_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(owner_email) DO UPDATE SET
          schema=excluded.schema,
          step=excluded.step,
          payload=excluded.payload,
          saved_at=excluded.saved_at`)
      .bind(
        user.email,
        DRAFT_SCHEMA,
        valid.normalized.step,
        valid.payload,
        valid.normalized.savedAt,
      )
      .run();

    return Response.json({ ok: true, savedAt: valid.normalized.savedAt });
  } catch {
    return Response.json({ error: "Taslak hesaba kaydedilemedi." }, { status: 503 });
  }
}

export async function DELETE() {
  const user = await getArkemAccountUser();
  if (!user) return unauthorized();

  try {
    const db = await database();
    await db
      .prepare("DELETE FROM customer_project_drafts WHERE owner_email = ?")
      .bind(user.email)
      .run();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Taslak hesaptan kaldırılamadı." }, { status: 503 });
  }
}
