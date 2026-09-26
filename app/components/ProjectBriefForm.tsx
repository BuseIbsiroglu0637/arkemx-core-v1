"use client";

import { ArrowUpRight } from "lucide-react";
import { FormEvent, useState } from "react";

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
  "Mimari proje hazır",
  "Statik proje gerekiyor",
  "Teklif / ihale aşaması",
  "Uygulama aşaması",
  "Mevcut proje revizyonu",
] as const;
const projectStagesEn = ["Concept stage", "Architectural design ready", "Structural design required", "Tender stage", "Construction stage", "Existing-project revision"] as const;

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

export function ProjectBriefForm({ locale = "tr" }: { locale?: "tr" | "en" }) {
  const english = locale === "en";
  const activeBuildingTypes = english ? buildingTypesEn : buildingTypes;
  const activeStages = english ? projectStagesEn : projectStages;
  const activeRequestTypes = english ? requestTypesEn : requestTypes;
  const [submitting, setSubmitting] = useState(false);
  const [fileSummary, setFileSummary] = useState(english ? "No file selected" : "Dosya seçilmedi");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const files = form.getAll("projectFiles").filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > 10) return setError(english ? "You can upload up to 10 project files." : "En fazla 10 proje dosyası yükleyebilirsiniz.");
    if (files.some((file) => file.size > 20_000_000)) return setError(english ? "Each file can be up to 20 MB." : "Her dosya en fazla 20 MB olabilir.");
    if (files.reduce((total, file) => total + file.size, 0) > 50_000_000) return setError(english ? "The total file size exceeds 50 MB." : "Dosyaların toplamı 50 MB sınırını aşıyor.");

    setSubmitting(true);
    setError("");
    setReference("");
    try {
      const response = await fetch("/api/project-intake", { method: "POST", body: form });
      const result = await response.json() as IntakeResponse;
      if (!response.ok || !result.ok || !result.referenceCode) throw new Error(result.error || (english ? "The record could not be completed." : "Kayıt tamamlanamadı."));
      setReference(result.referenceCode);
      formElement.reset();
      setFileSummary(english ? "No file selected" : "Dosya seçilmedi");
      window.dispatchEvent(new CustomEvent("arkem:track", { detail: { name: "project_brief_submit", context: result.referenceCode } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (english ? "The record could not be completed." : "Kayıt tamamlanamadı."));
    } finally {
      setSubmitting(false);
    }
  };

  return <form className="project-brief-form premium-brief-form" onSubmit={submit} encType="multipart/form-data">
    <div className="form-heading"><p className="eyebrow">{english ? "PROJECT PRE-ASSESSMENT" : "PROJE ÖN DEĞERLENDİRME"}</p><h2>{english ? <>Send the project data<br /><em>in one technical record.</em></> : <>Proje verisini<br /><em>tek kayıtta iletin.</em></>}</h2><p>{english ? "Your core project information and technical files are connected to the same pre-assessment reference." : "Temel bilgileriniz ve teknik dosyalarınız aynı başvuru numarasıyla ön değerlendirme kaydına alınır."}</p><div className="brief-outcomes"><span>01 <b>{english ? "One reference" : "Tek kayıt numarası"}</b></span><span>02 <b>{english ? "Technical file intake" : "Teknik dosya kabulü"}</b></span><span>03 <b>{english ? "Pre-assessment" : "Ön değerlendirme"}</b></span></div></div>
    <div className="form-grid">
      <fieldset className="form-wide project-intake-section">
        <legend><span>01</span>{english ? "CONTACT" : "İLETİŞİM"}</legend>
        <div className="project-intake-section-grid">
          <label><span>{english ? "Name" : "Ad Soyad"}</span><input name="name" autoComplete="name" required maxLength={120} placeholder={english ? "Full name" : "Ad soyad"} /></label>
          <label><span>{english ? "Company" : "Firma"}</span><input name="company" autoComplete="organization" maxLength={160} placeholder={english ? "Company (optional)" : "Firma adı (isteğe bağlı)"} /></label>
          <label><span>{english ? "Phone" : "Telefon"}</span><input name="phone" type="tel" autoComplete="tel" required maxLength={60} placeholder="+90 ..." /></label>
          <label><span>{english ? "Email" : "E-posta"}</span><input name="email" type="email" autoComplete="email" required maxLength={180} placeholder="name@company.com" /></label>
        </div>
      </fieldset>

      <fieldset className="form-wide project-intake-section">
        <legend><span>02</span>{english ? "PROJECT INFORMATION" : "PROJE BİLGİSİ"}</legend>
        <div className="project-intake-section-grid">
          <label><span>{english ? "Project Location" : "Proje Konumu"}</span><input name="location" required maxLength={160} placeholder={english ? "City / country" : "İl / ilçe"} /></label>
          <label><span>{english ? "Building Type" : "Yapı Türü"}</span><select name="buildingType" required defaultValue=""><option value="" disabled>{english ? "Select building type" : "Yapı türü seçin"}</option>{activeBuildingTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>{english ? "Approximate Area" : "Yaklaşık Alan"}</span><input name="area" inputMode="decimal" maxLength={80} placeholder={english ? "e.g. 3,500 m²" : "Örn. 3.500 m²"} /></label>
          <label><span>{english ? "Project Stage" : "Proje Aşaması"}</span><select name="stage" required defaultValue=""><option value="" disabled>{english ? "Select project stage" : "Aşama seçin"}</option>{activeStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <label className="form-wide"><span>{english ? "Request Type" : "Talep Türü"}</span><select name="requestType" required defaultValue=""><option value="" disabled>{english ? "Select technical need" : "Teknik ihtiyacı seçin"}</option>{activeRequestTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        </div>
      </fieldset>

      <fieldset className="form-wide project-intake-section">
        <legend><span>03</span>{english ? "FILES AND DESCRIPTION" : "DOSYA VE AÇIKLAMA"}</legend>
        <div className="project-intake-section-grid">
          <label className="form-wide"><span>{english ? "Short Description" : "Kısa Açıklama"}</span><textarea name="message" rows={5} required maxLength={4000} placeholder={english ? "Briefly describe the building programme, target use, programme and current technical stage." : "Yapı programı, hedef kullanım, takvim ve mevcut teknik durumu kısaca yazın."} /></label>
          <label className="form-wide v21-file-input"><span>{english ? "Upload Project Files" : "Proje Dosyalarını Yükle"}</span><input name="projectFiles" type="file" multiple accept=".pdf,.dwg,.dxf,.ifc,.xlsx,.jpg,.jpeg,.png,.zip" onChange={(event) => {
            const files = Array.from(event.target.files || []);
            setFileSummary(files.length ? `${files.length} ${english ? "files selected" : "dosya seçildi"} · ${files.map((file) => file.name).join(", ")}` : (english ? "No file selected" : "Dosya seçilmedi"));
            window.dispatchEvent(new CustomEvent("arkem:track", { detail: { name: "project_file_prepare", context: String(files.length) } }));
          }} /><small>{english ? "PDF, DWG, DXF, IFC, XLSX, JPG/PNG or ZIP · up to 10 files · 20 MB each · 50 MB total" : "PDF, DWG, DXF, IFC, XLSX, JPG/PNG veya ZIP · en fazla 10 dosya · dosya başına 20 MB · toplam 50 MB"}</small><i>{fileSummary}</i></label>
          <label className="v34-honeypot" aria-hidden="true"><span>Website</span><input name="website" tabIndex={-1} autoComplete="off" /></label>
          <label className="consent form-wide"><input name="consent" type="checkbox" value="accepted" required /><span>{english ? "I consent to this information being processed for project technical pre-assessment." : "Bu bilgilerin proje teknik ön değerlendirmesi amacıyla işlenmesini onaylıyorum."}</span></label>
        </div>
      </fieldset>

      <div className="form-wide form-actions"><button className="button copper" type="submit" disabled={submitting}>{submitting ? (english ? "CREATING RECORD…" : "KAYIT OLUŞTURULUYOR…") : (english ? "SUBMIT FOR TECHNICAL REVIEW" : "TEKNİK DEĞERLENDİRMEYE GÖNDER")} <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" /></button></div>
      {error && <p className="form-wide v21-form-error" role="alert">{error}</p>}
      {reference && <p className="form-wide form-success" role="status"><strong>{english ? "Your submission has been recorded." : "Başvurunuz kaydedildi."}</strong> {english ? "Technical review reference:" : "Teknik değerlendirme kayıt numaranız:"} <b>{reference}</b></p>}
    </div>
  </form>;
}
