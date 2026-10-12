import { PDFDocument } from "pdf-lib";

export type DeliveryFile = { name: string; format: "PDF" | "DXF" | "CSV" | "JSON"; sourceModule: string };
export type DeliveryArtifact = {
  content?: string | Uint8Array;
  sourceKey: string;
  validation?: { valid: boolean; issues: string[]; sha256: string; bytes: number };
  error?: string;
};
export const deliverySourceKey = (project: unknown) => JSON.stringify(project);
export async function deliveryDigest(content: string | Uint8Array) {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : Uint8Array.from(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

/** Inspect produced bytes, never a declared byte count or a module's existence. */
export async function inspectDeliveryArtifact(format: DeliveryFile["format"], content: string | Uint8Array, expected: { projectId: string; revision: string; sourceKey: string; text?: string }) {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const issues: string[] = [];
  try {
    if (!bytes.byteLength) throw new Error("Dosya boş");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    if (format === "JSON") {
      const value = JSON.parse(decoder.decode(bytes));
      if (value.schema !== "ARKEM-DELIVERY/2.0" || value.project?.id !== expected.projectId || value.project?.revision !== expected.revision || !Array.isArray(value.modules) || !value.modules.length) throw new Error("JSON proje, revizyon veya modül içeriği geçersiz");
      if (!expected.text || JSON.stringify(value) !== JSON.stringify(JSON.parse(expected.text))) throw new Error("JSON içeriği kaynak kayıtlarıyla eşleşmiyor");
    } else if (format === "CSV") {
      const actual = decoder.decode(bytes);
      const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
      const lines = actual.replace(/^\uFEFF/, "").split("\n");
      const prefix = `${quote(expected.projectId)};${quote(expected.revision)};`;
      if (!expected.text || actual.replace(/^\uFEFF/, "") !== expected.text.replace(/^\uFEFF/, "") || lines.length < 3 || !lines[0].startsWith('"Proje";"Revizyon";"Kod";') || lines.slice(1).some(line => !line.startsWith(prefix))) throw new Error("CSV kimliği, başlıkları veya modül satırları kaynakla eşleşmiyor");
    } else if (format === "PDF") {
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      const binding = JSON.parse(pdf.getSubject() ?? "{}");
      if (binding.projectId !== expected.projectId || binding.revision !== expected.revision || binding.sourceDigest !== await deliveryDigest(expected.sourceKey)) throw new Error("PDF proje veya revizyon bağı geçersiz");
      if (!pdf.getTitle()?.includes(expected.projectId) || !pdf.getPageCount() || pdf.getPages().some(page => !page.node.Contents() || page.getWidth() <= 0 || page.getHeight() <= 0)) throw new Error("PDF sayfa içeriği veya proje başlığı eksik");
    } else throw new Error("DXF için bu ekranda gerçek dosya içerik kontrolü uygulanmadı");
  } catch (error) { issues.push(error instanceof Error ? error.message : "Dosya içeriği okunamadı"); }
  return { valid: issues.length === 0, issues, sha256: await deliveryDigest(bytes), bytes: bytes.byteLength };
}

export function validateDeliveryArtifacts(files: DeliveryFile[], artifacts: Partial<Record<DeliveryFile["format"], DeliveryArtifact>> = {}, sourceKey = "") {
  const checks = files.map(file => {
    const artifact = artifacts[file.format];
    let status: "Oluşturulmadı" | "Kontrol bekliyor" | "Doğrulandı" | "Hatalı" | "Güncel değil" = "Oluşturulmadı";
    let issues = ["Bu oturumda gerçek dosya oluşturulmadı"];
    if (artifact) {
      if (artifact.sourceKey !== sourceKey) { status = "Güncel değil"; issues = ["Proje değişti; dosyayı yeniden oluşturun"]; }
      else if (artifact.error) { status = "Hatalı"; issues = [artifact.error]; }
      else if (artifact.content !== undefined) {
        status = !artifact.validation ? "Kontrol bekliyor" : artifact.validation.valid && artifact.validation.bytes > 0 ? "Doğrulandı" : "Hatalı";
        issues = artifact.validation?.issues ?? ["Dosya oluşturuldu; içerik kontrolü bekleniyor"];
      }
    }
    return { ...file, status, valid: status === "Doğrulandı", issues, bytes: artifact?.validation?.bytes ?? 0, sha256: artifact?.validation?.sha256 ?? null };
  });
  return { schema: "ARKEM-DELIVERY-PACKAGE/3.0", checks, summary: { total: checks.length, valid: checks.filter(file => file.valid).length, blocked: checks.filter(file => !file.valid).length }, technicalApproval: false };
}
