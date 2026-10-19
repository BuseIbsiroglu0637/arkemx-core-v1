import { evidenceFileMatchesExtension } from "../../lib/project-evidence-file";
import { readBoundedFormData, requestInputFailure } from "../../lib/request-input";
import { MAX_INTAKE_FILE_BYTES, MAX_INTAKE_TOTAL_BYTES, validIntakeRequestKey, intakeReferenceForKey, intakeSubmissionMatches } from "../../lib/project-intake-contract";

export const runtime = "edge";

const MAX_FILE_BYTES = MAX_INTAKE_FILE_BYTES;
const MAX_TOTAL_BYTES = MAX_INTAKE_TOTAL_BYTES;
const MAX_FILES = 10;
type IntakeBucket = { put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }): Promise<unknown>; delete(key: string): Promise<unknown> };
const allowedExtensions = new Set(["pdf", "dwg", "dxf", "ifc", "xlsx", "jpg", "jpeg", "png", "zip"]);
const contentTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  dwg: "application/octet-stream",
  dxf: "application/dxf",
  ifc: "application/x-step",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  zip: "application/zip",
};

function intakeJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return Response.json(body, { ...init, headers });
}

function textField(form: FormData, key: string, limit: number) {
  return String(form.get(key) || "").trim().slice(0, limit);
}

function safeFileName(value: string) {
  return value.replace(/[\\/\u0000-\u001f\u007f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 160) || "proje-dosyasi";
}

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLocaleLowerCase("en-US") || "";
}

async function sha256(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function referenceCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `ARK-TD-${date}-${crypto.randomUUID().slice(0, 8).toLocaleUpperCase("en-US")}`;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return intakeJson({ error: "Form yalnız bu sitenin başvuru sayfasından gönderilebilir." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_TOTAL_BYTES + 1_000_000) return intakeJson({ error: "Toplam yükleme 10 MB sınırını aşıyor." }, { status: 413 });

  let form: FormData;
  try {
    form = await readBoundedFormData(request, MAX_TOTAL_BYTES + 1_000_000);
  } catch (error) {
    return requestInputFailure(error, "Form verisi okunamadı.");
  }

  // Botlar için görünmez alan. İnsan başvurusu gibi kayda alınmaz.
  if (textField(form, "website", 200)) return intakeJson({ error: "Form doğrulanamadı. Sayfayı yenileyip tekrar deneyin veya ARKEM ile iletişime geçin." }, { status: 400 });

  if (String(form.get("message") || "").length > 20000) return intakeJson({ error: "Açıklama 20.000 karakteri aşamaz." }, { status: 400 });
  const fields = {
    name: textField(form, "name", 120),
    company: textField(form, "company", 160),
    email: textField(form, "email", 180),
    phone: textField(form, "phone", 60),
    location: textField(form, "location", 160),
    buildingType: textField(form, "buildingType", 120),
    area: textField(form, "area", 80),
    stage: textField(form, "stage", 120),
    requestType: textField(form, "requestType", 160),
    message: textField(form, "message", 20000),
  };
  if (!fields.name || !fields.email || !fields.phone || !fields.location || !fields.buildingType || !fields.stage || !fields.requestType || !fields.message) {
    return intakeJson({ error: "Zorunlu proje bilgilerini eksiksiz doldurun." }, { status: 400 });
  }
  if (textField(form, "consent", 20) !== "accepted") {
    return intakeJson({ error: "Teknik ön değerlendirme için veri işleme onayı gereklidir." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return intakeJson({ error: "Geçerli bir e-posta adresi yazın." }, { status: 400 });

  const files = form.getAll("projectFiles").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_FILES) return intakeJson({ error: "En fazla 10 proje dosyası yükleyebilirsiniz." }, { status: 413 });
  if (files.some((file) => file.size > MAX_FILE_BYTES)) return intakeJson({ error: "Her dosya en fazla 6 MB olabilir." }, { status: 413 });
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) return intakeJson({ error: "Dosyaların toplamı 10 MB sınırını aşıyor." }, { status: 413 });

  const preparedFiles: Array<{ id: string; objectKey: string; fileName: string; contentType: string; size: number; sha: string; bytes: ArrayBuffer }> = [];
  const requestKey = textField(form, "requestKey", 64);
  if (requestKey && !validIntakeRequestKey(requestKey)) return intakeJson({ error: "Başvuru deneme kimliği geçersiz." }, { status: 400 });
  const intakeId = `INT-${requestKey || crypto.randomUUID()}`;
  const reference = requestKey ? intakeReferenceForKey(requestKey) : referenceCode();
  for (const file of files) {
    const fileName = safeFileName(file.name);
    const extension = extensionOf(fileName);
    if (!allowedExtensions.has(extension)) return intakeJson({ error: `${fileName}: desteklenmeyen dosya türü.` }, { status: 415 });
    const bytes = await file.arrayBuffer();
    if (!evidenceFileMatchesExtension(extension, new Uint8Array(bytes))) return intakeJson({ error: `${fileName}: dosya içeriği uzantıyla eşleşmiyor.` }, { status: 415 });
    const id = `INTF-${crypto.randomUUID()}`;
    preparedFiles.push({ id, objectKey: `project-intakes/${reference}/${id}/${fileName}`, fileName, contentType: contentTypesByExtension[extension], size: file.size, sha: await sha256(bytes), bytes });
  }

  const createdAt = new Date().toISOString();
  const uploadedKeys: string[] = [];
  let cleanupBucket: IntakeBucket | undefined;
  try {
    const { env } = await import("cloudflare:workers");
    const db = env.DB;
    const bucket = (env as unknown as { BUCKET?: IntakeBucket }).BUCKET;
    if (!db || !bucket) throw new Error("storage unavailable");
    cleanupBucket = bucket;
    async function previousResult() {
      const previous = await db.prepare(`SELECT id, name, company, email, phone, location, building_type AS buildingType, area, stage, request_type AS requestType, message FROM project_intakes WHERE reference_code = ?`).bind(reference).first() as Record<string, unknown> | null;
      if (!previous) return null;
      const previousFiles = await db.prepare("SELECT file_name AS fileName, file_size AS size, file_sha256 AS sha FROM project_intake_files WHERE intake_id = ?").bind(previous.id).all() as { results: Array<{ fileName: string; size: number; sha: string }> };
      return intakeSubmissionMatches(previous, fields, previousFiles.results, preparedFiles)
        ? intakeJson({ ok: true, referenceCode: reference, replayed: true }, { status: 201 })
        : intakeJson({ error: "Bu başvuru kimliği farklı bir içerikle kaydedilmiş. Yeni içerik için yeni başvuru oluşturun." }, { status: 409 });
    }
    if (requestKey) { const previous = await previousResult(); if (previous) return previous; }
    for (const file of preparedFiles) {
      // The store may write then lose its acknowledgement; track our unique key before awaiting.
      uploadedKeys.push(file.objectKey);
      await bucket.put(file.objectKey, file.bytes, { httpMetadata: { contentType: file.contentType }, customMetadata: { intakeId, referenceCode: reference, fileSha256: file.sha } });
    }
    try {
      const statements = [db.prepare(`INSERT INTO project_intakes (
        id, reference_code, name, company, email, phone, location, building_type, area,
        stage, request_type, message, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)`)
        .bind(intakeId, reference, fields.name, fields.company, fields.email, fields.phone, fields.location, fields.buildingType, fields.area, fields.stage, fields.requestType, fields.message, createdAt)];
      for (const file of preparedFiles) statements.push(db.prepare(`INSERT INTO project_intake_files (
        id, intake_id, object_key, file_name, content_type, file_size, file_sha256, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(file.id, intakeId, file.objectKey, file.fileName, file.contentType, file.size, file.sha, createdAt));
      await db.batch(statements);
    } catch (error) {
      // A commit may succeed even when its acknowledgement is lost. Never delete
      // uncertain uploads: only a known persisted receipt permits reconciliation.
      const attemptedKeys = [...uploadedKeys];
      uploadedKeys.length = 0;
      if (requestKey) {
        const previous = await previousResult();
        if (previous) {
          const linked = await db.prepare("SELECT object_key FROM project_intake_files WHERE intake_id = ?").bind(intakeId).all() as { results: Array<{ object_key: string }> };
          const retainedKeys = new Set(linked.results.map(file => file.object_key));
          await Promise.allSettled(attemptedKeys.filter(key => !retainedKeys.has(key)).map(key => bucket.delete(key)));
          return previous;
        }
      }
      throw error;
    }
    return intakeJson({ ok: true, referenceCode: reference }, { status: 201 });
  } catch {
    if (cleanupBucket) await Promise.allSettled(uploadedKeys.map(key => cleanupBucket!.delete(key)));
    return intakeJson({ error: "Başvurunun kayıt sonucu şu anda teyit edilemiyor. Formu ve dosyaları değiştirmeden yeniden deneyin; aynı başvuru anahtarıyla mevcut kayıt kontrol edilir. Gerekirse telefon/WhatsApp üzerinden ulaşın." }, { status: 503 });
  }
}
