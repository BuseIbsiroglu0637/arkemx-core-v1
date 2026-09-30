import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

async function render(pathname, requestHeaders = {}) {
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", ...requestHeaders },
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
  assert.match(html, /href="\/giris\?return_to=%2Fhesabim"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("local build renders the simplified, device-scoped project centre", async () => {
  const response = await render("/dijital-proje-merkezi");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Proje Çalışma Alanı<\/h1>/);
  assert.match(html, /Projenize devam edin/);
  assert.match(html, /Yerel çalışma/);
  assert.match(html, /Proje JSON yükle/);
  assert.match(html, /Proje yedeğini indir/);
  assert.match(html, /href="\/giris\?return_to=%2Fhesabim"/);
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
  assert.match(html, /name="return_to" value="\/bim-koordinasyon"/);
  assert.match(html, /href="\/hesap-kurulum\?return_to=%2Fbim-koordinasyon&amp;entry=first-use"/);
  assert.match(html, /İlk kullanım adımını aç/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
  assert.doesNotMatch(html, /class="account-story/);
});

test("local build renders the first-use account setup entry", async () => {
  const response = await render("/hesap-kurulum?return_to=%2Fdijital-proje-merkezi&entry=first-use");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-setup-title">Hesap kurulumunu tamamlayın<\/h1>/);
  assert.match(html, /Güvenli girişle devam et/);
  assert.match(html, /action="\/hesap-baglantisi"/);
  assert.match(html, /entry=first-use/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
});

test("anonymous focused account page renders a stable sign-in handoff", async () => {
  const response = await render("/hesabim");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-account-login-title">Oturum gerekli<\/h1>/);
  assert.match(html, /href="\/giris\?return_to=%2Fhesabim"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
});

test("authenticated prototype headers open the account directly", async () => {
  const cookie = { cookie: "arkemx_prototype_session=1" };

  const homeResponse = await render("/", cookie);
  assert.equal(homeResponse.status, 200);
  const homeHtml = await homeResponse.text();
  assert.match(homeHtml, /href="\/hesabim">Hesabım<\/a>/);
  assert.doesNotMatch(homeHtml, /href="\/giris\?return_to=%2Fhesabim">Hesabım<\/a>/);

  const centerResponse = await render("/dijital-proje-merkezi", cookie);
  assert.equal(centerResponse.status, 200);
  const centerHtml = await centerResponse.text();
  assert.match(centerHtml, /href="\/hesabim">Hesabım<\/a>/);
  assert.doesNotMatch(centerHtml, /href="\/giris\?return_to=%2Fhesabim">Hesabım<\/a>/);
});

test("local account session diagnostic reports unauthenticated state without D1", async () => {
  const response = await render("/api/account-session");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.authenticated, false);
  assert.equal(body.user, null);
  assert.equal(body.identitySource, null);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("prototype demo sign-in reopens the requested account directly", async () => {
  const response = await render("/hesap-baglantisi?return_to=%2Fhesabim");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/hesabim");
  assert.match(response.headers.get("set-cookie") ?? "", /arkemx_prototype_session=1/);
});

test("explicit first-use setup stays on setup after prototype session creation", async () => {
  const response = await render("/hesap-baglantisi?return_to=%2Fdijital-proje-merkezi", {
    referer: "http://localhost/hesap-kurulum?return_to=%2Fdijital-proje-merkezi&entry=first-use",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/hesap-kurulum?return_to=%2Fdijital-proje-merkezi&entry=first-use");
  assert.match(response.headers.get("set-cookie") ?? "", /arkemx_prototype_session=1/);
});

test("prototype demo session is visible to account diagnostics and account page", async () => {
  const cookie = { cookie: "arkemx_prototype_session=1" };

  const sessionResponse = await render("/api/account-session", cookie);
  assert.equal(sessionResponse.status, 200);
  const body = await sessionResponse.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.identitySource, "prototype-demo");
  assert.equal(body.user.email, "demo@arkemx.local");
  assert.equal(body.user.displayName, "Buse İbşiroğlu");

  const accountResponse = await render("/hesabim", cookie);
  assert.equal(accountResponse.status, 200);
  const html = await accountResponse.text();
  assert.match(html, /<h1>Hesabım<\/h1>/);
  assert.match(html, /demo@arkemx\.local/);
  assert.match(html, /Görüşmeler ve İşlem Geçmişi/);
  assert.match(html, /href="\/demo-cikis\?return_to=%2Fgiris"/);
});

test("prototype demo sign-out clears the local session", async () => {
  const response = await render("/demo-cikis?return_to=%2Fgiris", {
    cookie: "arkemx_prototype_session=1",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/giris");
  assert.match(response.headers.get("set-cookie") ?? "", /arkemx_prototype_session=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});


test("project start numeric fields allow temporary empty edits", () => {
  const source = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  assert.match(source, /const \[numericDrafts, setNumericDrafts\]/);
  assert.match(source, /if \(rawValue\.trim\(\) === ""\) return;/);
  assert.match(source, /value=\{numericDrafts\.targetArea\}/);
  assert.match(source, /value=\{numericDrafts\.floors\}/);
  assert.match(source, /value=\{numericDrafts\.floorHeight\}/);
  assert.match(source, /onBlur=\{\(\) => commitNumericDraft\("targetArea", 20, 1_000_000\)\}/);
  assert.match(source, /onBlur=\{\(\) => commitNumericDraft\("floorHeight", 2\.4, 30\)\}/);
});


test("guided drafts sync to the account and remain portable between preview origins", () => {
  const startSource = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const draftApi = fs.readFileSync(new URL("../app/api/project-draft/route.ts", import.meta.url), "utf8");
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");

  assert.match(startSource, /fetch\("\/api\/project-draft", \{ cache: "no-store" \}\)/);
  assert.match(startSource, /method: "POST"/);
  assert.match(startSource, /method: "DELETE"/);
  assert.match(startSource, /Taslağı indir/);
  assert.match(startSource, /Taslak yükle/);
  assert.match(draftApi, /customer_project_drafts/);
  assert.match(draftApi, /owner_email TEXT PRIMARY KEY/);
  assert.match(accountSource, /Devam eden taslak/);
  assert.match(accountSource, /href="\/proje-baslat"/);
});


test("fresh prototype databases recover the stable demo profile automatically", () => {
  const authSource = fs.readFileSync(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8");
  const workspaceSource = fs.readFileSync(new URL("../app/api/customer-workspace/route.ts", import.meta.url), "utf8");

  assert.match(authSource, /ARKEMX_PROTOTYPE_DEMO_NAME/);
  assert.match(authSource, /Buse İbşiroğlu/);
  assert.match(authSource, /ARKEMX_PROTOTYPE_DEMO_COMPANY/);
  assert.match(workspaceSource, /identitySource === "prototype-demo"/);
  assert.match(workspaceSource, /prototypeDemoProfileDefaults\(\)/);
  assert.match(workspaceSource, /ON CONFLICT\(email\) DO NOTHING/);
});


test("project roadmap labels readiness and user declarations truthfully", () => {
  const startSource = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const guidedSource = fs.readFileSync(new URL("../app/lib/guided-project.ts", import.meta.url), "utf8");

  assert.match(startSource, /BAŞLANGIÇ VERİ HAZIRLIĞI/);
  assert.match(startSource, /EKSİK \/ DOĞRULANACAK VERİLER VE BELGELER/);
  assert.match(startSource, /Kullanıcı beyanı: ada\/parsel hazır/);
  assert.match(guidedSource, /verificationItems/);
  assert.match(guidedSource, /başlangıç formunda henüz girilmedi/);
  assert.match(guidedSource, /status: parcelKnown \? "official-review" : "missing"/);
});


test("active projects do not reopen as a blank new-project form", () => {
  const startSource = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const graphSource = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const coreSource = fs.readFileSync(new URL("../app/lib/project-core.ts", import.meta.url), "utf8");

  assert.match(startSource, /project-start-active-project/);
  assert.match(startSource, /Bu projenin başlangıç bilgileri proje çekirdeğine kaydedildi/);
  assert.match(startSource, /Yeni Bir Proje Başlat/);
  assert.match(graphSource, /Parsel kimliğini ve sınırını doğrula/);
  assert.match(graphSource, /\/arsa-fizibilite-studyosu#geo-studyo/);
  assert.match(coreSource, /bekleniyor", "kullanıcı beyanı", "doğrulanmamış", "önizleme"/);
});


test("completed projects are saved before their recovery draft is cleared", () => {
  const startSource = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");

  assert.match(startSource, /draftHasMeaningfulInput/);
  assert.match(startSource, /persistProjectToAccount/);
  assert.match(startSource, /await clearCompletedDraft\(\)/);
  assert.match(startSource, /if \(!completed \|\| !project\.id/);
  assert.doesNotMatch(startSource, /const finish = \(\) => \{[\s\S]{0,900}localStorage\.removeItem\(DRAFT_KEY\)/);
  assert.match(accountSource, /meaningfulDraft/);
  assert.match(accountSource, /openAccountProject/);
  assert.match(accountSource, /importProject\(item\.payload\)/);
  assert.match(accountSource, />Aç<\/button>/);
});


test("parcel workspace can return to the persistent project start summary", () => {
  const parcelPage = fs.readFileSync(new URL("../app/arsa-fizibilite-studyosu/page.tsx", import.meta.url), "utf8");
  const startPage = fs.readFileSync(new URL("../app/proje-baslat/page.tsx", import.meta.url), "utf8");
  const startStudio = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");

  assert.match(parcelPage, /href="\/proje-baslat\?view=summary"/);
  assert.match(parcelPage, /Önceki adıma dön/);
  assert.match(startPage, /summaryMode/);
  assert.match(startPage, /Proje başlangıç özeti/);
  assert.match(startStudio, /intakeFromProjectModule/);
  assert.match(startStudio, /summaryReady/);
  assert.match(startStudio, /if \(completed \|\| summaryReady\)/);
});
