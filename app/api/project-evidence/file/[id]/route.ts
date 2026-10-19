import { getProjectCmsAuthorization } from "../../../../lib/project-cms-auth";
import { projectEvidenceBucket, projectEvidenceDatabase } from "../../../../lib/project-evidence-store";
import { evidenceBytesMatch } from "../../../../lib/project-evidence-integrity";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.slice(0, 80);
  try {
    const db = await projectEvidenceDatabase();
    const item = await db.prepare(`SELECT status, file_key AS fileKey, file_name AS fileName,
      content_type AS contentType, file_sha256 AS fileSha256, file_size AS fileSize
      FROM project_evidence_items WHERE id = ?`).bind(id).first<{
        status: string; fileKey: string | null; fileName: string | null; contentType: string | null; fileSha256: string | null; fileSize: number | null;
      }>();
    if (!item?.fileKey || !item.fileName) return new Response("Bulunamadı", { status: 404 });
    if (item.status !== "published") {
      const auth = await getProjectCmsAuthorization();
      if (auth.status !== "authorized") return new Response("Bulunamadı", { status: 404 });
    }
    const object = await (await projectEvidenceBucket()).get(item.fileKey);
    if (!object) return new Response("Bulunamadı", { status: 404 });
    if (!item.fileSize || !item.fileSha256 || object.size !== item.fileSize || object.size > 25_000_000) return new Response("Dosya bütünlüğü doğrulanamadı.", { status: 409 });
    const bytes = await object.arrayBuffer();
    if (!await evidenceBytesMatch(bytes, { fileSize: item.fileSize, fileSha256: item.fileSha256 })) return new Response("Dosya bütünlüğü doğrulanamadı.", { status: 409 });
    const contentType = item.contentType || object.httpMetadata?.contentType || "application/octet-stream";
    const inline = contentType.startsWith("image/") || contentType.startsWith("video/") || contentType === "application/pdf";
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(item.fileName)}`,
        "Cache-Control": "no-store",
        "ETag": item.fileSha256 ? `\"${item.fileSha256}\"` : object.httpEtag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Kanıt dosyası şu anda kullanılamıyor.", { status: 503 });
  }
}
