import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import postcss from "postcss";

const css = postcss.parse(fs.readFileSync(new URL("../app/home-experience.css", import.meta.url), "utf8"));
const prefix = "body.arkem-corporate-site .home-experience";
function rulesFor(selector) {
  const result = [];
  css.walkRules(rule => { if (rule.selectors?.includes(`${prefix} ${selector}`)) result.push(rule); });
  return result;
}
function declaration(rule, name) { return rule.nodes.find(node => node.type === "decl" && node.prop === name)?.value; }

async function render(path) {
  const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url));
  const response = await worker.fetch(new Request(`https://arkemyapisistemleri.com${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  return response.text();
}

test("new art direction cannot restyle other routes or shared navigation", () => {
  css.walkRules(rule => {
    if (rule.parent.type === "atrule" && rule.parent.name === "keyframes") return;
    for (const selector of rule.selectors) assert.ok(selector === prefix || selector.startsWith(`${prefix} `), selector);
  });
});

test("legacy raster remains intact but is not used as the current homepage experience", () => {
  const file = fs.readFileSync(new URL("../public/visuals/hero-line-to-volume-v1.webp", import.meta.url));
  assert.equal(file.toString("ascii", 0, 4), "RIFF");
  assert.equal(file.toString("ascii", 8, 12), "WEBP");
  assert.ok(file.length < 400_000, `${file.length} bytes`);
  // Decode container header dimensions, rather than trusting JSX attributes.
  let dimensions;
  for (let offset = 12; offset + 8 <= file.length;) {
    const kind = file.toString("ascii", offset, offset + 4);
    const length = file.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (kind === "VP8 ") {
      assert.equal(file.toString("hex", data + 3, data + 6), "9d012a");
      dimensions = [file.readUInt16LE(data + 6) & 0x3fff, file.readUInt16LE(data + 8) & 0x3fff];
    } else if (kind === "VP8X") dimensions = [file.readUIntLE(data + 4, 3) + 1, file.readUIntLE(data + 7, 3) + 1];
    else if (kind === "VP8L") {
      assert.equal(file[data], 0x2f);
      const bits = file.readUInt32LE(data + 1);
      dimensions = [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (dimensions) break;
    offset = data + length + (length % 2);
  }
  assert.deepEqual(dimensions, [1774, 887]);
  const source = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  assert.match(source, /BuildingWalkthrough/);
  assert.doesNotMatch(source, /HomeArchitecture/);
  assert.doesNotMatch(source, /hero-line-to-volume-v1/);
});

test("3D interaction is opt-in, view-controlled and never continuously animated", () => {
  const source = fs.readFileSync(new URL("../app/components/BuildingWalkthrough.tsx", import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../app/lib/building-walkthrough.ts", import.meta.url), "utf8");
  assert.match(source, /useState\(false\)/);
  assert.match(source, /aria-pressed=\{view === item.id\}/);
  assert.match(source, /engage\(!active\)/);
  assert.match(source, /sibling.inert = true/);
  assert.match(source, /Escape/);
  assert.match(renderer, /controls.autoRotate = false/);
  assert.match(renderer, /document.hidden/);
  assert.match(renderer, /InstancedMesh/);
  assert.doesNotMatch(renderer, /setAnimationLoop|setInterval/);
  assert.doesNotMatch(source, /setInterval|motionRequested|autoplay/);
  for (const rule of rulesFor(".home-architecture-image > img")) {
    if (rule.parent.name === "media" && /prefers-reduced-motion: reduce/.test(rule.parent.params)) {
      assert.equal(declaration(rule, "animation"), "none");
      assert.equal(declaration(rule, "transform"), "none");
    }
  }
  let animations = 0;
  css.walkDecls("animation", decl => { if (decl.value !== "none") { animations++; assert.match(decl.parent.selector, /\[data-motion="on"\]/); } });
  assert.equal(animations, 0);
  assert.ok(rulesFor(".home-architecture-image > img").some(rule => rule.parent.name === "media" && rule.parent.params.includes("prefers-reduced-motion: reduce")));
});

test("project strip remains a touch/keyboard native scroller, and does not compete for hero priority", () => {
  const source = fs.readFileSync(new URL("../app/components/HomeProjectCarousel.tsx", import.meta.url), "utf8");
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /event\.target === event\.currentTarget/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(source, /priority=|setInterval|autoplay/);
  assert.equal(declaration(rulesFor(".home-project-track")[0], "scroll-snap-type"), "x proximity");
  assert.equal(declaration(rulesFor(".home-project-controls button")[0], "min-height"), "44px");
});

test("selected hero color pairs reach 4.5:1 contrast", () => {
  const luminance = hex => {
    const values = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
  };
  for (const [foreground, background] of [["#b8c9d1", "#081923"], ["#e6ae87", "#081923"], ["#081923", "#e6ae87"], ["#bdcbd2", "#102630"], ["#b3c4ce", "#081923"]]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${foreground} on ${background}`);
  }
});

test("TR and EN HTML expose the supplied model label, static preview and real project links without JavaScript", async () => {
  for (const [path, label, start] of [["/", "KONUT / MİMARİ MODEL", "/proje-baslat"], ["/en", "RESIDENTIAL / ARCHITECTURAL MODEL", "/en/contact"]]) {
    const html = await render(path);
    assert.match(html, /class="v4-home home-experience"/);
    assert.ok(html.includes(label));
    assert.doesNotMatch(html, /data-motion="on"/);
    assert.match(html, /data-renderer-state="loading"/);
    assert.match(html, /data-model-kind="supplied-architectural"/);
    assert.match(html, /src="\/models\/arkem-residential-preview.png"/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /aria-controls="home-project-phase-note"/);
    assert.ok(html.includes(`href="${start}"`));
    assert.equal((html.match(/data-project-code="P-00[1-4]"/g) ?? []).length, 4);
    assert.doesNotMatch(html, /<video|<canvas/);
    assert.doesNotMatch(html, /same technical decision|aynı teknik kararın farklı görünümleri/);
  }
});

test("art, photo and 3D project view stay separate and the four customer routes are still reachable", async () => {
  const html = await render("/");
  assert.match(html, /3B proje görseli/);
  assert.match(html, /Saha kaydı/);
  for (const href of ["/proje-baslat", "/arsa-fizibilite-studyosu", "/yapi-sistemi-karsilastirma", "/musteri-proje-portali"]) assert.ok(html.includes(`href="${href}"`));
  assert.match(html, /class="building-tour project-model-tour"/);
  assert.match(html, /Mimari sunumdur; doğrulanmış statik proje veya tamamlanmış uygulama beyanı değildir/);
  assert.match(html, /href="\/projeler\/cihan-tat"/);
  assert.doesNotMatch(html, /hero-line-to-volume-v1|home-architecture-figure/);
});
