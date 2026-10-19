"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { customerBudgetLabels, customerRecord, customerStepLabels, customerSystemLabels, customerTimelineLabels, deriveCustomerJourney } from "../lib/customer-journey";
import { GUIDED_DOCUMENT_OPTIONS } from "../lib/guided-project";
import { downloadTextFile } from "../lib/engineering";
import { useProjectKernel } from "./ProjectKernel";
import { CustomerAccountSave } from "./CustomerAccountSave";
import { ProjectBriefForm } from "./ProjectBriefForm";

type CustomerSpace = { id: string; code: string; name: string; zone: string; count: number; unitArea: number; density: number; daylight: boolean; accessible: boolean };
function SpaceEditor({ onComplete }: { onComplete: () => void }) {
  const { project, patchModule } = useProjectKernel();
  const architecture = customerRecord(project.modules["architectural-program"]);
  const intake = customerRecord(customerRecord(project.modules["decision-assistant"]).input);
  const [spaces, setSpaces] = useState<CustomerSpace[]>(() => Array.isArray(architecture.spaces) ? architecture.spaces.map((space: CustomerSpace) => ({ ...space })) : []);
  const [error, setError] = useState("");
  const netArea = spaces.reduce((total, s) => total + (s.count || 0) * (s.unitArea || 0), 0);
  function add(name = "") { setSpaces(current => [...current, { id: `CLIENT-${crypto.randomUUID()}`, code: `M-${current.length + 1}`, name, zone: "İhtiyaç programı", count: 1, unitArea: 0, density: 10, daylight: true, accessible: true }]); }
  function update(index: number, patch: Partial<CustomerSpace>) { setSpaces(current => current.map((space, i) => i === index ? { ...space, ...patch } : space)); }
  function save() {
    if (!spaces.length || spaces.some(s => !s.name.trim() || !Number.isInteger(s.count) || s.count < 1 || s.count > 1000 || !Number.isFinite(s.unitArea) || s.unitArea <= 0 || s.unitArea > 1_000_000)) { setError("Her mekâna ad, en az 1 tam sayı adet ve sıfırdan büyük yaklaşık alan girin."); return; }
    patchModule("architectural-program", { spaces, needsReview: true, status: "Müşteri ihtiyaç programı; mimar incelemesi bekleniyor" });
    const journey = customerRecord(project.modules["customer-journey"]);
    patchModule("customer-journey", { confirmations: { ...customerRecord(journey.confirmations), spaces: JSON.stringify(spaces) } });
    onComplete();
  }
  const ideas = intake.usage === "residential" ? ["Salon", "Yatak odası", "Mutfak", "Banyo"] : ["Üretim / çalışma alanı", "Depo", "Ofis", "Ortak alan"];
  return <div><p>İhtiyacınız olan mekânları yazın. Yaklaşık alanlar yeterli; mimarınız dolaşım ve servis alanlarını ayrıca değerlendirecek.</p><div className="customer-ideas" aria-label="Mekân ekleme önerileri">{ideas.map(name => <button type="button" key={name} onClick={() => add(name)}>+ {name}</button>)}</div>
    <div className="customer-spaces">{spaces.map((space, index) => <fieldset key={space.id}><legend>Mekân {index + 1}</legend><label>Adı<input maxLength={100} value={space.name} onChange={e => update(index, { name: e.target.value })} /></label><label>Adet<input type="number" min={1} max={1000} step={1} value={space.count || ""} onChange={e => update(index, { count: Number(e.target.value) })} /></label><label>Birim alan (m²)<input type="number" min={1} step="any" max={1_000_000} value={space.unitArea || ""} onChange={e => update(index, { unitArea: Number(e.target.value) })} /></label><button type="button" className="customer-remove" aria-label={`${space.name || `Mekân ${index + 1}`} sil`} onClick={() => setSpaces(current => current.filter((_, i) => i !== index))}>Sil</button></fieldset>)}</div>
    <button type="button" className="customer-secondary" onClick={() => add()}>Başka mekân ekle</button><p className="customer-area"><b>{netArea.toLocaleString("tr-TR")} m²</b> mekân alanı / {Number(intake.targetArea || 0).toLocaleString("tr-TR")} m² hedef brüt alan</p>{netArea > Number(intake.targetArea) && <p role="status">Mekân alanı brüt hedefinizi aşıyor. İhtiyaçlarınızı veya hedef alanı mimarınızla birlikte gözden geçirin.</p>}{error && <p role="alert" className="customer-error">{error}</p>}<button type="button" className="customer-primary" onClick={save}>Mekânlarımı kaydet ve devam et</button><p><Link href="/mimari-program-studyosu#mimari-motor">Ayrıntılı mimari çalışma alanını aç</Link></p></div>;
}

export function CustomerProjectGuide() {
  const { project, hydrated, patchModule } = useProjectKernel();
  const progress = deriveCustomerJourney(project);
  const activeProjectId = useRef(project.id);
  useLayoutEffect(() => { activeProjectId.current = project.id; }, [project.id]);
  const [selected, setSelected] = useState<number | null>(null);
  const [system, setSystem] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const intake = customerRecord(customerRecord(project.modules["decision-assistant"]).input);
  const journey = customerRecord(project.modules["customer-journey"]);
  const step = selected ?? progress.next;
  const started = hydrated && progress.complete[0];
  function go(index: number) { setSelected(index); window.requestAnimationFrame(() => heading.current?.focus()); }
  function confirm(key: string, next: number, extra: Record<string, unknown> = {}) {
    let signature = progress.signature;
    let confirmations = { ...customerRecord(journey.confirmations) };
    if (key === "system" && extra.systemDecision) {
      patchModule("system-comparison", { input: { preferredSystem: extra.systemDecision }, needsReview: true });
      patchModule("decision-assistant", { input: { system: extra.systemDecision } });
      signature = JSON.stringify({ ...intake, system: extra.systemDecision });
      confirmations = Object.fromEntries(Object.entries(confirmations).map(([name, value]) => [name, value === progress.signature ? signature : value]));
    }
    patchModule("customer-journey", { ...extra, confirmations: { ...confirmations, [key]: signature } }); go(next);
  }
  useEffect(() => { setSelected(null); setSystem(""); }, [project.id]);
  function recordSubmission(reference: string, submittedMessage: string) {
    if (activeProjectId.current !== project.id) return;
    patchModule("customer-journey", { submission: { reference, submittedMessage, signature: progress.summary, submittedAt: new Date().toISOString() } });
  }
  return <section className="customer-guide shell" aria-labelledby="customer-guide-title">
    <header className="customer-guide-heading"><div><p>ARKEMX / PROJEM</p><h1 id="customer-guide-title">{started ? project.name : "Nasıl bir yapı planlıyorsunuz?"}</h1><p>{started ? "Her adımda bir kararı netleştirin. Bilmediğiniz konuları uzmanla birlikte tamamlayabilirsiniz." : "İhtiyacınızı anlatın, seçeneklerinizi netleştirin ve proje özetinizi incelemeye gönderin."}</p></div><Link href="/musteri-proje-portali">Kayıtlı projelerim</Link></header>
    {!hydrated ? <p role="status">Proje taslağınız açılıyor…</p> : <>
    <div className="customer-guide-workspace"><aside><p>PROJE ADIMLARI</p><ol>{customerStepLabels.map((label, i) => <li key={label} className={started && step === i ? "is-current" : ""}><button type="button" aria-current={started && step === i ? "step" : undefined} disabled={!started} onClick={() => go(i)}><span>{progress.complete[i] ? "✓" : String(i + 1).padStart(2, "0")}</span><span>{label}<small>{progress.complete[i] ? "Bilgiler kaydedildi" : "Tamamlanacak"}</small></span></button></li>)}</ol><div className="customer-progress"><label htmlFor="customer-progress">{progress.count} / 6 hazırlık adımı</label><progress id="customer-progress" value={progress.count} max={6} /><small>Mühendislik onayı değildir.</small></div></aside>
    <div className="customer-guide-task"><span className="customer-guide-kicker">{started ? `${String(step + 1).padStart(2, "0")} / PROJE HAZIRLIĞI` : "01 / İHTİYAÇLARINIZ"}</span><h2 ref={heading} tabIndex={-1}>{started ? customerStepLabels[step] : "Teknik bilgiye ihtiyacınız yok."}</h2>
      {!started ? <><p>Projenizin adı, konumu ve yaklaşık alanıyla başlayın. Henüz karar vermediğiniz konuları açık bırakabilirsiniz.</p><Link className="customer-primary" href="/proje-baslat">Projemi oluşturmaya başla</Link></> : <>
      {step === 0 && <><dl className="customer-summary"><div><dt>Konum</dt><dd>{intake.location}</dd></div><div><dt>Alan hedefi</dt><dd>{Number(intake.targetArea).toLocaleString("tr-TR")} m² · {intake.floors} kat</dd></div></dl><Link className="customer-secondary" href="/proje-baslat?edit=1">Proje bilgilerimi düzenle</Link><button className="customer-primary" type="button" onClick={() => go(1)}>Arsa ve belgelere geç</button></>}
      {step === 1 && <><p>{["identified", "verified"].includes(intake.parcelStatus) ? "Parsel bilginiz mevcut. Belgelerinizi kontrol edin; resmî doğrulama uzman incelemesinde yapılacak." : "Arsanızın henüz olmaması engel değil. Bölge tercihinizle devam edebilir, arsa araştırması için destek isteyebilirsiniz."}</p><ul className="customer-document-list">{GUIDED_DOCUMENT_OPTIONS.map(doc => <li key={doc.id}><span>{intake.documents?.includes(doc.id) ? "Bende var" : "Henüz yok"}</span>{doc.label}</li>)}</ul><p className="customer-guide-note">Burada yalnız belge durumu kaydedilir. Dosyaları son adımda yüklersiniz; “bende var” resmî doğrulama anlamına gelmez.</p><Link className="customer-secondary" href="/proje-baslat?edit=1&step=1">Belge durumunu değiştir</Link><button type="button" className="customer-primary" onClick={() => confirm("land", 2)}>Bu bilgilerle devam et</button><p><Link href="/arsa-fizibilite-studyosu">İsteğe bağlı: parsel çalışma alanı</Link></p></>}
      {step === 2 && <SpaceEditor key={`${project.id}-spaces`} onComplete={() => go(3)} />}
      {step === 3 && <><p>Bir ön tercihiniz varsa seçin. Emin değilseniz kararı uzman incelemesine bırakın; bu seçim teknik uygunluk onayı değildir.</p><fieldset className="customer-system-options"><legend>Yapı sistemi ön tercihi</legend>{Object.entries(customerSystemLabels).map(([value, label]) => <label key={value}><input type="radio" name="customer-system" value={value} checked={(system || journey.systemDecision || intake.system || "undecided") === value} onChange={() => setSystem(value)} /><span>{label}</span></label>)}</fieldset><button type="button" className="customer-primary" onClick={() => confirm("system", 4, { systemDecision: system || journey.systemDecision || intake.system || "undecided" })}>Tercihimi kaydet ve devam et</button><p><Link href={intake.projectType === "demolition" ? "/yikim-karar-studyosu" : "/yapi-sistemi-karsilastirma#sistem-karsilastirma"}>{intake.projectType === "demolition" ? "Uzman için yıkım ön değerlendirme alanı" : "Sistem alternatiflerini ayrıntılı karşılaştır"}</Link></p><p className="customer-guide-note">Karşılaştırma aracındaki açıklık, yangın hedefi ve lojistik değerleri başlangıç varsayımlarıdır; uzman tarafından doğrulanmalıdır.</p></>}
      {step === 4 && <><p>Bütçe ve başlangıç tarihiniz birer hedef olarak kaydedilir; fiyat teklifi veya yapım taahhüdü değildir.</p><dl className="customer-summary"><div><dt>Yatırım bütçesi</dt><dd>{customerBudgetLabels[intake.budget]}</dd></div><div><dt>Hedef başlangıç</dt><dd>{customerTimelineLabels[intake.timeline]}</dd></div></dl><Link href="/proje-baslat?edit=1&step=3" className="customer-secondary">Bütçe ve takvimi değiştir</Link><button type="button" className="customer-primary" onClick={() => confirm("budget", 5)}>Özeti kontrol et</button></>}
      {step === 5 && <><p>Özetinizi kontrol edin. İletişim bilgilerinizi ve varsa dosyalarınızı ekleyerek ARKEM incelemesine gönderebilirsiniz.</p><pre className="customer-project-text">{progress.summary}</pre><button type="button" className="customer-secondary" onClick={() => downloadTextFile(`${project.id}-proje-ozeti.txt`, progress.summary, "text/plain;charset=utf-8")}>Proje özetini indir</button>{progress.complete.slice(0, 5).some(done => !done) && <p role="status">Bazı hazırlık adımları açık. Eksikleri tamamlayabilir veya bu bilgilerle uzman desteği isteyebilirsiniz.</p>}{progress.complete[5] ? <div className="customer-submitted" role="status"><h3>Başvurunuz kaydedildi.</h3><p>Kayıt numarası: <b>{journey.submission.reference}</b></p><details><summary>Gönderilen açıklamayı gör</summary><pre className="customer-project-text">{journey.submission.submittedMessage || progress.summary}</pre></details><p>Bu kayıt teknik onay anlamına gelmez. Yeni bilgilerle güncellediğiniz özet ayrı bir inceleme başvurusu oluşturur.</p><Link className="customer-secondary" href="/musteri-proje-portali">Kayıtlı projelerime git</Link><Link className="customer-secondary" href="/iletisim">Başvuru numaramla ARKEM’e ulaş</Link></div> : <ProjectBriefForm key={`${project.id}-${progress.summary}`} projectSummary={progress.summary} onProjectSubmitted={recordSubmission} />}</>}
      {step > 0 && <button type="button" className="customer-back" onClick={() => go(step - 1)}>Önceki adım</button>}
      </>}
      <p className="customer-guide-note">Bu çalışma bir ihtiyaç ve ön değerlendirme dosyasıdır. Ruhsat, statik hesap veya yetkili mühendis onayı yerine geçmez.</p>
    </div></div>{started && <CustomerAccountSave />}
    </>}
  </section>;
}
