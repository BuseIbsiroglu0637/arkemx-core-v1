"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ClipboardList, FileText, Layers3, MapPin, Check, Download, FolderPlus } from "lucide-react";
import { DIGITAL_BRIEF_SCHEMA, DIGITAL_RULES_VERSION, DIGITAL_DRAFT_SCHEMA, digitalGoals, digitalUsageLabels, digitalStageLabels, digitalPriorityLabels, digitalDocuments, digitalDocumentStateLabels, emptyDigitalBrief, digitalBriefErrors, digitalBriefResult, digitalBriefText, digitalBriefSignature, digitalBriefOpenState, parseDigitalBriefDraft, restoreDigitalBriefDraft, isDigitalBrief, createDigitalSubmission, restoreDigitalSubmission, type DigitalBrief, type DigitalSubmission } from "../lib/digital-brief";
import { customerRecord } from "../lib/customer-journey";
import { isKernelProject } from "../lib/project-validation";
import { useProjectKernel, type ProjectKernelState } from "./ProjectKernel";
import { useExportFeedback } from "./useExportFeedback";
import { CustomerAccountSave } from "./CustomerAccountSave";
import { ProjectBriefForm } from "./ProjectBriefForm";

const icons = [FolderPlus, MapPin, Layers3, ClipboardList];
const TEMP_DRAFT_KEY = "arkem-digital-tools-temporary-draft-v1";
export function DigitalToolsWorkspace({ initialGoal = "" }: { initialGoal?: DigitalBrief["goal"] }) {
  const { project, hydrated, patchModule } = useProjectKernel();
  const [brief, setBrief] = useState<DigitalBrief>(emptyDigitalBrief);
  const [step, setStep] = useState(0);
  const [loadedFor, setLoadedFor] = useState("");
  const [baseSignature, setBaseSignature] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [separateProject, setSeparateProject] = useState<ProjectKernelState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof DigitalBrief, string>>>({});
  const [generatedAt, setGeneratedAt] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [receipt, setReceipt] = useState<DigitalSubmission | null>(null);
  const [temporaryUnavailable, setTemporaryUnavailable] = useState(false);
  const activeProjectId = useRef(project.id);
  useLayoutEffect(() => { activeProjectId.current = project.id; }, [project.id]);
  const heading = useRef<HTMLHeadingElement>(null);
  const { runExport, exportState, exportMessage } = useExportFeedback();
  const stored = customerRecord(project.modules["digital-tools-brief"]);
  const storedSignature = isDigitalBrief(stored.input) ? digitalBriefSignature(stored.input) : "";
  const currentStoredSignature = useRef(storedSignature);
  useLayoutEffect(() => { currentStoredSignature.current = storedSignature; }, [storedSignature]);
  const draftConflict = loadedFor === project.id && mode === "existing" && storedSignature !== baseSignature;
  const hasActiveProject = Object.keys(project.modules).length > 0 || project.events.length > 0 || project.name !== "Yeni Yapı Yatırımı";
  const expectedReport = generatedAt && isDigitalBrief(brief) ? digitalBriefText(brief, generatedAt) : "";
  const matches = (data: Record<string, unknown>) => !!expectedReport && data.signature === digitalBriefSignature(brief) && data.rulesVersion === DIGITAL_RULES_VERSION && data.reportText === expectedReport;
  const separateMatches = !!separateProject && matches(customerRecord(separateProject.modules["digital-tools-brief"]));
  const attached = (mode === "existing" && matches(stored)) || separateMatches;
  useEffect(() => {
    if (!hydrated || loadedFor === project.id) return;
    const scheduled = window.setTimeout(() => {
    setReceipt(null); setSeparateProject(null); setShowForm(false); setNotice(""); setErrors({});
    const existing = customerRecord(project.modules["digital-tools-brief"]);
    setBaseSignature(isDigitalBrief(existing.input) ? digitalBriefSignature(existing.input) : "");
    const initialView = digitalBriefOpenState(existing);
    setStep(initialView.step); setGeneratedAt(initialView.generatedAt);
    if (isDigitalBrief(existing.input)) {
      setBrief(existing.input); setMode("existing");
      setGeneratedAt(typeof existing.generatedAt === "string" && Number.isFinite(Date.parse(existing.generatedAt)) ? existing.generatedAt : "");
      setReceipt(restoreDigitalSubmission(existing.submission, existing.input));
      if (existing.rulesVersion === DIGITAL_RULES_VERSION && typeof existing.generatedAt === "string" && Number.isFinite(Date.parse(existing.generatedAt))) setStep(2);
      else { setGeneratedAt(""); setStep(1); setNotice("Kaydın bilgileri açıldı. Güncel kurallarla yeni bir ön görüşme dosyası oluşturabilirsiniz; önceki çıktı proje kaydında korunur."); }
    } else {
      const intake = customerRecord(customerRecord(project.modules["decision-assistant"]).input);
      setBrief({ ...emptyDigitalBrief(), goal: initialGoal, ...(hasActiveProject ? { name: project.name, location: typeof intake.location === "string" ? intake.location : "", locationUnknown: !intake.location } : {}) });
      setMode(hasActiveProject ? "existing" : "new"); setGeneratedAt(""); setReceipt(null); setStep(initialGoal ? 1 : 0);
    }
    // Temporary same-tab continuity through sign-in; D1 remains the account record of truth.
    try {
      const draft = restoreDigitalBriefDraft(JSON.parse(window.sessionStorage.getItem(TEMP_DRAFT_KEY) || "null"), project.id, existing.input);
      if (draft) {
        setBrief(draft.brief); setMode(draft.mode === "existing" ? "existing" : "new");
        setGeneratedAt(draft.generatedAt); setStep(draft.step);
        setReceipt(isDigitalBrief(draft.brief) ? restoreDigitalSubmission(draft.receipt, draft.brief) : null);
        if (isKernelProject(draft.separateProject) && isDigitalBrief(customerRecord(draft.separateProject.modules["digital-tools-brief"]).input)) setSeparateProject(draft.separateProject as ProjectKernelState);
        setNotice("Bu sekmedeki son taslağınız açıldı. Hesaba kaydetme ve uzman incelemesine gönderme ayrı işlemlerdir.");
      }
    } catch { /* Input on this screen remains usable when temporary storage is disabled. */ }
    setLoadedFor(project.id);
    }, 0);
    return () => window.clearTimeout(scheduled);
  }, [hydrated, project.id, loadedFor, project.modules, project.name, hasActiveProject, initialGoal]);
  useEffect(() => {
    if (!hydrated || loadedFor !== project.id || draftConflict || !parseDigitalBriefDraft(brief)) return;
    const scheduled = window.setTimeout(() => {
    try { window.sessionStorage.setItem(TEMP_DRAFT_KEY, JSON.stringify({ draftSchema: DIGITAL_DRAFT_SCHEMA, projectId: project.id, rulesVersion: DIGITAL_RULES_VERSION, savedAt: new Date().toISOString(), baseSignature, brief, mode, step, generatedAt, separateProject, receipt })); setTemporaryUnavailable(false); }
    catch { setTemporaryUnavailable(true); }
    }, 0);
    return () => window.clearTimeout(scheduled);
  }, [brief, mode, step, generatedAt, separateProject, receipt, hydrated, loadedFor, project.id, baseSignature, draftConflict]);
  function go(next: number) { setStep(next); setNotice(""); window.requestAnimationFrame(() => heading.current?.focus()); }
  function update<K extends keyof DigitalBrief>(key: K, value: DigitalBrief[K]) { setBrief(b => ({ ...b, [key]: value })); setShowForm(false); setGeneratedAt(""); setReceipt(null); }
  function next() {
    const issues = digitalBriefErrors(brief);
    const relevant = step === 0 ? issues.goal ? { goal: issues.goal } : {} : issues;
    setErrors(relevant);
    if (Object.keys(relevant).length) { window.requestAnimationFrame(() => document.getElementById(`digital-${Object.keys(relevant)[0]}`)?.focus()); return; }
    if (step === 1) setGeneratedAt(new Date().toISOString());
    go(step + 1);
  }
  function attach() {
    if (!isDigitalBrief(brief) || !generatedAt || draftConflict) return;
    const previousReports = Array.isArray(stored.previousReports) ? stored.previousReports.slice(-3) : [];
    if (typeof stored.reportText === "string" && stored.reportText !== digitalBriefText(brief, generatedAt)) previousReports.push({ generatedAt: stored.generatedAt, rulesVersion: stored.rulesVersion, reportText: stored.reportText, signature: stored.signature });
    const data = { schema: DIGITAL_BRIEF_SCHEMA, rulesVersion: DIGITAL_RULES_VERSION, input: brief, signature: digitalBriefSignature(brief), reportText: digitalBriefText(brief, generatedAt), previousReports: mode === "existing" ? previousReports : [], generatedAt, method: "rule-based-user-declarations", needsReview: true, status: "Müşteri beyanı; uzman incelemesi bekleniyor", ...(receipt?.sourceSignature === digitalBriefSignature(brief) ? { submission: receipt } : {}) };
    if (mode === "existing" && hasActiveProject) { patchModule("digital-tools-brief", data); setBaseSignature(digitalBriefSignature(brief)); }
    else {
      const now = new Date().toISOString();
      const id = `ARK-BR-${crypto.randomUUID()}`;
      const candidate: ProjectKernelState = { schema: "ARKEM-PROJECT/1.0", id, name: brief.name.trim(), revision: "P01", phase: "Fikir", coordinateReference: "Belirlenmedi", updatedAt: now, experience: { mode: "guided", autoHandoff: false, lastSynchronizedAt: "" }, modules: { "digital-tools-brief": data }, events: [] };
      setSeparateProject(candidate); setNotice("Ayrı ihtiyaç dosyanız hesap kaydı için hazır. Açık projeniz değiştirilmedi; aşağıdan hesabınıza kaydedin."); return;
    }
    setNotice("Özet çalışma projenize eklendi. Başka cihazdan açmak için aşağıdan hesabınıza kaydedin.");
  }
  const result = step === 2 && isDigitalBrief(brief) && generatedAt ? digitalBriefResult(brief) : null;
  const summary = result ? digitalBriefText(brief, generatedAt) : "";
  const currentReceipt = receipt?.sourceSignature === digitalBriefSignature(brief) ? receipt : null;
  if (!hydrated || loadedFor !== project.id) return <section className="digital-workspace shell" aria-busy="true"><header className="digital-workspace-head"><div><p className="digital-kicker">ARKEM / DİJİTAL ARAÇLAR</p><h1>Proje ihtiyacınızı netleştirelim.</h1><p role="status">Çalışma kaydınız hazırlanıyor…</p></div></header></section>;
  return <section className="digital-workspace shell" aria-labelledby="digital-workspace-title">
    <header className="digital-workspace-head"><div><p className="digital-kicker">ARKEM / DİJİTAL ARAÇLAR</p><h1 id="digital-workspace-title">Proje ihtiyacınızı netleştirelim.</h1><p>Ne yapmak istediğinizi seçin. Kısa bilgilerle ön görüşme dosyanızı oluşturun; teknik bilgileri birlikte netleştirelim.</p></div><Link href="/musteri-proje-portali">Kayıtlı projelerim</Link></header>
    <ol className="digital-stepper" aria-label="Çalışma adımları">{["Hedefinizi seçin", "Bilgileri netleştirin", "Özet ve sonraki hizmet"].map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined}><span>{step > i ? <Check size={17} aria-hidden="true" /> : `0${i + 1}`}</span><b>{label}</b></li>)}</ol>
    {draftConflict && <div className="digital-draft-status" role="alert"><p>Açık proje kaydı değişti. Eski taslağınız yeni kaydın üzerine yazılmayacak. Önce bilgilerinizi koruyun, ardından güncel kaydı açın.</p><button type="button" className="digital-secondary" onClick={() => setLoadedFor("")}>Güncel proje kaydını aç</button></div>}
    {step < 2 && <p className="digital-draft-status" role="status">{temporaryUnavailable ? "Bu tarayıcı taslak saklayamıyor. Sayfadan ayrılmadan önce çalışma bilgilerinizi koruyun." : notice || "Yanıtlarınız bu sekmede geçici taslak olarak tutulur; hesabınıza kaydedilmiş veya incelemeye gönderilmiş değildir."}</p>}
    <div className="digital-task"><div className="digital-task-heading"><span className="digital-kicker">{`0${step + 1}`} / ÇALIŞMA ADIMI</span><h2 ref={heading} tabIndex={-1}>{step === 0 ? "Bugün ne yapmak istiyorsunuz?" : step === 1 ? "Bildiğiniz kadarıyla anlatın." : "Ön görüşme dosyanız hazır."}</h2><p>{step === 0 ? "Modül adı bilmeniz gerekmiyor. Size en yakın ihtiyacı seçin." : step === 1 ? "Alan veya kullanım henüz belli değilse açık bırakabilirsiniz. Varsayılan teknik değer üretmiyoruz." : "Yanıtlarınıza göre kurallı ön yönlendirme. Belgeler ve teknik uygunluk uzman tarafından henüz incelenmedi."}</p></div>
      {step === 0 && <><fieldset className="digital-goals" id="digital-goal" tabIndex={-1}><legend className="sr-only">Başlangıç hedefi</legend>{digitalGoals.map((goal, i) => { const Icon = icons[i]; return <label key={goal.id} className={brief.goal === goal.id ? "is-selected" : ""}><input type="radio" name="digital-goal" value={goal.id} checked={brief.goal === goal.id} onChange={() => update("goal", goal.id)} /><Icon size={24} strokeWidth={1.6} aria-hidden="true" /><strong>{goal.label}</strong><small>{goal.detail}</small><span>{brief.goal === goal.id ? "Seçildi" : "Bu hedefle başla"}</span></label>; })}</fieldset>{errors.goal && <p className="digital-error" role="alert">{errors.goal}</p>}<div className="digital-actions"><button className="digital-primary" type="button" onClick={next}>Bu hedefle devam et</button><span>Üyelik gerekmeden ön dosya oluşturabilirsiniz.</span></div></>}
      {step === 1 && <><div className="digital-form-grid">
        {hasActiveProject && <fieldset className="digital-mode"><legend>Bu çalışma hangi projeye ait?</legend><label><input type="radio" name="digital-project-mode" checked={mode === "existing"} onChange={() => { setMode("existing"); update("name", project.name); }} /> Açık projem: {project.name}</label><label><input type="radio" name="digital-project-mode" checked={mode === "new"} onChange={() => { setMode("new"); update("name", ""); }} /> Ayrı bir ihtiyaç dosyası oluşturacağım</label><small>Özet oluşturmak veya göndermek açık projenizin üzerine yazmaz.</small></fieldset>}
        <label>Çalışma adı<input id="digital-name" value={brief.name} disabled={mode === "existing" && hasActiveProject} maxLength={100} aria-invalid={!!errors.name} aria-describedby={errors.name ? "digital-name-error" : undefined} placeholder="Örn. Sakarya depo yatırımı" onChange={e => update("name", e.target.value)} />{errors.name && <small id="digital-name-error" className="digital-error">{errors.name}</small>}</label>
        <label>Kullanım amacı<select value={brief.usage} onChange={e => update("usage", e.target.value as DigitalBrief["usage"])}>{Object.entries(digitalUsageLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <div><label>İl / ilçe<input id="digital-location" value={brief.location} disabled={brief.locationUnknown} maxLength={160} aria-invalid={!!errors.location} aria-describedby={errors.location ? "digital-location-error" : undefined} placeholder="Örn. Sakarya / Serdivan" onChange={e => update("location", e.target.value)} /></label><label className="digital-checkbox"><input type="checkbox" checked={brief.locationUnknown} onChange={e => update("locationUnknown", e.target.checked)} /> Konum henüz belli değil</label>{errors.location && <small id="digital-location-error" className="digital-error">{errors.location}</small>}</div>
        <label>Yaklaşık toplam yapı alanı (m²)<input id="digital-area" inputMode="decimal" value={brief.area} maxLength={12} aria-invalid={!!errors.area} aria-describedby="digital-area-help" placeholder="Bilmiyorsanız boş bırakın" onChange={e => update("area", e.target.value)} /><small id="digital-area-help" className={errors.area ? "digital-error" : ""}>{errors.area || "Tüm katların yaklaşık toplamı. Binlik ayırıcı kullanmayın; örnek: 1200,5."}</small></label>
        <label>Projenin bugünkü aşaması<select value={brief.stage} onChange={e => update("stage", e.target.value as DigitalBrief["stage"])}>{Object.entries(digitalStageLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Öncelikle neyi netleştirelim?<select value={brief.priority} onChange={e => update("priority", e.target.value as DigitalBrief["priority"])}>{Object.entries(digitalPriorityLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <fieldset className="digital-documents"><legend>Elinizdeki belgeler</legend><p>Burada yalnız durum beyanı alınır. Dosyaları inceleme talebinde ayrıca ekleyebilirsiniz.</p>{digitalDocuments.map(d => <label key={d.id}>{d.label}<select value={brief.documents[d.id]} onChange={e => update("documents", { ...brief.documents, [d.id]: e.target.value as DigitalBrief["documents"]["parcel"] })}>{Object.entries(digitalDocumentStateLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>)}</fieldset>
        <label className="digital-wide">Eklemek istediğiniz ihtiyaçlar<textarea id="digital-notes" rows={3} maxLength={2000} value={brief.notes} placeholder="Örn. üretim hattı, araç girişi, mevcut proje sorunu…" onChange={e => update("notes", e.target.value)} /><small>{brief.notes.length} / 2000 karakter · isteğe bağlı</small></label>
      </div><div className="digital-actions"><button className="digital-primary" type="button" onClick={next}>Ön görüşme dosyamı oluştur</button><button className="digital-secondary" type="button" onClick={() => go(0)}>Hedefi değiştir</button></div></>}
      {result && <><div className="digital-result-lead"><FileText size={28} aria-hidden="true" /><div><h3>{brief.name}</h3><p>{result.goal.label}</p><small>Müşteri beyanı · {new Date(generatedAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}</small></div></div>
        <nav className="digital-actions digital-result-shortcuts" aria-label="Sonuç için hızlı işlemler"><a className="digital-secondary" href="#digital-retain">Bu dosyayı kaydet</a>{!currentReceipt && <button type="button" className="digital-primary" disabled={draftConflict} onClick={() => { setShowForm(true); setNotice("İletişim alanında bilgilerinizi ve belgelerinizi ekleyip başvurunuzu gönderebilirsiniz."); window.setTimeout(() => document.getElementById("digital-send")?.scrollIntoView({ block: "start", behavior: "instant" }), 0); }}>Uzman değerlendirmesi iste</button>}<button type="button" className="digital-secondary" onClick={() => go(1)}>Bilgilerimi düzenle</button></nav><div className="digital-result-grid"><section><h3>Mevcut bilgileriniz</h3><dl><div><dt>Konum</dt><dd>{brief.locationUnknown ? "Henüz belli değil" : brief.location}</dd></div><div><dt>Kullanım</dt><dd>{digitalUsageLabels[brief.usage]}</dd></div><div><dt>Yaklaşık toplam yapı alanı · müşteri beyanı</dt><dd>{result.area === null ? "Uzmanla belirlenecek" : `${result.area.toLocaleString("tr-TR")} m²`}</dd></div><div><dt>Öncelik</dt><dd>{digitalPriorityLabels[brief.priority]}</dd></div></dl></section><section><h3>Netleştireceğimiz konular</h3>{result.unknowns.length > 0 && <p>{result.unknowns.join(", ")}</p>}<ul>{result.missing.map(d => <li key={d.id}><b>{d.label}</b><small>{digitalDocumentStateLabels[d.state]} · {d.action}</small></li>)}<li><b>Belge içerikleri ve teknik koşullar</b><small>{result.review.length ? `${result.review.length} belge türü mevcut beyan edildi; içerik ve kaynak incelemesi bekliyor.` : "Henüz belge içeriği incelenmedi."}</small></li></ul></section></div>
        <section className="digital-service-plan"><h3>Önerilen hizmet yolu</h3><p>{result.goal.service}. Bu öneri hizmet kabulü veya kesin teslim taahhüdü değildir.</p><ol>{result.services.map((s, i) => <li key={s.title}><span>0{i + 1}</span><div><h4>{s.title}</h4><p>{s.output}</p><small>Ön koşul: {s.prerequisite}</small><small>İlgililer: {s.owner} · kapsam teyidi bekliyor</small></div></li>)}</ol><ul className="digital-review-flags">{result.flags.map(flag => <li key={flag}>{flag}</li>)}</ul></section>
        <div className="digital-actions"><button className="digital-primary" type="button" onClick={() => setShowForm(true)} disabled={!!currentReceipt}>Bu özetle uzman incelemesi iste</button><button className="digital-secondary" type="button" disabled={exportState === "busy"} onClick={() => void runExport(async () => { const { downloadDigitalBriefPdf } = await import("../lib/digital-brief-pdf"); await downloadDigitalBriefPdf(brief, generatedAt); })}><Download size={17} aria-hidden="true" />{exportState === "busy" ? "PDF hazırlanıyor…" : "PDF dosyamı indir"}</button><button className="digital-quiet" type="button" onClick={() => go(1)}>Bilgileri düzenle</button></div><p role="status" className="digital-export-status">{exportMessage}</p>
        {currentReceipt && <div className="digital-receipt" role="status"><h3>{currentReceipt.restored ? "Taslağınızdaki başvuru kaydı" : "Başvurunuz kaydedildi."}</h3><p>Kayıt numarası: <b>{currentReceipt.reference}</b>. {currentReceipt.restored ? "Bu numara taslakta saklandı; güncel inceleme durumu çevrim içi doğrulanmadı." : "İnceleme sonucu henüz oluşmadı."} Bu numara teklif, sözleşme, iş kabulü, randevu, teknik onay veya süre / teslim taahhüdü değildir. Kapsam ve takvim ayrıca teyit edilir.</p>{currentReceipt.submittedMessage && <details><summary>Gönderilen başvuru içeriğini gör</summary><p>Aşağıdaki bilgiler gönderim formunda düzenlediğiniz gerçek başvuru kopyasıdır; ilk ön görüşme dosyanızdan farklı olabilir.</p><dl>{Object.entries(currentReceipt.submittedFields).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{({ location: "Konum", buildingType: "Yapı türü", area: "Alan", stage: "Aşama", requestType: "Talep" })[key as "location"] || key}</dt><dd>{value}</dd></div>)}</dl><pre className="digital-submitted-message">{currentReceipt.submittedMessage}</pre></details>}<p>Sonraki adım: ihtiyaç dosyanızı projeye ekleyip hesabınıza kaydedin.</p><a href="#digital-retain">Kaydetme alanına git →</a></div>}
        {showForm && !currentReceipt && !draftConflict && <section className="digital-submit" id="digital-send"><h3>İletişim bilgilerinizi ekleyin</h3><p>Özetiniz aşağıya aktarıldı. İsterseniz düzenleyin ve belge dosyalarını ekleyin. Gönderimden sonra başvuru numarası görüntülenir.</p><ProjectBriefForm key={summary} projectSummary={summary} prefill={{ location: brief.locationUnknown ? "Konum uzmanla belirlenecek" : brief.location, buildingType: ({ residential: "Konut", industrial: "Endüstriyel yapı", commercial: "Ticari yapı", agricultural: "Tarımsal yapı", mixed: "Diğer", unknown: "Diğer" })[brief.usage], area: result.area === null ? "Uzmanla belirlenecek" : `${result.area} m²`, stage: ({ idea: "Fikir aşaması", land: "Fikir aşaması", design: "Proje / tasarım aşaması", tender: "Teklif / ihale aşaması", construction: "Uygulama aşaması", existing: "Mevcut proje revizyonu" })[brief.stage], requestType: "Teknik danışmanlık" }} onProjectSubmitted={(reference, submittedMessage, submittedFields) => { if (activeProjectId.current !== project.id) return; const submitted = createDigitalSubmission(brief, reference, submittedMessage, submittedFields); setReceipt(submitted); if (separateMatches) setSeparateProject(p => p ? { ...p, updatedAt: new Date().toISOString(), modules: { ...p.modules, "digital-tools-brief": { ...customerRecord(p.modules["digital-tools-brief"]), submission: submitted } } } : p); else if (attached && mode === "existing" && currentStoredSignature.current === digitalBriefSignature(brief)) patchModule("digital-tools-brief", { submission: submitted }); setShowForm(false); }} /></section>}
        <section className="digital-retain" id="digital-retain"><h3>Bu çalışmaya daha sonra devam edin</h3><p>PDF indirme, hesap kaydı ve inceleme başvurusu ayrı işlemlerdir. {mode === "existing" && hasActiveProject ? `Özet ${project.name} projenize eklenir.` : "Ayrı ihtiyaç dosyası hesaba kaydedilebilir; açık projeniz değiştirilmez."}</p><button className="digital-secondary" type="button" disabled={!hydrated || attached} onClick={attach}>{attached ? separateMatches ? "Ayrı dosya hesap kaydı için hazır" : "Cihazdaki çalışma projesine eklendi" : mode === "existing" && hasActiveProject ? "Özeti açık projeme ekle" : "İhtiyaç dosyasını kayda hazırla"}</button>{notice && <p role="status">{notice}</p>}{attached && <CustomerAccountSave projectOverride={separateMatches ? separateProject! : undefined} returnTo="/dijital-donusum" />}<Link href={mode === "new" ? "/musteri-proje-portali" : result.goal.tool}>{mode === "new" ? "Kayıtlı dosyamı portalda aç" : result.goal.toolLabel}</Link><p className="digital-review-note">Ayrıntılı araçlarda girilen veriler ayrıca kontrol edilir; bu özet teknik hesap alanlarını otomatik doldurmaz. Hesaba kaydedilmeyen ayrı dosya bu ekranda geçicidir; sayfadan ayrılmadan PDF indirin veya hesap kaydını tamamlayın.</p>{temporaryUnavailable && <p role="status">Bu tarayıcı geçici taslak saklayamıyor. Giriş sayfasına geçmeden önce PDF indirin; hesap kaydı yapılana kadar bilgiler yalnız bu ekranda açıktır.</p>}</section>
      </>}
    </div><p className="digital-policy">Bu çalışma teknik veya resmî uygunluk kararı vermez. Mühendislik hesapları, ruhsat koşulları, saha güvenliği ve nihai teslimler yetkili uzman incelemesi gerektirir.</p>
  </section>;
}
