// Display only the photograph inside the existing archive presentation.
// Originals are retained unchanged; future unframed photographs need no crop.
export const projectPhotoWindows: Record<string, { x: number; y: number; size: number }> = {
  "/projects/v32/cihan-tamamlanan.webp": { x: 544, y: 168, size: 510 },
  "/projects/v32/cihan-tasiyici.webp": { x: 544, y: 168, size: 510 },
  "/projects/v32/viakasta.webp": { x: 544, y: 168, size: 510 },
  "/projects/v32/yapikur-montaj.webp": { x: 300, y: 0, size: 1000 },
  "/projects/v32/yapikur-temel.webp": { x: 300, y: 0, size: 1000 },
  "/projects/v32/devrekani-3b.webp": { x: 300, y: 0, size: 1000 },
};

const preferredProjectPhotos: Record<string, string> = {
  "cihan-tat": "/projects/v32/cihan-tamamlanan.webp",
  "yapikur-plaza": "/projects/v32/yapikur-montaj.webp",
};

// Curated display metadata for supplied archive assets. A future image is not
// assumed to be a site photograph; register its type after reviewing the record.
const projectVisualKinds: Readonly<Record<string, "photo" | "model">> = {
  "/projects/v32/cihan-tamamlanan.webp": "photo",
  "/projects/v32/cihan-tasiyici.webp": "photo",
  "/projects/v32/viakasta.webp": "photo",
  "/projects/v32/yapikur-montaj.webp": "photo",
  "/projects/v32/yapikur-temel.webp": "photo",
  "/projects/v32/devrekani-3b.webp": "model",
};

export function projectVisualKind(href: string): "photo" | "model" | "unknown" {
  return Object.hasOwn(projectVisualKinds, href) ? projectVisualKinds[href] : "unknown";
}

export function selectProjectPhoto<T extends { href: string; contentType: string }>(slug: string, media: readonly T[]): T | undefined {
  const photographs = media.filter(item => item.contentType.startsWith("image/"));
  return photographs.find(item => item.href === preferredProjectPhotos[slug]) ?? photographs[0];
}
