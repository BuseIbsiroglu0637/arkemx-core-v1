import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { v3Projects } from "../app/data/projects-v3.ts";
import { referenceRecords } from "../app/data/references.ts";
import { structuralSystems } from "../app/data/structural-systems.ts";
import { blogPosts } from "../app/data/blog.ts";

const app = new URL("../app/", import.meta.url);
function pagePaths(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return pagePaths(path.join(directory, entry.name), `${prefix}/${entry.name}`);
    return entry.name === "page.tsx" ? [prefix || "/"] : [];
  });
}
const templates = pagePaths(app.pathname.replace(/^\/(?=[A-Za-z]:)/, ""));
const dynamic = {
  "/projeler/[slug]": v3Projects.map(p => `/projeler/${p.slug}`),
  "/en/projects/[slug]": v3Projects.map(p => `/en/projects/${p.slug}`),
  "/projects/[slug]": v3Projects.map(p => `/projects/${p.slug}`),
  "/referanslar/[slug]": referenceRecords.map(p => `/referanslar/${p.slug}`),
  "/yapi-sistemleri/[slug]": structuralSystems.map(p => `/yapi-sistemleri/${p.slug}`),
  "/blog/[slug]": blogPosts.map(p => `/blog/${p.slug}`),
};
const routes = templates.flatMap(route => dynamic[route] ?? [route]);
const { default: worker } = await import("../dist/server/index.js");
const rendered = new Map();
async function render(route) {
  if (rendered.has(route)) return rendered.get(route);
  const response = await worker.fetch(new Request(`http://localhost${route}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} });
  const result = { response, html: await response.text() };
  rendered.set(route, result);
  return result;
}
test("every source page template is represented by the corporate route checks", () => {
  assert.equal(templates.length, 60);
  assert.ok(templates.includes('/parsel-uzman-inceleme'));
  assert.ok(templates.includes('/proje-on-planlama'));
  assert.ok(!routes.some(route => route.includes("[")), "all dynamic templates must be expanded from their real records");
});
for (const route of routes) {
  test(`corporate page renders: ${route}`, async () => {
    const { response, html } = await render(route);
    if (response.status >= 300 && response.status < 400) {
      assert.ok(response.headers.get("location"), "a redirect must have a destination");
      return;
    }
    assert.equal(response.status, 200, route);
    assert.match(html, /arkem-corporate-site/, "the common identity must be applied");
    assert.match(html, /class="v4-footer"/, "public pages must have a way back and contact");
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, "only one primary heading per page");
    assert.equal((html.match(/v4-desktop-site-header /g) ?? []).length, 1, "only one global desktop menu per page");
  });
}
test("customer technical disclosure keeps a single heading and menu", async () => {
  for (const route of ["/arkemx", "/dijital-proje-merkezi"]) {
    const { html } = await render(route);
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
    assert.equal((html.match(/v4-desktop-site-header /g) ?? []).length, 1);
  }
});

test("minimal footer shows every destination and six authentic social icons", async () => {
  for (const route of ["/", "/en"]) {
    const { html } = await render(route);
    const footer = html.match(/<footer class="v4-footer">[\s\S]*?<\/footer>/)?.[0] ?? "";
    assert.match(html, /rel="icon" href="https:\/\/arkemyapisistemleri\.com\/favicon-arkem-depth\.png"[^>]*type="image\/png"/);
    const directory = footer.match(/<nav class="corporate-footer-directory corporate-footer-directory-content"[\s\S]*?<\/nav>/)?.[0] ?? "";
    assert.ok(directory, "all grouped links are visible without opening a disclosure");
    assert.equal((directory.match(/class="corporate-footer-group"/g) ?? []).length, 6);
    assert.equal((directory.match(/<a\b/g) ?? []).length, 22);
    const social = footer.match(/<nav class="corporate-footer-social"[\s\S]*?<\/nav>/)?.[0] ?? "";
    assert.equal((social.match(/<a\b/g) ?? []).length, 6);
    assert.equal((social.match(/aria-label=/g) ?? []).length, 7);
    assert.equal((social.match(/class="corporate-social-icon"/g) ?? []).length, 6);
    for (const icon of ["instagram", "linkedin-in", "youtube", "facebook-f", "tiktok", "threads"]) {
      assert.match(social, new RegExp(`/social/${icon}\\.svg`));
      const asset = fs.readFileSync(new URL(`../public/social/${icon}.svg`, import.meta.url), "utf8");
      assert.match(asset, /Font Awesome Free/);
      assert.match(asset, /viewBox=/);
      assert.doesNotMatch(asset, /<script|<foreignObject|\bon\w+=|(?:href|src)=/i);
    }
    assert.match(footer, /href="\/site-haritasi"/);
    assert.match(footer, /href="tel:/);
    assert.doesNotMatch(footer, /<details|<summary|Diğer bağlantılar|More links|corporate-footer-primary|v4-footer-accordion|v4-footer-statement/);
  }
});

test("home project carousel keeps real project links and four functional choice icons", async () => {
  for (const route of ["/", "/en"]) {
    const { html } = await render(route);
    const carousel = html.match(/<aside class="home-project-selection"[\s\S]*?<\/aside>/)?.[0] ?? "";
    assert.match(carousel, /class="home-project-track"/);
    assert.match(carousel, /tabindex="0"/);
    assert.equal((carousel.match(/class="home-project-slide"/g) ?? []).length, route === '/' ? 14 : 4);
    assert.equal((carousel.match(/aria-controls="home-project-track"/g) ?? []).length, 2);
    assert.equal((carousel.match(/data-photo-window=/g) ?? []).length, route === '/' ? 14 : 4, "every published carousel slide has its own project media window");
    for (const slug of ["cihan-tat", "yapikur-plaza", "devrekani-bosb", "viakasta"]) {
      assert.match(carousel, new RegExp(`href="${route === "/en" ? "/en" : ""}/proj(?:ects|eler)/${slug}"`));
    }
    const choices = html.match(/<nav[^>]*class="shell v4-capability-band"[\s\S]*?<\/nav>/)?.[0] ?? "";
    assert.equal((choices.match(/<a\b/g) ?? []).length, 4);
    assert.equal((choices.match(/class="home-capability-symbol"/g) ?? []).length, 4);
  }
  const source = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  const slides = source.match(/const projectThumbnails =[\s\S]*?const projectSlides/)?.[0] ?? "";
  assert.doesNotMatch(slides, /slice\(/, "future published photos must not be capped at four projects");
  const controller = fs.readFileSync(new URL("../app/components/HomeProjectCarousel.tsx", import.meta.url), "utf8");
  assert.match(controller, /scrollBy/);
  assert.match(controller, /prefers-reduced-motion/);
  assert.doesNotMatch(controller, /setInterval|setTimeout|autoPlay/);
});

test("project start keeps six readable guide cells without forcing initial input focus", async () => {
  const { html } = await render("/proje-baslat");
  assert.match(html, /class="shell project-start-hero-content"/);
  const guide = html.match(/<ol[^>]*class="project-start-hero-flow"[\s\S]*?<\/ol>/)?.[0] ?? "";
  assert.equal((guide.match(/<li(?:\s|>)/g) ?? []).length, 6);
  for (const number of ["01", "02", "03", "04", "05", "06"]) assert.match(guide, new RegExp(`<i>${number}<\\/i>`));
  assert.doesNotMatch(html, /\bautofocus(?:=|\s|>)/i);
  const studio = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(studio, /\bautoFocus\b/);
});
test("unreleased products and static images are described truthfully", async () => {
  for (const route of ["/hazir-projeler", "/egitimler"]) {
    const { html } = await render(route);
    assert.match(html, /Geliştirme aşaması/);
    assert.doesNotMatch(html, /Satış altyapısı hazır/);
  }
  const { html } = await render("/referanslar");
  assert.match(html, /model görseli/);
  assert.doesNotMatch(html, /etkileşimli 3B model/);
});
test("meeting form preserves input on an unconfirmed save", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  assert.match(source, /const saved = await post/);
  assert.match(source, /if \(saved\) setMeeting/);
  assert.match(source, /disabled=\{meetingPending\}/);
  assert.match(source, /aria-busy=\{meetingPending\}/);
});
test("translated section links use the destination page's actual identifiers", async () => {
  const { localizedHref } = await import("../app/data/locale-routes.ts");
  assert.equal(localizedHref("/muhendislik#statik-analiz", "en"), "/en/engineering#structural-analysis");
  assert.equal(localizedHref("/iletisim#proje-on-bilgisi", "en"), "/en/contact#project-pre-assessment");
  assert.equal(localizedHref("/yapi-sistemleri/celik", "en"), "/en/systems#steel");
  assert.equal(localizedHref("/yapi-sistemleri/betonarme", "en"), "/yapi-sistemleri/betonarme");
});
test("public navigation anchors point to sections that exist", async () => {
  const failures = new Set();
  for (const route of routes) {
    const { response, html } = await render(route);
    if (response.status !== 200) continue;
    for (const match of html.matchAll(/<a\b[^>]*href="([^"]*)"/g)) {
      const href = match[1].replaceAll("&amp;", "&");
      if (!(href.startsWith("/") || href.startsWith("#")) || !href.includes("#")) continue;
      const target = new URL(href, `http://localhost${route}`);
      if (target.pathname.startsWith("/api/")) continue;
      let page = await render(target.pathname);
      if (page.response.status >= 300 && page.response.status < 400) {
        const destination = new URL(page.response.headers.get("location"), target);
        if (destination.origin !== "http://localhost") continue;
        page = await render(destination.pathname);
      }
      if (page.response.status !== 200) continue;
      const id = decodeURIComponent(target.hash.slice(1));
      if (id && !page.html.includes(`id="${id}"`)) failures.add(`${route}: ${href}`);
    }
  }
  assert.deepEqual([...failures], [], "internal section links must not lead to empty destinations");
});

test("corporate menu keeps actions grouped when the language control is absent", async () => {
  for (const route of ["/", "/arkemx", "/en"]) {
    const { html } = await render(route);
    assert.match(html, /class="corporate-nav-actions"/);
    assert.match(html, /class="corporate-mobile-actions"/);
    const header = html.match(/<header[^>]*v4-desktop-site-header[\s\S]*?<\/header>/)?.[0] ?? "";
    assert.match(header, /arkem-logo-master\.svg#on-light/);
    assert.match(header, /aria-controls="v4-desktop-nav-/);
    assert.doesNotMatch(header, /aria-haspopup="true"/);
  }
});
test("corporate menu closes safely and follows the header position", () => {
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/corporate-navigation.css", import.meta.url), "utf8");
  assert.match(chrome, /getBoundingClientRect\(\)\.bottom/);
  assert.match(chrome, /activeTrigger\?\.focus\(\)/);
  assert.match(chrome, /window\.addEventListener\("scroll", closeOnLayoutChange/);
  assert.match(chrome, /className="v118-menu-backdrop" tabIndex=\{-1\}/);
  assert.match(css, /top: var\(--corporate-menu-top,88px\)/);
  assert.match(css, /grid-template-columns: minmax\(0,1fr\) auto !important/);
});

test("both home locales lead with four clean linked project thumbnails, not a reel stage", async () => {
  for (const [route, prefix] of [["/", "/projeler"], ["/en", "/en/projects"]]) {
    const { html } = await render(route);
    const selection = html.match(/<aside[^>]*class="home-project-selection"[\s\S]*?<\/aside>/)?.[0];
    assert.ok(selection, route);
    assert.equal((selection.match(/data-project-code="P-00[1-4]"/g) ?? []).length, 4);
    assert.equal((selection.match(/data-photo-window="archive-photograph"/g) ?? []).length, route === '/' ? 2 : 4);
    for (const slug of ["cihan-tat", "yapikur-plaza", "devrekani-bosb", "viakasta"]) {
      assert.ok(selection.includes(`href="${prefix}/${slug}"`), slug);
      const { response } = await render(`${prefix}/${slug}`);
      assert.equal(response.status, 200, slug);
    }
    for (const file of (route === '/' ? ['cihan-tamamlanan', 'devrekani-3b'] : ['cihan-tamamlanan', 'yapikur-montaj', 'devrekani-3b', 'viakasta'])) assert.ok(selection.includes(`${file}.webp`), file);
    if (route === '/') assert.match(selection, /\/references\/2026-10\//);
    assert.doesNotMatch(html, /class="v4-hero-stage|corporate-project-media/);
    assert.doesNotMatch(selection, /<video|Fotoğraf 1|Fotoğraf 2/);
    assert.match(selection, /3B proje görseli|3D project view/);
  }
});
