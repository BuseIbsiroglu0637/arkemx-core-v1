import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

async function render(pathname) {
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("local build renders the current ARKEMX tools homepage", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-tools-title">Araçlar<\/h1>/);
  assert.match(html, /href="\/proje-baslat"/);
  assert.match(html, /href="\/arsa-fizibilite-studyosu"/);
  assert.match(html, /href="\/mimari-program-studyosu"/);
  assert.match(html, /href="\/plan-ve-aks"/);
  assert.match(html, /href="\/tasiyici-on-tasarim"/);
  assert.match(html, /href="\/dijital-proje-merkezi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("local build renders the simplified, device-scoped project centre", async () => {
  const response = await render("/dijital-proje-merkezi");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Proje merkezi<\/h1>/);
  assert.match(html, /Projenize devam edin/);
  assert.match(html, /Bu cihazdaki çalışma/);
  assert.match(html, /Proje JSON yükle/);
  assert.match(html, /Proje yedeğini indir/);
});

test("local build opens the dedicated plan and grid workspace", async () => {
  const response = await render("/plan-ve-aks");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Plan ve aks<\/h1>/);
  assert.match(html, /data-testid="advanced-plan-editor"/);
  assert.match(html, /href="\/dijital-proje-merkezi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="design-studio-hero"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
});

test("local build opens the dedicated structural concept workspace", async () => {
  const response = await render("/tasiyici-on-tasarim");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Taşıyıcı ön tasarım<\/h1>/);
  assert.match(html, /data-testid="structural-designer"/);
  assert.match(html, /href="\/plan-ve-aks"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="design-studio-hero"/);
});
