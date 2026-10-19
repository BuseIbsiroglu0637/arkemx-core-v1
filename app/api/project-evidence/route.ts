import { v3Projects } from "../../data/projects-v3";
import {
  canPublishProjectEvidence,
  isProjectEvidenceAction,
  isProjectEvidenceState,
  isProjectEvidenceTarget,
  resolveProjectEvidenceTransition,
  type ProjectEvidenceTargetType,
  type ProjectEvidenceState,
} from "../../lib/project-evidence";
import { getProjectCmsAuthorization } from "../../lib/project-cms-auth";
import { evidenceFileMatchesExtension } from "../../lib/project-evidence-file";
import { readBoundedFormData, readBoundedJsonObject, requestInputFailure } from "../../lib/request-input";
import { evidenceBytesMatch } from "../../lib/project-evidence-integrity";
import {
  projectEvidenceBucket,
  projectEvidenceDatabase,
  projectEvidenceObjectMatchesRecord,
} from "../../lib/project-evidence-store";

export const MAX_EVIDENCE_FILE_BYTES = 25_000_000;

const allowedExtensions = new Set(["pdf", "dwg", "dxf", "jpg", "jpeg", "png", "webp", "mp4", "mov", "xlsx", "zip"]);
const contentTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  dwg: "application/octet-stream",
  dxf: "application/dxf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

function authResponse(status: "unauthenticated" | "forbidden") {
  return Response.json({ error: status === "unauthenticated" ? "Oturum açmanız gerekiyor." : "Bu alan yalnız ARKEM içerik yetkilisine açıktır." }, { status: status === "unauthenticated" ? 401 : 403 });
}

function textField(form: FormData, key: string, limit: number) {
  return String(form.get(key) || "").trim().slice(0, limit);
}

function safeFileName(value: string) {
  return value.replace(/[\\/\u0000-\u001f\u007f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 160) || "kanit-dosyasi";
}

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLocaleLowerCase("en-US") || "";
}

async function sha256(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  const auth = await getProjectCmsAuthorization();
  if (auth.status !== "authorized") return authResponse(auth.status);
  const project = new URL(request.url).searchParams.get("project") || "";
  if (project && !v3Projects.some((item) => item.slug === project)) return Response.json({ error: "Geçersiz proje." }, { status: 400 });
  try {
    const db = await projectEvidenceDatabase();
    const result = await db.prepare(`SELECT id, project_slug AS projectSlug, target_type AS targetType,
      target_key AS targetKey, claim_value AS claimValue, source_label AS sourceLabel,
      internal_note AS internalNote, status, file_name AS fileName, content_type AS contentType,
      file_size AS fileSize, file_sha256 AS fileSha256, created_by AS createdBy,
      reviewed_by AS reviewedBy, created_at AS createdAt, updated_at AS updatedAt,
      reviewed_at AS reviewedAt, published_at AS publishedAt
      FROM project_evidence_items
      WHERE (? = '' OR project_slug = ?)
      ORDER BY updated_at DESC LIMIT 250`)
      .bind(project, project)
      .all();
    return Response.json({ items: result.results });
  } catch {
    return Response.json({ error: "Proje kanıt alanı şu anda hazırlanıyor." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await getProjectCmsAuthorization();
  if (auth.status !== "authorized") return authResponse(auth.status);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_EVIDENCE_FILE_BYTES + 1_000_000) return Response.json({ error: "Kanıt isteği 25 MB sınırını aşıyor." }, { status: 413 });
  let form: FormData;
  try {
    form = await readBoundedFormData(request, MAX_EVIDENCE_FILE_BYTES + 1_000_000);
  } catch (error) {
    return requestInputFailure(error, "Geçersiz form verisi.");
  }

  const projectSlug = textField(form, "projectSlug", 80);
  const targetType = textField(form, "targetType", 20);
  const targetKey = textField(form, "targetKey", 40);
  const claimValue = textField(form, "claimValue", 1200);
  const sourceLabel = textField(form, "sourceLabel", 180);
  const internalNote = textField(form, "internalNote", 2000);
  const file = form.get("file");

  if (!v3Projects.some((project) => project.slug === projectSlug)) return Response.json({ error: "Geçersiz proje." }, { status: 400 });
  if (!isProjectEvidenceTarget(targetType, targetKey)) return Response.json({ error: "Geçersiz kanıt hedefi." }, { status: 400 });
  if (sourceLabel.length < 3) return Response.json({ error: "Kamuya açık kaynak tanımını yazın." }, { status: 400 });
  if (targetType !== "media" && !claimValue) return Response.json({ error: "Doğrulanacak proje bilgisini yazın." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Kanıt dosyası zorunludur." }, { status: 400 });
  if (file.size > MAX_EVIDENCE_FILE_BYTES) return Response.json({ error: "Kanıt dosyası 25 MB sınırını aşıyor." }, { status: 413 });
  const fileName = safeFileName(file.name);
  const extension = extensionOf(fileName);
  if (!allowedExtensions.has(extension)) return Response.json({ error: "Desteklenmeyen dosya türü." }, { status: 415 });
  const contentType = contentTypesByExtension[extension];

  const id = `EVD-${crypto.randomUUID()}`;
  const transitionToken = crypto.randomUUID();
  const fileKey = `project-evidence/${projectSlug}/${id}/${fileName}`;
  const now = new Date().toISOString();
  const bytes = await file.arrayBuffer();
  if (!evidenceFileMatchesExtension(extension, new Uint8Array(bytes))) {
    return Response.json({ error: "Dosya içeriği seçilen uzantıyla eşleşmiyor." }, { status: 415 });
  }
  const fileSha256 = await sha256(bytes);

  try {
    const [db, bucket] = await Promise.all([projectEvidenceDatabase(), projectEvidenceBucket()]);
    await bucket.put(fileKey, bytes, {
      httpMetadata: { contentType },
      customMetadata: { evidenceId: id, projectSlug, fileSha256 },
    });
    try {
      await db.batch([
        db.prepare(`INSERT INTO project_evidence_items (
          id, project_slug, target_type, target_key, claim_value, source_label, internal_note,
          status, file_key, file_name, content_type, file_size, file_sha256,
          created_by, created_at, updated_at, transition_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, projectSlug, targetType, targetKey, claimValue, sourceLabel, internalNote,
            fileKey, fileName, contentType, file.size, fileSha256,
            auth.user.email, now, now, transitionToken),
        db.prepare(`INSERT INTO project_evidence_events (
          evidence_id, actor_email, from_status, to_status, note, created_at, transition_token
        ) VALUES (?, ?, '', 'received', 'Kanıt dosyası alındı', ?, ?)`)
          .bind(id, auth.user.email, now, transitionToken),
      ]);
    } catch (error) {
      await bucket.delete(fileKey);
      throw error;
    }
    return Response.json({ ok: true, id, status: "received", fileSha256 }, { status: 201 });
  } catch {
    return Response.json({ error: "Kanıt kaydı tamamlanamadı." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getProjectCmsAuthorization();
  if (auth.status !== "authorized") return authResponse(auth.status);
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonObject(request, 16_000);
  } catch (error) {
    return requestInputFailure(error, "Geçersiz istek.");
  }
  const id = String(body.id || "").slice(0, 80);
  const action = body.action;
  const expectedStatus = body.expectedStatus;
  const note = String(body.note || "").slice(0, 1000);
  if (!id || !isProjectEvidenceAction(action) || !isProjectEvidenceState(expectedStatus)) {
    return Response.json({ error: "Geçersiz durum işlemi." }, { status: 400 });
  }

  try {
    const db = await projectEvidenceDatabase();
    const current = await db.prepare(`SELECT id, project_slug AS projectSlug, target_type AS targetType,
      target_key AS targetKey, claim_value AS claimValue, source_label AS sourceLabel,
      status, file_key AS fileKey, file_size AS fileSize, file_sha256 AS fileSha256
      FROM project_evidence_items WHERE id = ?`)
      .bind(id)
      .first<{
        id: string; projectSlug: string; targetType: ProjectEvidenceTargetType; targetKey: string;
        claimValue: string; sourceLabel: string; status: ProjectEvidenceState; fileKey: string | null;
        fileSize: number | null; fileSha256: string | null;
      }>();
    if (!current) return Response.json({ error: "Kanıt kaydı bulunamadı." }, { status: 404 });
    if (current.status !== expectedStatus) return Response.json({ error: "Kanıt kaydı başka bir oturumda değişti." }, { status: 409 });
    const nextStatus = resolveProjectEvidenceTransition(current.status, action);
    if (action === "publish" && !canPublishProjectEvidence(current)) {
      return Response.json({ error: "Dosyası, kaynak tanımı ve doğrulanmış içeriği olmayan kayıt yayımlanamaz." }, { status: 409 });
    }
    if (action === "publish") {
      if (!current.fileKey || !current.fileSize || !current.fileSha256) {
        return Response.json({ error: "Kanıt dosyasının bütünlük kaydı eksik; yayın durduruldu." }, { status: 409 });
      }
      const bucket = await projectEvidenceBucket();
      const storedObject = await bucket.get(current.fileKey);
      if (!projectEvidenceObjectMatchesRecord(storedObject, {
        fileSize: current.fileSize,
        fileSha256: current.fileSha256,
      })) {
        return Response.json({ error: "Kanıt dosyası depoda bulunamadı veya bütünlük doğrulaması başarısız; yayın durduruldu." }, { status: 409 });
      }
      if (!storedObject || storedObject.size > MAX_EVIDENCE_FILE_BYTES || !await evidenceBytesMatch(await storedObject.arrayBuffer(), { fileSize: current.fileSize, fileSha256: current.fileSha256 })) {
        return Response.json({ error: "Kanıt dosyasının gerçek içeriği kayıtla eşleşmiyor; yayın durduruldu." }, { status: 409 });
      }
    }
    const now = new Date().toISOString();
    const reviewedAt = ["verified", "rejected", "published"].includes(nextStatus) ? now : null;
    const publishedAt = nextStatus === "published" ? now : null;
    const transitionToken = crypto.randomUUID();
    const update = db.prepare(`UPDATE project_evidence_items SET
      status = ?, reviewed_by = ?, reviewed_at = ?, published_at = ?, updated_at = ?, transition_token = ?
      WHERE id = ? AND status = ? AND (
        ? <> 'published' OR target_type = 'media' OR NOT EXISTS (
          SELECT 1 FROM project_evidence_items AS active
          WHERE active.project_slug = project_evidence_items.project_slug
            AND active.target_type = project_evidence_items.target_type
            AND active.target_key = project_evidence_items.target_key
            AND active.status = 'published'
            AND active.id <> project_evidence_items.id
        )
      )`)
      .bind(nextStatus, auth.user.email, reviewedAt, publishedAt, now, transitionToken,
        id, expectedStatus, nextStatus);
    const event = db.prepare(`INSERT INTO project_evidence_events (
      evidence_id, actor_email, from_status, to_status, note, created_at, transition_token
    ) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (
      SELECT 1 FROM project_evidence_items
      WHERE id = ? AND status = ? AND transition_token = ?
    )`).bind(id, auth.user.email, expectedStatus, nextStatus, note, now, transitionToken,
      id, nextStatus, transitionToken);
    const [saved, audited] = await db.batch([update, event]);
    if (!saved.success || saved.meta.changes !== 1 || !audited.success || audited.meta.changes !== 1) {
      return Response.json({ error: nextStatus === "published"
        ? "Bu proje alanında başka bir doğrulanmış kayıt zaten yayında. Önce onu yayından çekin."
        : "Kanıt kaydı başka bir oturumda değişti." }, { status: 409 });
    }
    return Response.json({ ok: true, id, status: nextStatus });
  } catch (error) {
    if (error instanceof Error && /Geçersiz proje kanıtı/.test(error.message)) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && /unique constraint|project_evidence_single_published_idx/i.test(error.message)) {
      return Response.json({ error: "Bu proje alanında başka bir doğrulanmış kayıt zaten yayında. Önce onu yayından çekin." }, { status: 409 });
    }
    return Response.json({ error: "Kanıt durumu güncellenemedi." }, { status: 503 });
  }
}
