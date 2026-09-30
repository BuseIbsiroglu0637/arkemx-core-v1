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
  assert.match(html, /href="\/sistem-karsilastirma"/);
  assert.match(html, /href="\/bim-koordinasyon"/);
  assert.match(html, /href="\/proje-takibi"/);
  assert.match(html, /href="\/dijital-proje-merkezi"/);
  assert.match(html, /href="\/hesabim"/);
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
  assert.match(html, /href="\/hesabim"/);
  assert.match(html, /Ayrıntılı proje kontrolleri/);
  assert.match(html, /Proje kontrol özeti/);
  assert.match(html, /Proje adımları/);
  assert.match(html, /Teslim hazırlığı ve teknik çıktılar/);
  assert.match(html, /data-testid="digital-project-hub"/);
  assert.doesNotMatch(html, /Bağlı çalışma alanları\./);
  assert.doesNotMatch(html, /Proje kontrol merkezi/);
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

test("local build renders the focused system comparison with working navigation", async () => {
  const response = await render("/sistem-karsilastirma");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Yapı sistemi karşılaştırma<\/h1>/);
  assert.match(html, /data-testid="system-comparison-tool"/);
  assert.match(html, /Proje girdileri/);
  assert.match(html, /Beş sistemin karşılaştırması/);
  assert.match(html, /Kriter öncelikleri ve ağırlıkları/);
  assert.match(html, /href="\/tasiyici-on-tasarim"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="comparison-hero/);
  assert.doesNotMatch(html, /class="project-guided-journey/);
});

test("local build renders the focused BIM coordination workspace", async () => {
  const response = await render("/bim-koordinasyon");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>BIM koordinasyon<\/h1>/);
  assert.match(html, /data-testid="engineering-coordination-studio"/);
  assert.match(html, /Koordinasyon girdileri/);
  assert.match(html, /Koordinasyon özeti/);
  assert.match(html, /Öncelikli açık konular/);
  assert.match(html, /href="\/proje-takibi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="coordination-page-hero/);
  assert.doesNotMatch(html, /class="project-guided-journey/);
});

test("local build renders the focused project tracking workspace", async () => {
  const response = await render("/proje-takibi");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Proje takibi<\/h1>/);
  assert.match(html, /data-testid="project-operating-system"/);
  assert.match(html, /Proje durumu ve açık işler/);
  assert.match(html, /Teslim hazırlığı/);
  assert.match(html, /Kararlar ve RFI/);
  assert.match(html, /href="\/dijital-proje-merkezi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="os-page-hero/);
  assert.doesNotMatch(html, /class="project-guided-journey/);
});

test("local build renders the focused ARKEMX sign-in entry", async () => {
  const response = await render("/giris?return_to=%2Fbim-koordinasyon");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-auth-title">ARKEMX’e giriş<\/h1>/);
  assert.match(html, /Güvenli giriş yap/);
  assert.match(html, /action="\/hesap-baglantisi"/);
  assert.doesNotMatch(html, /name="return_to"/);
  assert.match(html, /href="\/hesap-kurulum"/);
  assert.match(html, /İlk kullanım adımını aç/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
  assert.doesNotMatch(html, /class="account-story/);
});

test("local build renders the first-use account setup entry", async () => {
  const response = await render("/hesap-kurulum?return_to=%2Fdijital-proje-merkezi");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-setup-title">Hesap kurulumunu tamamlayın<\/h1>/);
  assert.match(html, /Güvenli girişle devam et/);
  assert.match(html, /action="\/hesap-baglantisi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
});

test("anonymous focused account page returns to sign-in", async () => {
  const response = await render("/hesabim");
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/giris\?return_to=%2Fhesabim/);
});
