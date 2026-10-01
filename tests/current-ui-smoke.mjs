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

test("local build sends unauthenticated root entry to ARKEMX sign-in", async () => {
  const response = await render("/");
  assert.ok(response.status === 307 || response.status === 308);
  assert.match(response.headers.get("location") ?? "", /\/giris\?return_to=%2Fdijital-proje-merkezi$/);
});

test("local build renders the ARKEMX tools catalogue on its dedicated route", async () => {
  const response = await render("/araclar");
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
  assert.ok(homeResponse.status === 307 || homeResponse.status === 308);
  assert.match(
    homeResponse.headers.get("location") ?? "",
    /\/hesap-kurulum\?return_to=%2Fdijital-proje-merkezi$/,
  );

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
  assert.match(accountSource, /Devam eden proje taslağı/);
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
  const finishStart = startSource.indexOf("const finish = () => {");
  const cleanupStart = startSource.indexOf("const clearCompletedDraft = async", finishStart);
  assert.ok(finishStart >= 0 && cleanupStart > finishStart);
  const finishBlock = startSource.slice(finishStart, cleanupStart);
  assert.doesNotMatch(finishBlock, /localStorage\.removeItem\(DRAFT_KEY\)/);
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


test("account automatically reconciles an active local project missing from account storage", () => {
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  assert.match(accountSource, /accountHasActiveProject/);
  assert.match(accountSource, /Aktif proje hesabınızla eşitleniyor/);
  assert.match(
    accountSource,
    /expectedAccountUpdatedAt: accountActiveProject\?\.updatedAt \?\? null/,
  );
  assert.match(accountSource, /arx-account-local-project/);
  assert.match(accountSource, /Şimdi kaydet/);
});


test("account keeps draft continuation clear without a redundant project-header action", () => {
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  assert.match(accountSource, /Taslağa Devam Et/);
  assert.match(accountSource, /arx-account-draft-actions/);
  assert.match(accountSource, /<footer><Link href="\/dijital-proje-merkezi">Projeye Devam Et →<\/Link><\/footer>/);
  assert.doesNotMatch(accountSource, /<header>[\s\S]{0,300}Projeye Devam Et<\/Link>[\s\S]{0,50}<\/header>/);
});


test("account and delete flows use clearer project continuation and close controls", () => {
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  const centerSource = fs.readFileSync(new URL("../app/components/SimpleProjectCenter.tsx", import.meta.url), "utf8");
  assert.match(accountSource, /Projeye Devam Et/);
  assert.doesNotMatch(centerSource, />Vazgeç<\/button>/);
  assert.match(centerSource, /aria-label="Silme panelini kapat"/);
  assert.match(centerSource, /<X size=\{17\}/);
});


test("every guided project stage exposes a previous-step action", () => {
  const pages = [
    ["../app/arsa-fizibilite-studyosu/page.tsx", "/proje-baslat?view=summary"],
    ["../app/mimari-program-studyosu/page.tsx", "/arsa-fizibilite-studyosu#geo-studyo"],
    ["../app/plan-ve-aks/page.tsx", "/mimari-program-studyosu"],
    ["../app/tasiyici-on-tasarim/page.tsx", "/plan-ve-aks"],
    ["../app/sistem-karsilastirma/page.tsx", "/tasiyici-on-tasarim"],
    ["../app/bim-koordinasyon/page.tsx", "/sistem-karsilastirma"],
    ["../app/proje-takibi/page.tsx", "/bim-koordinasyon"],
  ];
  for (const [relativePath, previousHref] of pages) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /Önceki adıma dön/);
    assert.ok(source.includes(`href="${previousHref}"`));
  }

  const kernelSource = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernelSource, /previousJourneyStep/);
  assert.match(kernelSource, /← Önceki adım/);
});


test("parcel workspace starts clean, inherits project location and updates device location dynamically", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  const geocode = fs.readFileSync(new URL("../app/api/geocode/route.ts", import.meta.url), "utf8");

  assert.match(studio, /useState<GeoPoint\[\]>\(\[\]\)/);
  assert.doesNotMatch(studio, /useState<GeoPoint\[\]>\(\(\) => sampleParcel\(defaultCenter\)\)/);
  assert.match(studio, /parseDeclaredLocation/);
  assert.match(studio, /Başlangıç konumu \/ kullanıcı beyanı/);
  assert.match(studio, /fetchGeocode\(\{ q: declaredLocation \}\)/);
  assert.match(studio, /fetchGeocode\(\{ lat: point\.lat, lng: point\.lng \}\)/);
  assert.match(studio, /setProvince\(result\.province \?\? ""\)/);
  assert.match(studio, /setDistrict\(result\.district \?\? ""\)/);
  assert.match(studio, /Ada \/ parsel seçimi bekleniyor/);
  assert.match(studio, /disabled=\{!parcel\.length\}/);
  assert.match(studio, /!simple && <button className="geo-wide-action" onClick=\{loadSample\}/);
  assert.doesNotMatch(studio, /normalizeAdministrativeName\("Sakarya"\)/);

  assert.match(kernel, /const locationParts = intake\.location\.includes\("\/"\)/);
  assert.match(geocode, /nominatim\.openstreetmap\.org\/search/);
  assert.match(geocode, /nominatim\.openstreetmap\.org\/reverse/);
  assert.match(geocode, /countrycodes/);
});


test("active project summary cannot be overwritten by a separate unfinished draft", () => {
  const start = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const account = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");

  assert.match(start, /if \(summaryMode\) \{\s*setDraftReady\(true\);\s*return;/);
  assert.match(start, /if \(summaryMode \|\| !draftReady/);
  assert.match(start, /Başlangıç kararları proje çekirdeğinden yeniden yüklendi/);

  assert.match(account, /Yeni proje taslağı · kayıtlı projelerden ayrıdır/);
  assert.match(account, /const removeDraft = async \(\) =>/);
  assert.match(account, /fetch\("\/api\/project-draft", \{ method: "DELETE" \}\)/);
  assert.match(account, /window\.localStorage\.removeItem\(GUIDED_DRAFT_KEY\)/);
});


test("TKGM parcel boundaries stay read-only until an editable copy is created", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");

  assert.match(studio, /officialBoundaryLocked/);
  assert.match(studio, /officialBoundaryLockedRef/);
  assert.match(studio, /Düzenlenebilir Kopya Oluştur/);
  assert.match(studio, /Orijinal TKGM Sınırına Dön/);
  assert.match(studio, /TKGM sınırı salt okunurdur/);
  assert.match(studio, /officialBoundaryEvidence/);
  assert.match(studio, /TKGM kaynaklı kullanıcı kopyası · uzman doğrulaması gerekli/);
  assert.match(studio, /if \(officialBoundaryLockedRef\.current\)/);
  assert.match(studio, /setOfficialBoundaryEvidence\(\{/);
  assert.match(studio, /officialBoundaryEvidence,/);
});


test("3D terrain opens without massing and labels preliminary calculations", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const viewer = fs.readFileSync(new URL("../app/components/GeoTerrainViewer.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("showTerrainMassing"));
  assert.ok(studio.includes("Temsili kütleyi göster"));
  assert.ok(studio.includes("Temsili Ön Kütle"));
  assert.ok(studio.includes("\"building-mass\": showTerrainMassing"));
  assert.ok(viewer.includes("Temsili Ön Kütle"));
  assert.ok(viewer.includes("Parametrik ön hesap"));
  assert.ok(viewer.includes("Ölçülmüş veri değildir"));
});


test("3D terrain hides building-dependent metrics until conceptual massing is enabled", () => {
  const viewer = fs.readFileSync(new URL("../app/components/GeoTerrainViewer.tsx", import.meta.url), "utf8");
  assert.ok(viewer.includes('layers["building-mass"] && <>'));
  assert.ok(viewer.includes('geo-terrain-analysis'));
  assert.ok(viewer.includes('terrain-only'));
  assert.ok(viewer.includes('YAPI ALTI Δ'));
  assert.ok(viewer.includes('ÖN HAFRİYAT'));
});


test("coordinate data view distinguishes parametric terrain values from measured data", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("PARAMETRİK KOT FARKI"));
  assert.ok(studio.includes("Ölçülmüş Z verisi yok"));
  assert.ok(studio.includes("TEMSİLİ EŞ YÜKSELTİ"));
  assert.ok(studio.includes("Parametrik yüzeyden üretildi"));
  assert.ok(studio.includes("Yerel ENU başlangıcı"));
  assert.ok(studio.includes("Parsel merkezi (0,0) kabul edilir"));
  assert.ok(studio.includes("resmî pafta koordinatı değil"));
});


test("zoning form starts empty and does not invent planning rights", () => {
  const zoning = fs.readFileSync(new URL("../app/lib/zoning.ts", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");

  assert.ok(zoning.includes('planScale: ""'));
  assert.ok(zoning.includes('buildingOrder: ""'));
  assert.ok(zoning.includes('taks: -1'));
  assert.ok(zoning.includes('kaks: -1'));
  assert.ok(zoning.includes('hmax: -1'));
  assert.ok(zoning.includes('frontSetback: -1'));
  assert.ok(zoning.includes('sourceType: ""'));
  assert.ok(zoning.includes('sourceDate: ""'));
  assert.ok(zoning.includes('sourceNote: ""'));
  assert.ok(studio.includes("İmar girdileri bekleniyor"));
  assert.ok(studio.includes("Yapı zarfı henüz üretilmedi"));
  assert.ok(studio.includes("Plan ölçeğini seçin"));
  assert.ok(studio.includes("Yapı nizamını seçin"));
  assert.ok(studio.includes("TAKS girin"));
  assert.ok(studio.includes("KAKS / emsal girin"));
  assert.ok(studio.includes("looksLikeLegacyPlaceholder"));
  assert.ok(studio.includes("zoningFormReady"));
  assert.ok(studio.includes("Onaylı kaynak statüsü, yetkili doğrulama süreci kurulana kadar kullanıcı arayüzünden atanamaz"));
});


test("unverified zoning massing uses qualified language and flags manual Hmax conflicts", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("Girilen imar koşullarında ön kütleyi sınayın."));
  assert.ok(studio.includes("GİRDİYE GÖRE AZAMİ TABAN"));
  assert.ok(studio.includes("GİRDİYE GÖRE AZAMİ EMSAL ALAN"));
  assert.ok(studio.includes("GİRDİYE GÖRE YÜKSEKLİK / KAT SINIRI"));
  assert.ok(studio.includes("GİRDİLERLE ÖN UYUMLU"));
  assert.ok(studio.includes("Doğrulanmamış kullanıcı imar girdilerine göre hesaplanmıştır."));
  assert.ok(studio.includes("manualHeightExceedsZoning"));
  assert.ok(studio.includes("Yükseklik sınırı aşılıyor."));
});


test("unverified massing terminology avoids implying official zoning rights", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("V112 / İMAR GİRDİLİ KÜTLE ÖN KONTROLÜ"));
  assert.ok(studio.includes("Girdi kullanım oranı"));
  assert.ok(studio.includes('massingModel.source.authoritative ? "V112 / İMAR UYUMLU KÜTLE MOTORU"'));
  assert.ok(studio.includes('massingModel.source.authoritative ? "Hak kullanımı" : "Girdi kullanım oranı"'));
});


test("2D map distinguishes TKGM boundary, conceptual setback envelope and read-only points", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("setbackEnvelopeLayerRef"));
  assert.ok(studio.includes("Kavramsal çekme zarfı · ön kontrol"));
  assert.ok(studio.includes("Temsili Ön Kütle"));
  assert.ok(studio.includes("TKGM parsel sınırı"));
  assert.ok(studio.includes("TKGM sınır noktası · salt okunur"));
  assert.ok(studio.includes('dashArray: "7 6"'));
});


test("2D conceptual massing visibility is independent from 3D massing toggle", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("showConceptualOverlays && zoningFormReady && parcel.length >= 3"));
  assert.ok(!studio.includes('showConceptualOverlays && terrainLayers["building-mass"] && parcel.length >= 3'));
  assert.ok(studio.includes("Temsili Ön Kütle<br>"));
});


test("2D map warns when conceptual massing breaches parcel or setback pre-check", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("geo-map-placement-warning"));
  assert.ok(studio.includes("Yerleşim ön kontrolü uyarısı."));
  assert.ok(studio.includes("Temsili Ön Kütle parsel sınırını aşıyor veya sınırla kesişiyor."));
  assert.ok(studio.includes("KENAR BAZLI ÇEKME UYARISI"));
  assert.ok(studio.includes('color: placementWarning ? "#e27b42" : "#ffffff"'));
});


test("north-relative rotation control supports negative angles", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes('min="-180" max="180" step="5"'));
  assert.ok(studio.includes("normalizeSignedRotation"));
  assert.ok(studio.includes("setRotation(normalizeSignedRotation(saved.rotation))"));
});


test("manual placement uses edge-specific front side rear setbacks", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("assessParcelEdgeSetbacks"));
  assert.ok(studio.includes("setbackRoleLabel"));
  assert.ok(studio.includes("Ön/yan/arka çekmeler kenar bazında ayrı kontrol edilir"));
  assert.ok(studio.includes("en kritik"));
});


test("live massing precheck surfaces TAKS KAKS and Hmax violations", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("const taksExceeded"));
  assert.ok(studio.includes("const kaksExceeded"));
  assert.ok(studio.includes("const hmaxExceeded"));
  assert.ok(studio.includes("İmar ön kontrolü uyarısı."));
  assert.ok(studio.includes("TAKS ÖN KONTROL UYARISI"));
  assert.ok(studio.includes("KAKS ÖN KONTROL UYARISI"));
  assert.ok(studio.includes("HMAX ÖN KONTROL UYARISI"));
  assert.ok(studio.includes("İmar oranı ön kontrolü aşılıyor."));
  assert.ok(studio.includes("placementPrecheckWarning"));
});


test("manual massing area uses the same one-decimal dimensions shown in UI", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("normalizeMassingDimension"));
  assert.ok(studio.includes("const canonicalWidth = normalizeMassingDimension(buildingWidth)"));
  assert.ok(studio.includes("const canonicalDepth = normalizeMassingDimension(buildingDepth)"));
  assert.ok(studio.includes("const footprint = canonicalWidth * canonicalDepth"));
  assert.ok(studio.includes("const gross = footprint * floors"));
  assert.ok(studio.includes('calculationBasis: "displayed-rectangular-dimensions-0.1m"'));
  assert.equal(Number((22.5 * 16.6).toFixed(2)), 373.5);
  assert.equal(Number((22.5 * 16.6 * 4).toFixed(2)), 1494);
  assert.equal(Number((30 * 16.6).toFixed(2)), 498);
});


test("TAKS and KAKS thresholds use displayed allowed areas at dimension-step precision", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("metrics.footprint > metrics.allowedFootprint + .01"));
  assert.ok(studio.includes("metrics.gross > metrics.allowedGross + .01"));
  assert.ok(studio.includes('!taksExceeded && !kaksExceeded && !hmaxExceeded, "İmar girdileriyle ön uyum"'));
  assert.equal(Number((22.5 * 21.3).toFixed(2)), 479.25);
  assert.equal(Number((22.5 * 21.4).toFixed(2)), 481.5);
});


test("parking demand result is visible beside inputs and in technical summary", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("const parkingDemand = gross / 100 * parkingPer100"));
  assert.ok(studio.includes("const parkingNeed = Math.ceil(parkingDemand)"));
  assert.ok(studio.includes("Hesaplanan park ihtiyacı"));
  assert.ok(studio.includes("→ yukarı yuvarlandı"));
  assert.ok(studio.includes("<small>Park ihtiyacı</small><b>{metrics.parkingNeed} araç</b>"));
});


test("application exposes persistent light and dark theme controls", () => {
  const theme = fs.readFileSync(new URL("../app/components/ThemeSystem.tsx", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.ok(theme.includes('type ArkemTheme = "light" | "dark"'));
  assert.ok(theme.includes('localStorage.setItem(STORAGE_KEY, next)'));
  assert.ok(theme.includes('aria-label="Tema seçimi"'));
  assert.ok(theme.includes('Açık'));
  assert.ok(theme.includes('Koyu'));
  assert.ok(layout.includes("<ThemeControl/>"));
  assert.ok(layout.includes('localStorage.getItem("arkemx-theme")'));
  assert.ok(globals.includes('html[data-theme="dark"]'));
});


test("dark theme uses true black surfaces and high-contrast parcel UI", () => {
  const theme = fs.readFileSync(new URL("../app/components/ThemeSystem.tsx", import.meta.url), "utf8");
  const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const geo = fs.readFileSync(new URL("../app/arsa-fizibilite-studyosu/sade-arazi.css", import.meta.url), "utf8");
  assert.ok(theme.includes('theme === "dark" ? "#000000"'));
  assert.ok(globals.includes("/* ARKEMX true-black dark pass */"));
  assert.ok(globals.includes("background: #000000 !important"));
  assert.ok(geo.includes("/* ARKEMX geo true-black contrast pass */"));
  assert.ok(geo.includes("color: #ffffff !important"));
  assert.ok(geo.includes("Keep satellite/terrain imagery natural"));
});


test("geo parcel state survives reloads and can recover from project backup", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("arkemx-geo-draft:"));
  assert.ok(studio.includes("PROJECT_BACKUP_KEY"));
  assert.ok(studio.includes("decodeProjectEnvelope"));
  assert.ok(studio.includes("if (!Object.keys(project.modules).length) return"));
  assert.ok(studio.includes('setNeighborhood(saved.neighborhood ?? "")'));
  assert.ok(studio.includes('setBlock(saved.block ?? "")'));
  assert.ok(studio.includes('setParcelNo(saved.parcelNo ?? "")'));
  assert.ok(studio.includes("if (!hydrated || !transferApplied.current) return"));
  assert.ok(studio.includes("window.localStorage.setItem(geoDraftKey(project.id)"));
  assert.ok(studio.includes('patchModule("geo-parcel", moduleSnapshot)'));
});

test("account navigation stays inside the Next app so project kernel remains mounted", () => {
  const accountLink = fs.readFileSync(new URL("../app/components/AccountHeaderLink.tsx", import.meta.url), "utf8");
  assert.ok(accountLink.includes('import Link from "next/link"'));
  assert.ok(accountLink.includes("return <Link href={href}>{label}</Link>"));
  assert.ok(!accountLink.includes("return <a href={href}>{label}</a>"));
});


test("project geocoding cannot erase a restored parcel identity", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("const hasExplicitParcelIdentity = Boolean("));
  assert.ok(studio.includes("saved?.previewParcel?.length"));
  assert.ok(studio.includes("|| neighborhood"));
  assert.ok(studio.includes("|| block"));
  assert.ok(studio.includes("|| parcelNo"));
  assert.ok(studio.includes("if (result.province && !province) setProvince(result.province)"));
  assert.ok(studio.includes("if (result.district && !district) setDistrict(result.district)"));
  const geocodeEffectStart = studio.indexOf("const hasExplicitParcelIdentity = Boolean(");
  const geocodeEffectEnd = studio.indexOf("const coordinateCenter = useMemo", geocodeEffectStart);
  const geocodeEffect = studio.slice(geocodeEffectStart, geocodeEffectEnd);
  assert.ok(!geocodeEffect.includes('setNeighborhood("")'));
  assert.ok(!geocodeEffect.includes('setBlock("")'));
  assert.ok(!geocodeEffect.includes('setParcelNo("")'));
});




test("restored parcel identity stays visible while TKGM lists reload", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("function keepSelectedAdministrativeOption("));
  assert.ok(studio.includes("const visibleProvinceOptions = useMemo("));
  assert.ok(studio.includes("const visibleDistrictOptions = useMemo("));
  assert.ok(studio.includes("const visibleNeighborhoodOptions = useMemo("));
  assert.ok(studio.includes('setParcelLookup(hasSavedBoundary || hasSavedPreviewBoundary ? "found" : "idle")'));
  assert.ok(studio.includes('"parcel-boundary": restoredParcel.length >= 3 ? true'));
  assert.ok(studio.includes("visibleNeighborhoodOptions.map((item) => <option"));
});


test("account project open preserves newer local state and avoids full reload", () => {
  const account = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  assert.ok(account.includes('import { useRouter } from "next/navigation"'));
  assert.ok(account.includes("const accountCopyNeedsUpdate = hasActiveProject"));
  assert.ok(account.includes("localProjectUpdatedAt > accountPayloadUpdatedAt"));
  assert.ok(account.includes("expectedAccountUpdatedAt: accountActiveProject?.updatedAt ?? null"));
  assert.ok(account.includes("const openingCurrentLocalProject = hasActiveProject"));
  assert.ok(account.includes("localProjectUpdatedAt >= payloadUpdatedAt(item.payload)"));
  assert.ok(account.includes('router.push("/dijital-proje-merkezi")'));
  assert.ok(!account.includes('window.location.assign("/dijital-proje-merkezi")'));
});


test("zoning source metadata is explicit, persistent and never treated as approval", () => {
  const zoning = fs.readFileSync(new URL("../app/lib/zoning.ts", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(zoning.includes("sourceType: string"));
  assert.ok(zoning.includes("sourceDate: string"));
  assert.ok(zoning.includes("sourceNote: string"));
  assert.ok(zoning.includes("type: zoning.sourceType || null"));
  assert.ok(zoning.includes("date: zoning.sourceDate || null"));
  assert.ok(studio.includes("Kaynak türünü seçin"));
  assert.ok(studio.includes("Belge / kaynak tarihi"));
  assert.ok(studio.includes("Kaynak açıklaması"));
  assert.ok(studio.includes("Kaynak bilgisi eklendi · uzman doğrulaması gerekli"));
  assert.ok(studio.includes("Kaynak bilgisi eksik"));
  assert.ok(studio.includes("zoningSourceReferenceReady"));
  assert.ok(studio.includes('zoning.sourceType === "Kullanıcı beyanı" && zoning.sourceNote.trim()'));
  assert.ok(studio.includes("zoningSourceReady"));
});


test("project next-action links can open the exact parcel workflow stage", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  assert.ok(studio.includes('new URLSearchParams(window.location.search).get("stage")'));
  assert.ok(studio.includes("stages.some((stage) => stage.id === requestedStage)"));
  assert.ok(graph.includes('/arsa-fizibilite-studyosu?stage=locate#geo-studyo'));
  assert.ok(graph.includes('/arsa-fizibilite-studyosu?stage=zoning#geo-studyo'));
  assert.ok(studio.includes('[zoningSourceReady, "İmar kaynak bilgisi kayıtlı"]'));
});
