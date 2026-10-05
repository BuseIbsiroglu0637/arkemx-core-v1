export type PublishedLocale = "tr" | "en";

export type LocalePublicationState = "VISIBLE" | "HIDDEN";

/**
 * Wix Multilingual publication snapshot.
 *
 * The language UI reads this registry instead of assuming that every translated
 * route is public. English routes remain available as a translation staging
 * surface, but they are not advertised until the Wix locale is visible.
 */
export const localePublicationRegistry = [
  {
    id: "tr",
    code: "TR",
    label: "Türkçe",
    languageTag: "tr-TR",
    visibility: "VISIBLE",
    primary: true,
  },
  {
    id: "en",
    code: "EN",
    label: "English",
    languageTag: "en-US",
    visibility: "HIDDEN",
    primary: false,
  },
] as const satisfies readonly {
  id: PublishedLocale;
  code: string;
  label: string;
  languageTag: string;
  visibility: LocalePublicationState;
  primary: boolean;
}[];

export const visibleLocaleRecords = localePublicationRegistry.filter((locale) => locale.visibility === "VISIBLE");

export function isLocaleVisible(locale: PublishedLocale) {
  return localePublicationRegistry.some((record) => record.id === locale && record.visibility === "VISIBLE");
}

export function localeRecord(locale: PublishedLocale) {
  return localePublicationRegistry.find((record) => record.id === locale) ?? localePublicationRegistry[0];
}

const routePairs = [
  ["/", "/en"],
  ["/projeler", "/en/projects"],
  ["/muhendislik", "/en/engineering"],
  ["/arkemx", "/en/arkemx"],
  ["/iletisim", "/en/contact"],
  ["/yapi-sistemleri", "/en/systems"],
  ["/arkem", "/en/about"],
] as const;

const turkishToEnglish = new Map<string, string>(routePairs);
const englishToTurkish = new Map<string, string>(routePairs.map(([tr, en]) => [en, tr]));

export function routeLocale(pathname: string): PublishedLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
}

export function localeEquivalent(pathname: string, target: PublishedLocale): string | null {
  const cleanPath = pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
  if (routeLocale(cleanPath) === target) return cleanPath;
  if (target === "en") {
    const direct = turkishToEnglish.get(cleanPath);
    if (direct) return direct;
    const project = cleanPath.match(/^\/projeler\/([^/]+)$/);
    return project ? `/en/projects/${project[1]}` : null;
  }

  const direct = englishToTurkish.get(cleanPath);
  if (direct) return direct;
  const project = cleanPath.match(/^\/en\/projects\/([^/]+)$/);
  return project ? `/projeler/${project[1]}` : null;
}

export function localizedHref(href: string, locale: PublishedLocale): string {
  if (locale === "tr" || !href.startsWith("/")) return href;
  const [path, hash = ""] = href.split("#");
  const exact = localeEquivalent(path, "en");
  if (exact) return `${exact}${hash ? `#${hash}` : ""}`;

  if (path === "/arkemx") return `/en/arkemx${hash ? `#${hash}` : ""}`;
  if (path === "/muhendislik") return `/en/engineering${hash ? `#${hash}` : ""}`;
  if (path.startsWith("/yapi-sistemleri/")) return `/en/systems#${path.split("/").at(-1)}`;
  if (path.startsWith("/projeler/")) return `/en/projects/${path.split("/").at(-1)}`;
  return href;
}
