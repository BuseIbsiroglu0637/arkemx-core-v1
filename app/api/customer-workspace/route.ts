import { getArkemAccountUser } from "../../chatgpt-auth";
import {
  isPortalProject,
  resolveAccountProjectWritePrecondition,
  validateAccountProjectPayload,
} from "../../lib/customer-portal";
import {
  CUSTOMER_PROJECT_ACTIVITY_SQL,
  CUSTOMER_PROJECT_INSERT_SQL,
  CUSTOMER_PROJECT_UPDATE_SQL,
} from "../../lib/customer-workspace-write";

const statements = [
  `CREATE TABLE IF NOT EXISTS customer_profiles (
    email TEXT PRIMARY KEY, display_name TEXT NOT NULL, company TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '', preferred_language TEXT NOT NULL DEFAULT 'tr',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS customer_projects (
    id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, name TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT 'Başlangıç', revision TEXT NOT NULL DEFAULT 'R00',
    status TEXT NOT NULL DEFAULT 'Taslak', payload TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS customer_projects_owner_idx ON customer_projects(owner_email)`,
  `CREATE TABLE IF NOT EXISTS customer_meetings (
    id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL, meeting_at TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'Teknik görüşme',
    status TEXT NOT NULL DEFAULT 'Planlandı', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS customer_meetings_owner_idx ON customer_meetings(owner_email)`,
  `CREATE TABLE IF NOT EXISTS customer_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_email TEXT NOT NULL,
    event_type TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS customer_activities_owner_idx ON customer_activities(owner_email)`,
];

async function database() {
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  if (!db) throw new Error("D1 binding unavailable");
  await db.batch(statements.map((sql) => db.prepare(sql)));
  return db;
}

function unauthorized() {
  return Response.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
}

function safeProjectPayload(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isPortalProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getArkemAccountUser();
  if (!user) return unauthorized();
  try {
    const db = await database();
    const [profile, projects, meetings, activities] = await Promise.all([
      db.prepare("SELECT email, display_name AS displayName, company, phone, preferred_language AS preferredLanguage, created_at AS createdAt, updated_at AS updatedAt FROM customer_profiles WHERE email = ?").bind(user.email).first(),
      db.prepare("SELECT id, name, phase, revision, status, payload, updated_at AS updatedAt FROM customer_projects WHERE owner_email = ? ORDER BY updated_at DESC LIMIT 24").bind(user.email).all(),
      db.prepare("SELECT id, project_id AS projectId, subject, meeting_at AS meetingAt, channel, status, notes, created_at AS createdAt FROM customer_meetings WHERE owner_email = ? ORDER BY meeting_at DESC LIMIT 40").bind(user.email).all(),
      db.prepare("SELECT id, event_type AS eventType, CASE WHEN event_type = 'project' AND title = 'Proje buluta kaydedildi' THEN 'Proje hesaba kaydedildi' ELSE title END AS title, detail, created_at AS createdAt FROM customer_activities WHERE owner_email = ? ORDER BY created_at DESC LIMIT 50").bind(user.email).all(),
    ]);
    const safeProjects = projects.results.map((value) => {
      const project = value as Record<string, unknown>;
      return { ...project, payload: safeProjectPayload(project.payload) };
    });
    return Response.json({ user, profile, projects: safeProjects, meetings: meetings.results, activities: activities.results });
  } catch {
    return Response.json({ error: "Müşteri çalışma alanı şu anda hazırlanıyor." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getArkemAccountUser();
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const action = String(body.action || "");
  const now = new Date().toISOString();
  try {
    const db = await database();
    if (action === "profile") {
      const displayName = String(body.displayName || user.displayName).slice(0, 120);
      const company = String(body.company || "").slice(0, 160);
      const phone = String(body.phone || "").slice(0, 40);
      const preferredLanguage = String(body.preferredLanguage || "tr").slice(0, 8);
      const profileWrite = db.prepare(`INSERT INTO customer_profiles (email, display_name, company, phone, preferred_language, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name, company=excluded.company, phone=excluded.phone, preferred_language=excluded.preferred_language, updated_at=excluded.updated_at`)
        .bind(user.email, displayName, company, phone, preferredLanguage, now, now);
      const profileActivity = db.prepare("INSERT INTO customer_activities (owner_email, event_type, title, detail, created_at) VALUES (?, 'profile', 'Profil güncellendi', ?, ?)").bind(user.email, company, now);
      await db.batch([profileWrite, profileActivity]);
    } else if (action === "project") {
      const id = String(body.id || `ARK-${Date.now().toString(36).toUpperCase()}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
      const name = String(body.name || "Yeni proje").slice(0, 160);
      const validatedPayload = validateAccountProjectPayload(id, body.payload);
      if (!validatedPayload.ok) return Response.json({ error: validatedPayload.error }, { status: 400 });
      const payload = JSON.stringify(validatedPayload.project);
      if (payload.length > 300_000) return Response.json({ error: "Proje verisi 300 KB sınırını aşıyor." }, { status: 413 });
      const phase = String(body.phase || "Başlangıç").slice(0, 80);
      const revision = String(body.revision || "R00").slice(0, 24);
      const existing = await db.prepare("SELECT owner_email AS ownerEmail, updated_at AS updatedAt, payload FROM customer_projects WHERE id = ?").bind(id).first();
      if (existing && String((existing as Record<string, unknown>).ownerEmail) !== user.email) {
        return Response.json({ error: "Bu proje kodu başka bir hesaptaki kayıtla çakışıyor." }, { status: 409 });
      }
      const expectedAccountUpdatedAt = Object.prototype.hasOwnProperty.call(body, "expectedAccountUpdatedAt")
        ? body.expectedAccountUpdatedAt
        : undefined;
      const precondition = resolveAccountProjectWritePrecondition(
        expectedAccountUpdatedAt,
        existing ? String((existing as Record<string, unknown>).updatedAt) : null,
      );
      if (!precondition.ok) {
        return Response.json({ error: precondition.error }, { status: precondition.status });
      }
      const existingPayload = existing
        ? String((existing as Record<string, unknown>).payload)
        : null;
      const projectWrite = precondition.mode === "create"
        ? db.prepare(CUSTOMER_PROJECT_INSERT_SQL)
          .bind(id, user.email, name, phase, revision, payload, now, now)
        : db.prepare(CUSTOMER_PROJECT_UPDATE_SQL)
          .bind(
            name,
            phase,
            revision,
            payload,
            now,
            id,
            user.email,
            expectedAccountUpdatedAt,
            existingPayload,
          );
      const projectActivity = db.prepare(CUSTOMER_PROJECT_ACTIVITY_SQL)
        .bind(
          user.email,
          `${id} · ${name}`,
          now,
          id,
          user.email,
          now,
          payload,
        );
      const [saved] = await db.batch([projectWrite, projectActivity]);
      if (!saved.success || saved.meta.changes !== 1) {
        return Response.json({ error: "Hesap projesi bu sırada değişti. Son kayıt açılmadan üzerine yazılmadı." }, { status: 409 });
      }
    } else if (action === "meeting") {
      const id = `MTG-${crypto.randomUUID()}`;
      const subject = String(body.subject || "Teknik görüşme").slice(0, 180);
      const meetingAt = String(body.meetingAt || now).slice(0, 40);
      const projectId = String(body.projectId || "").slice(0, 64);
      const channel = String(body.channel || "Teknik görüşme").slice(0, 80);
      const notes = String(body.notes || "").slice(0, 2000);
      const meetingWrite = db.prepare("INSERT INTO customer_meetings (id, owner_email, project_id, subject, meeting_at, channel, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, 'Planlandı', ?, ?)")
        .bind(id, user.email, projectId, subject, meetingAt, channel, notes, now);
      const meetingActivity = db.prepare("INSERT INTO customer_activities (owner_email, event_type, title, detail, created_at) VALUES (?, 'meeting', 'Görüşme kaydı oluşturuldu', ?, ?)").bind(user.email, subject, now);
      await db.batch([meetingWrite, meetingActivity]);
    } else {
      return Response.json({ error: "Desteklenmeyen işlem." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Kayıt tamamlanamadı." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const user = await getArkemAccountUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  const id = (url.searchParams.get("id") || "").slice(0, 80);
  if (!id || !["project", "meeting"].includes(resource || "")) return Response.json({ error: "Geçersiz silme isteği." }, { status: 400 });
  try {
    const db = await database();
    if (resource === "project") await db.prepare("DELETE FROM customer_projects WHERE id = ? AND owner_email = ?").bind(id, user.email).run();
    else await db.prepare("DELETE FROM customer_meetings WHERE id = ? AND owner_email = ?").bind(id, user.email).run();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Kayıt silinemedi." }, { status: 503 });
  }
}
