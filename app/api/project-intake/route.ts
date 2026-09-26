import { evidenceFileMatchesExtension } from "../../lib/project-evidence-file";

export const runtime = "edge";

const MAX_FILE_BYTES = 20_000_000;
const MAX_TOTAL_BYTES = 50_000_000;
const MAX_FILES = 10;
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
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_TOTAL_BYTES + 2_000_000) return Response.json({ error: "Toplam yükleme 50 MB sınırını aşıyor." }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Form verisi okunamadı." }, { status: 400 });
  }

  // Botlar için görünmez alan. İnsan başvurusu gibi kayda alınmaz.
  if (textField(form, "website", 200)) return Response.json({ ok: true, referenceCode: "ARK-TD-KAYIT" }, { status: 201 });

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
    message: textField(form, "message", 4000),
  };
  if (!fields.name || !fields.email || !fields.phone || !fields.location || !fields.buildingType || !fields.stage || !fields.requestType || !fields.message) {
    return Response.json({ error: "Zorunlu proje bilgilerini eksiksiz doldurun." }, { status: 400 });
  }
  if (textField(form, "consent", 20) !== "accepted") {
    return Response.json({ error: "Teknik ön değerlendirme için veri işleme onayı gereklidir." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return Response.json({ error: "Geçerli bir e-posta adresi yazın." }, { status: 400 });

  const files = form.getAll("projectFiles").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_FILES) return Response.json({ error: "En fazla 10 proje dosyası yükleyebilirsiniz." }, { status: 413 });
  if (files.some((file) => file.size > MAX_FILE_BYTES)) return Response.json({ error: "Her dosya en fazla 20 MB olabilir." }, { status: 413 });
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) return Response.json({ error: "Dosyaların toplamı 50 MB sınırını aşıyor." }, { status: 413 });

  const preparedFiles: Array<{ id: string; objectKey: string; fileName: string; contentType: string; size: number; sha: string; bytes: ArrayBuffer }> = [];
  const intakeId = `INT-${crypto.randomUUID()}`;
  const reference = referenceCode();
  for (const file of files) {
    const fileName = safeFileName(file.name);
    const extension = extensionOf(fileName);
    if (!allowedExtensions.has(extension)) return Response.json({ error: `${fileName}: desteklenmeyen dosya türü.` }, { status: 415 });
    const bytes = await file.arrayBuffer();
    if (!evidenceFileMatchesExtension(extension, new Uint8Array(bytes))) return Response.json({ error: `${fileName}: dosya içeriği uzantıyla eşleşmiyor.` }, { status: 415 });
    const id = `INTF-${crypto.randomUUID()}`;
    preparedFiles.push({ id, objectKey: `project-intakes/${reference}/${id}/${fileName}`, fileName, contentType: contentTypesByExtension[extension], size: file.size, sha: await sha256(bytes), bytes });
  }

  const createdAt = new Date().toISOString();
  const uploadedKeys: string[] = [];
  try {
    const { env } = await import("cloudflare:workers");
    const db = env.DB;
    const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
    if (!db || !bucket) throw new Error("storage unavailable");
    for (const file of preparedFiles) {
      await bucket.put(file.objectKey, file.bytes, { httpMetadata: { contentType: file.contentType }, customMetadata: { intakeId, referenceCode: reference, fileSha256: file.sha } });
      uploadedKeys.push(file.objectKey);
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
      await Promise.all(uploadedKeys.map((key) => bucket.delete(key)));
      throw error;
    }
    return Response.json({ ok: true, referenceCode: reference }, { status: 201 });
  } catch {
    return Response.json({ error: "Teknik ön değerlendirme kaydı şu anda tamamlanamadı. Lütfen daha sonra yeniden deneyin veya telefon/WhatsApp üzerinden ulaşın." }, { status: 503 });
  }
}
