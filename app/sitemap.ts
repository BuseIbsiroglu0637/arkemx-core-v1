import type { MetadataRoute } from "next";
import { v3Projects } from "./data/projects-v3";
import { site } from "./data/site";

const coreRoutes = [
  ["/", 1, "weekly"],
  ["/projeler", .95, "weekly"],
  ["/yapi-sistemleri", .9, "monthly"],
  ["/yapi-sistemleri/betonarme-prefabrik", .85, "monthly"],
  ["/yapi-sistemleri/celik", .85, "monthly"],
  ["/yapi-sistemleri/hafif-celik", .85, "monthly"],
  ["/yapi-sistemleri/karma-sistem", .85, "monthly"],
  ["/muhendislik", .9, "monthly"],
  ["/dijital-donusum", .95, "weekly"],
  ["/arkemx", .9, "weekly"],
  ["/arkem", .8, "monthly"],
  ["/iletisim", .85, "monthly"],
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-09-02T00:00:00+03:00");
  const projectRoutes = v3Projects.map((project) => [`/projeler/${project.slug}`, .82, "monthly"] as const);
  return [...coreRoutes, ...projectRoutes].map(([path, priority, changeFrequency]) => {
    const url = `${site.domain}${path}`;
    return {
      url,
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages: { "tr-TR": url, "x-default": url } },
    };
  });
}
