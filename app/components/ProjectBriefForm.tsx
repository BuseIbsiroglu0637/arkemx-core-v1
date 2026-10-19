"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useProjectKernel } from "./ProjectKernel";
import { customerRecord } from "../lib/customer-journey";
import { MAX_INTAKE_FILE_BYTES, MAX_INTAKE_TOTAL_BYTES } from "../lib/project-intake-contract";
import { INTAKE_ATTEMPT_KEY, intakePayloadDigest, resolveIntakeAttempt, type IntakeAttempt } from "../lib/intake-attempt";

const buildingTypes = [
  "Endüstriyel yapı",
  "Ticari yapı",
  "Tarımsal yapı",
  "Konut",
  "Mevcut yapı",
  "Diğer",
] as const;
const buildingTypesEn = ["Industrial building", "Commercial building", "Agricultural building", "Residential", "Existing building", "Other"] as const;

const projectStages = [
  "Fikir aşaması",
  "Proje / tasarım aşaması",
  "Mimari proje hazır",
  "Statik proje gerekiyor",
  "Teklif / ihale aşaması",
  "Uygulama aşaması",
  "Mevcut proje revizyonu",
] as const;
const projectStagesEn = ["Concept stage", "Project / design stage", "Architectural design ready", "Structural design required", "Tender stage", "Construction stage", "Existing-project revision"] as const;

const requestTypes = [
  "Statik proje ve yapısal tasarım",
  "Betonarme prefabrik sistem",
  "Yapısal çelik sistem",
  "Hafif çelik sistem",
  "Hibrit sistem",
  "Uygulama / saha mühendisliği",
  "Teknik danışmanlık",
] as const;
const requestTypesEn = ["Structural design and analysis", "Precast concrete system", "Structural steel system", "Light-gauge steel system", "Hybrid system", "Site engineering", "Technical consultancy"] as const;

type IntakeResponse = { ok?: boolean; referenceCode?: string; error?: string };

type BriefPrefill = { location?: string; buildingType?: string; area?: string; stage?: string; requestType?: string };
export function ProjectBriefForm({ locale = "tr", projectSummary, prefill, onProjectSubmitted, allowFiles = true, compact = false }: { locale?: "tr" | "en"; projectSummary?: string; prefill?: BriefPrefill; allowFiles?: boolean; compact?: boolean; onProjectSubmitted?: (reference: string, submittedMessage: string, submittedFields: Record<string, string>) => void }) {
  const { project } = useProjectKernel();
  const intake = customerRecord(customerRecord(project.modules["decision-assistant"]).input);
  const english = locale === "en";
  const activeBuildingTypes = english ? buildingTypesEn : buildingTypes;
  const activeStages = english ? projectStagesEn : projectStages;
  const activeRequestTypes = english ? requestTypesEn : requestTypes;
  const [submitting, setSubmitting] = useState(false);
  const [fileSummary, setFileSummary] = useState(english ? "No file selected" : "Dosya seçilmedi");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const busy = useRef(false);
  const requestAttempt = useRef<IntakeAttempt | null>(null);
  const currentProject = useRef(project.id);
  const mounted = useRef(true);
  useLayoutEffect(() => { currentProject.current = project.id; }, [project.id]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    const formElement = event.currentTarget;
    const submittedProject = project.id;
    const form = new FormData(formElement);
    if (String(form.get("message") || "").length > 20000) return setError("Açıklama 20.000 karakteri aşıyor. Metni kısaltın veya ayrıntıları proje dosyası olarak ekleyin.");
    const files = form.getAll("projectFiles").filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > 10) return setError(english ? "You can upload up to 10 project files." : "En fazla 10 proje dosyası yükleyebilirsiniz.");
    if (files.some((file) => file.size > MAX_INTAKE_FILE_BYTES)) return setError(english ? "Each file can be up to 6 MB." : "Her dosya en fazla 6 MB olabilir.");
    if (files.reduce((total, file) => total + file.size, 0) > MAX_INTAKE_TOTAL_BYTES) return setError(english ? "The total file size exceeds 10 MB." : "Dosyaların toplamı 10 MB sınırını aşıyor.");

    busy.current = true;
    setSubmitting(true);
    setError("");
    setReference("");
    try {
      let previous: unknown = requestAttempt.current;
      try { previous ||= JSON.parse(sessionStorage.getItem(INTAKE_ATTEMPT_KEY) || "null"); } catch { /* Memory-only retries still work if storage is unavailable. */ }
      requestAttempt.current = resolveIntakeAttempt(previous, await intakePayloadDigest(form));
      try { sessionStorage.setItem(INTAKE_ATTEMPT_KEY, JSON.stringify(requestAttempt.current)); } catch { /* Do not block a submission on browser storage. */ }
      form.set("requestKey", requestAttempt.current.key);
      const submittedAttempt = requestAttempt.current;
      const response = await fetch("/api/project-intake", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
      let result: IntakeResponse;
      try { result = await response.json() as IntakeResponse; } catch { throw new Error(english ? "The server response could not be confirmed. Retry with the same information." : "Sunucu yanıtı doğrulanamadı. Bilgileri değiştirmeden yeniden deneyebilirsiniz."); }
      if (!response.ok || !result.ok || !result.referenceCode) throw new Error(result.error || (english ? "The record could not be completed." : "Kayıt tamamlanamadı."));
      setReference(result.referenceCode);
      if (mounted.current && currentProject.current === submittedProject) onProjectSubmitted?.(result.referenceCode, String(form.get("message") || "").trim(), Object.fromEntries(["location", "buildingType", "area", "stage", "requestType"].map(key => [key, String(form.get(key) || "").trim()])));
      requestAttempt.current = null;
      try { if (JSON.parse(sessionStorage.getItem(INTAKE_ATTEMPT_KEY) || "null")?.key === submittedAttempt.key) sessionStorage.removeItem(INTAKE_ATTEMPT_KEY); } catch { /* Never remove another form's newer retry identity. */ }
      formElement.reset();
      setFileSummary(english ? "No file selected" : "Dosya seçilmedi");
      window.dispatchEvent(new CustomEvent("arkem:track", { detail: { name: "project_brief_submit", context: result.referenceCode } }));
    } catch (cause) {
      const transportFailure = cause instanceof TypeError || (cause instanceof Error && ["TimeoutError", "AbortError"].includes(cause.name));
      setError(transportFailure ? (english ? "The connection was interrupted or timed out. Your information remains here; retry without changing it to check the same submission." : "Bağlantı kesildi veya bekleme süresi doldu. Bilgileriniz bu formda duruyor; değiştirmeden yeniden deneyerek aynı başvuruyu kontrol edebilirsiniz.") : cause instanceof Error ? cause.message : (english ? "The record could not be completed." : "Kayıt tamamlanamadı."));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return <form className="project-brief-form premium-brief-form" data-compact={compact} onSubmit={submit} encType="multipart/form-data" aria-busy={submitting}>
    {compact ? <div className="form-heading"><p className="eyebrow">{english ? "PARCEL REVIEW REQUEST" : "PARSEL İNCELEME TALEBİ"}</p><h2>{english ? "Create a review record" : "İnceleme kaydı oluşturun"}</h2><p>{english ? "Share your contact details and request. A record number is not an approval or a purchase." : "İletişim bilgilerinizi ve talebinizi iletin. Kayıt numarası onay, belge doğrulaması veya hizmet satın alımı değildir."}</p></div> : <div className="form-heading"><p className="eyebrow">{english ? "PROJECT PRE-ASSESSMENT" : "PROJE ÖN DEĞERLENDİRME"}</p><h2>{english ? <>Send the project data<br /><em>in one technical record.</em></> : <>Proje verisini<br /><em>tek kayıtta iletin.</em></>}</h2><p>{english ? "Your core project information and technical files are connected to the same pre-assessment reference." : "Temel bilgileriniz ve teknik dosyalarınız aynı başvuru numarasıyla ön değerlendirme kaydına alınır."}</p><div className="brief-outcomes"><span>01 <b>{english ? "One reference" : "Tek kayıt numarası"}</b></span><span>02 <b>{english ? "Technical file intake" : "Teknik dosya kabulü"}</b></span><span>03 <b>{english ? "Pre-assessment" : "Ön değerlendirme"}</b></span></div></div>}
    <div className="form-grid">
      <fieldset className="form-wide project-intake-section" disabled={submitting}>
        <legend><span>01</span>{english ? "CONTACT" : "İLETİŞİM"}</legend>
        <div className="project-intake-section-grid">
          <label><span>{english ? "Name" : "Ad Soyad"}</span><input name="name" autoComplete="name" required maxLength={120} placeholder={english ? "Full name" : "Ad soyad"} /></label>
          <label><span>{english ? "Company" : "Firma"}</span><input name="company" autoComplete="organization" maxLength={160} placeholder={english ? "Company (optional)" : "Firma adı (isteğe bağlı)"} /></label>
          <label><span>{english ? "Phone" : "Telefon"}</span><input name="phone" type="tel" autoComplete="tel" required maxLength={60} placeholder="+90 ..." /></label>
          <label><span>{english ? "Email" : "E-posta"}</span><input name="email" type="email" autoComplete="email" required maxLength={180} placeholder="name@company.com" /></label>
        </div>
      </fieldset>

      <fieldset className="form-wide project-intake-section" disabled={submitting}>
        <legend><span>02</span>{english ? "PROJECT INFORMATION" : "PROJE BİLGİSİ"}</legend>
        <div className="project-intake-section-grid">
          <label><span>{english ? "Project Location" : "Proje Konumu"}</span><input name="location" defaultValue={prefill?.location ?? (projectSummary ? intake.location : undefined)} required maxLength={160} placeholder={english ? "City / country" : "İl / ilçe"} /></label>
          {compact ? <><input type="hidden" name="buildingType" value={prefill?.buildingType ?? (english ? "Other" : "Diğer")} /><input type="hidden" name="stage" value={prefill?.stage ?? (english ? "Concept stage" : "Fikir aşaması")} /><input type="hidden" name="requestType" value={prefill?.requestType ?? (english ? "Technical consultancy" : "Teknik danışmanlık")} /></> : <>
          <label><span>{english ? "Building Type" : "Yapı Türü"}</span><select name="buildingType" required defaultValue={prefill?.buildingType ?? (projectSummary && !english ? ({ residential: "Konut", industrial: "Endüstriyel yapı", commercial: "Ticari yapı", agricultural: "Tarımsal yapı", mixed: "Diğer" } as Record<string,string>)[intake.usage] || "" : "")}><option value="" disabled>{english ? "Select building type" : "Yapı türü seçin"}</option>{activeBuildingTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>{english ? "Approximate Area" : "Yaklaşık Alan"}</span><input name="area" defaultValue={prefill?.area ?? (projectSummary && Number.isFinite(Number(intake.targetArea)) && Number(intake.targetArea) > 0 ? `${intake.targetArea} m²` : undefined)} inputMode="decimal" maxLength={80} placeholder={english ? "e.g. 3,500 m² (optional)" : "Biliniyorsa yazın (isteğe bağlı)"} /></label>
          <label><span>{english ? "Project Stage" : "Proje Aşaması"}</span><select name="stage" required defaultValue={prefill?.stage ?? ""}><option value="" disabled>{english ? "Select project stage" : "Aşama seçin"}</option>{activeStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <label className="form-wide"><span>{english ? "Request Type" : "Talep Türü"}</span><select name="requestType" required defaultValue={prefill?.requestType ?? ""}><option value="" disabled>{english ? "Select technical need" : "Teknik ihtiyacı seçin"}</option>{activeRequestTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          </>}
        </div>
      </fieldset>

      <fieldset className="form-wide project-intake-section" disabled={submitting}>
        <legend><span>03</span>{english ? "FILES AND DESCRIPTION" : "DOSYA VE AÇIKLAMA"}</legend>
        <div className="project-intake-section-grid">
          <label className="form-wide"><span>{english ? "Short Description" : "Kısa Açıklama"}</span><textarea name="message" defaultValue={projectSummary} rows={compact ? 5 : projectSummary ? 12 : 5} required maxLength={20000} placeholder={compact ? (english ? "Describe the parcel and the review you need." : "Parseli ve inceleme talebinizi kısaca açıklayın.") : english ? "Briefly describe the building programme, target use, programme and current technical stage." : "Yapı programı, hedef kullanım, takvim ve mevcut teknik durumu kısaca yazın."} /></label>
          {allowFiles && <label className="form-wide v21-file-input"><span>{english ? "Upload Project Files" : "Proje Dosyalarını Yükle"}</span><input name="projectFiles" type="file" multiple accept=".pdf,.dwg,.dxf,.ifc,.xlsx,.jpg,.jpeg,.png,.zip" onChange={(event) => {
            const files = Array.from(event.target.files || []);
            setFileSummary(files.length ? `${files.length} ${english ? "files selected" : "dosya seçildi"} · ${files.map((file) => file.name).join(", ")}` : (english ? "No file selected" : "Dosya seçilmedi"));
            window.dispatchEvent(new CustomEvent("arkem:track", { detail: { name: "project_file_prepare", context: String(files.length) } }));
          }} /><small>{english ? "PDF, DWG, DXF, IFC, XLSX, JPG/PNG or ZIP · up to 10 files · 6 MB each · 10 MB total. Contact ARKEM for larger drawing sets." : "PDF, DWG, DXF, IFC, XLSX, JPG/PNG veya ZIP · en fazla 10 dosya · dosya başına 6 MB · toplam 10 MB. Daha büyük pafta setleri için ARKEM ile ayrı dosya aktarımını görüşün."}</small><i>{fileSummary}</i></label>}
          <label className="v34-honeypot" aria-hidden="true"><span>Website</span><input name="website" tabIndex={-1} autoComplete="off" /></label>
          <p className="form-wide form-data-note">{english ? "Your contact details, project information and uploaded files are recorded for pre-assessment. A submission reference is not a quote, appointment confirmation, technical approval or acceptance of work. Contact ARKEM for information about retention and data requests." : "İletişim bilgileriniz, proje bilgileriniz ve eklediğiniz dosyalar ön değerlendirme kaydına alınır. Başvuru numarası teklif, randevu teyidi, teknik onay veya iş kabulü değildir. Saklama koşulları ile erişim / düzeltme / silme taleplerinizi başvuru numaranızla İletişim sayfasından ARKEM’e iletebilirsiniz."}</p>
          <label className="consent form-wide"><input name="consent" type="checkbox" value="accepted" required /><span>{english ? "I consent to this information being processed for project technical pre-assessment." : "Bu bilgilerin proje teknik ön değerlendirmesi amacıyla işlenmesini onaylıyorum."}</span></label>
        </div>
      </fieldset>

      <div className="form-wide form-actions"><button className="button copper" type="submit" disabled={submitting}>{submitting ? (english ? "CREATING RECORD…" : "KAYIT OLUŞTURULUYOR…") : (english ? "SUBMIT FOR TECHNICAL REVIEW" : "TEKNİK DEĞERLENDİRMEYE GÖNDER")} <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" /></button></div>
      {error && <p className="form-wide v21-form-error" role="alert">{error}</p>}
      {reference && <p className="form-wide form-success" role="status"><strong>{english ? "Your submission has been recorded." : "Başvurunuz kaydedildi."}</strong> {english ? "Technical review reference:" : "Teknik değerlendirme kayıt numaranız:"} <b>{reference}</b><br/><Link href={english ? "/en/iletisim" : "/iletisim"}>{english ? "Follow up with this reference" : "Bu numarayla ARKEM’e ulaşın"} →</Link></p>}
    </div>
  </form>;
}
