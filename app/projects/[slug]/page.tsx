import { permanentRedirect } from "next/navigation";
import { getV3Project } from "../../data/projects-v3";

const normalizeLegacySlug = (value: string) => {
  let decoded = value;

  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Bozuk bir eski URL tüm yönlendirme katmanını düşürmemeli.
  }

  return decoded
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const legacyProjectSlugs: Readonly<Record<string, string>> = {
  "viakasta-entegre-orman-urunleri": "viakasta",
  "viakasta-entegre-orman-urunleri-a-s": "viakasta",
  "cihan-tat-gida-seydiler-osb": "cihan-tat",
  "yapikur-plaza": "yapikur-plaza",
  "100-bas-hayvancilik-tesisi-devrekani-bosb": "devrekani-bosb",
  "devrekani-bosb": "devrekani-bosb",
};

export default async function LegacyProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const rawSlug = (await params).slug;
  const normalizedSlug = normalizeLegacySlug(rawSlug);
  const canonicalSlug = getV3Project(normalizedSlug)?.slug ?? legacyProjectSlugs[normalizedSlug];
  permanentRedirect(canonicalSlug ? `/projeler/${canonicalSlug}` : "/projeler");
}
