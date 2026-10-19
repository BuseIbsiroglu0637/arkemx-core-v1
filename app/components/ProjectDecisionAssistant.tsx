"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { site } from "../data/site";
import { downloadTextFile } from "../lib/engineering";
import { DEMO_ENABLED } from "../lib/demo";
import { positiveArea } from "../lib/readiness-input";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

const goals = [
  ["konut", "Konut / villa"],
  ["sanayi", "Sanayi tesisi / fabrika / depo"],
  ["ticari", "Ticari veya sosyal yapı"],
  ["tarimsal", "Tarımsal yapı"],
  ["mevcut", "Mevcut yapı incelemesi"],
  ["yikim", "Kontrollü veya patlatmalı yıkım"],
] as const;

const stages = [
  ["fikir", "Fikir veya arsa aşaması"],
  ["on-proje", "Ön proje / mimari çalışma mevcut"],
  ["ruhsat", "Ruhsat veya uygulama projesi mevcut"],
  ["teklif", "Teklif toplama / firma seçimi"],
  ["santiye", "Üretim veya şantiye aşaması"],
  ["mevcut", "Mevcut yapı / dönüşüm aşaması"],
] as const;

const systems = [
  ["kararsiz", "Henüz karar verilmedi"],
  ["hafif-celik", "Hafif çelik"],
  ["celik", "Çelik"],
  ["prefabrik", "Betonarme prefabrik"],
  ["betonarme", "Betonarme"],
  ["karma", "Karma sistem"],
] as const;

const documentOptions = [
  ["arsa", "Arsa / imar bilgileri"],
  ["mimari", "Mimari plan veya eskiz"],
  ["zemin", "Zemin etüdü"],
  ["statik", "Statik proje veya hesap"],
  ["gorsel", "Fotoğraf / video / mevcut durum kaydı"],
] as const;

const priorityOptions = [
  ["sure", "Hızlı teslim"],
  ["butce", "Bütçe kontrolü"],
  ["esneklik", "Mimari esneklik"],
  ["enerji", "Enerji performansı"],
  ["guvenlik", "Teknik risk ve güvenlik"],
] as const;

const labelOf = (options: readonly (readonly [string, string])[], value: string) => options.find(([key]) => key === value)?.[1] || "Belirtilmedi";

export function ProjectDecisionAssistant() {
  const { patchModule } = useProjectKernel();
  const [goal, setGoal] = useState("");
  const [stage, setStage] = useState("");
  const [system, setSystem] = useState("kararsiz");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [documents, setDocuments] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [resultVisible, setResultVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const areaValid = positiveArea(area) !== null;
  const areaError = !!area.trim() && !areaValid;

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  const result = useMemo(() => {
    const isDemolition = goal === "yikim";
    const service = isDemolition
      ? { title: "Patlatmalı Bina Yıkımı", href: "/hizmetler/patlatmali-bina-yikimi" }
      : stage === "santiye"
        ? { title: "Yapım ve Teknik Kontrol", href: "/hizmetler/yapim" }
        : stage === "teklif" || goal === "mevcut" || stage === "mevcut"
          ? { title: "Teknik Danışmanlık", href: "/hizmetler/danismanlik" }
          : { title: "Projelendirme", href: "/hizmetler/projelendirme" };

    const score = Math.min(100,
      (goal ? 18 : 0) +
      (stage ? 16 : 0) +
      (location.trim() ? 12 : 0) +
      (areaValid ? 10 : 0) +
      (system && system !== "kararsiz" ? 8 : 0) +
      Math.min(24, documents.length * 6) +
      Math.min(12, priorities.length * 4),
    );

    const nextSteps = [
      !location.trim() ? "Yapının il ve ilçe bilgisini netleştirin." : "Konuma bağlı imar, iklim, deprem ve saha verilerini doğrulayın.",
      !areaValid ? "Yaklaşık kapalı alanı pozitif bir m² değeriyle tanımlayın." : "Yaklaşık alanı kat ve kullanım bazında kontrol edin.",
      system === "kararsiz" ? "Uygun taşıyıcı sistemleri süre, maliyet ve performans açısından karşılaştırın." : `${labelOf(systems, system)} seçeneğini proje girdileri üzerinden doğrulayın.`,
      documents.length < 2 ? "Mevcut pafta, arsa belgesi, zemin verisi ve görselleri tek dosyada toplayın." : "Mevcut belgelerdeki eksik ve güncel olmayan verileri işaretleyin.",
      isDemolition ? "Yıkım yöntemi kararı öncesinde yapı, çevre ve resmî izin koşulları için uzman ön incelemesi yaptırın." : "İlk teknik görüşmede kapsam, teslimler ve sorumlulukları yazılı hale getirin.",
    ];

    const uncheckedDocuments = documentOptions.filter(([value]) => !documents.includes(value)).map(([, label]) => label);

    const maturity = [
      { discipline: "Arsa / imar", score: (location.trim() ? 45 : 0) + (documents.includes("arsa") ? 45 : 0) + (stage ? 10 : 0) },
      { discipline: "Mimari", score: (goal ? 25 : 0) + (areaValid ? 25 : 0) + (documents.includes("mimari") ? 50 : 0) },
      { discipline: "Zemin / geoteknik", score: documents.includes("zemin") ? 90 : location.trim() ? 20 : 0 },
      { discipline: "Taşıyıcı sistem", score: (system !== "kararsiz" ? 35 : 10) + (documents.includes("statik") ? 55 : 0) + (areaValid ? 10 : 0) },
      { discipline: "Saha / mevcut durum", score: documents.includes("gorsel") ? 70 : 15 },
    ].map((item) => ({ ...item, score: Math.min(100, item.score) }));
    const riskFlags = [
      documents.includes("arsa") ? "İmar/parsel belgesi beyan edildi; içeriği uzman tarafından doğrulanmalı" : "İmar ve parsel verisi doğrulanmadı",
      !isDemolition ? documents.includes("zemin") ? "Zemin belgesi beyan edildi; temel ve sistem için uzman incelemesi bekliyor" : "Zemin verisi yok; temel ve sistem kararı belirsiz" : "",
      system === "kararsiz" ? "Taşıyıcı sistem kararı açık" : "",
      isDemolition && !documents.includes("gorsel") ? "Mevcut yapı / çevre kaydı eksik" : "",
      priorities.length > 3 ? "Birden fazla öncelik arasında ağırlıklandırma gerekli" : "",
    ].filter(Boolean);
    return { service, score, nextSteps, uncheckedDocuments, maturity, riskFlags };
  }, [areaValid, documents, goal, location, priorities.length, stage, system]);


  const summary = useMemo(() => [
    DEMO_ENABLED ? "ARKEMX DEMO — Yatırım briefi ön değerlendirmesi" : "Merhaba Arkem Yapı Sistemleri, Proje Karar Asistanı özetimi iletiyorum.",
    "",
    `Yapı / ihtiyaç: ${labelOf(goals, goal)}`,
    `Mevcut aşama: ${labelOf(stages, stage)}`,
    `Düşünülen sistem: ${labelOf(systems, system)}`,
    `Konum: ${location || "Belirtilmedi"}`,
    `Yaklaşık alan: ${area || "Belirtilmedi"}`,
    `Mevcut belgeler: ${documents.length ? documents.map((item) => labelOf(documentOptions, item)).join(", ") : "Belirtilmedi"}`,
    `Öncelikler: ${priorities.length ? priorities.map((item) => labelOf(priorityOptions, item)).join(", ") : "Belirtilmedi"}`,
    `Önerilen ilk hizmet: ${result.service.title}`,
    `Beyan tamlığı gösterimi: ${result.score}/100; belge doğrulaması veya teknik uygunluk değildir`,
    `Henüz işaretlenmeyen belgeler: ${result.uncheckedDocuments.length ? result.uncheckedDocuments.join(", ") : "Yok"}`,
    "Belge durumları müşteri beyanıdır; içerikleri ve kaynakları uzman tarafından henüz incelenmedi.",
    ...result.riskFlags.map(flag => `Açık inceleme konusu: ${flag}`),
    "Bu özet ilk görüşme içindir; statik hesap, ruhsat, güvenlik kararı, kesin sistem seçimi, fiyat teklifi veya iş kabulü değildir.",
  ].join("\n"), [area, documents, goal, location, priorities, result, stage, system]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (areaError) { setResultVisible(false); return; }
    setCopied(false);
    setGeneratedAt(new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short" }).format(new Date()));
    setResultVisible(true);
    // Preserve the guided intake's input/schema; this legacy screen is a separate note.
    patchModule("decision-assistant", { readinessScreening: { input: { goal, stage, system, location, area, documents, priorities }, result, needsReview: true, method: "user-declared-not-reviewed", summary } });
    window.setTimeout(() => document.getElementById("karar-sonucu")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      const field = document.createElement("textarea");
      field.value = summary;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const success = document.execCommand("copy");
      field.remove();
      setCopied(success);
    }
  };

  const printReport = () => {
    const cleanup = () => document.body.classList.remove("printing-decision-report");
    document.body.classList.add("printing-decision-report");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  };

  const downloadReport = () => downloadTextFile("arkem-proje-on-hazirlik.json", JSON.stringify({ schema: "ARKEM-BRIEF/1.0", demo: DEMO_ENABLED, method: "rule-based", methodVersion: "readiness-1.1", documentVerification: "user-declared-not-reviewed", input: { goal, stage, system, location, area, documents, priorities }, result, generatedAt }, null, 2), "application/json");

  return <div className="decision-assistant">
    {!DEMO_ENABLED && <ProjectKernelBar module="PROJECT DEFINITION & READINESS" confidence="Müşteri beyanı · inceleme bekliyor" />}
    <form className="decision-form" onSubmit={submit} onChange={() => { setResultVisible(false); setCopied(false); }}>
      <div className="decision-form-heading"><p className="eyebrow">Proje Verisi</p><h2>İhtiyacı adım adım<br/><em>somutlaştıralım.</em></h2><p>{DEMO_ENABLED ? "Alanları değiştirip yol haritasını oluşturun. Demo çalışması bu tarayıcıda tutulur; başvuru gönderilmez." : "Bu ekranda ön çalışma hazırlanır. Hesaba kaydetme ve ARKEM’e gönderme ayrı işlemlerdir."}</p></div>

      <section className="decision-step" aria-labelledby="step-project"><div className="decision-step-title"><span>01</span><div><h3 id="step-project">Projenin çerçevesi</h3><p>Yapı türü ve mevcut aşamayı seçin.</p></div></div><div className="decision-fields">
        <label><span>Yapı / ihtiyaç türü</span><select required value={goal} onChange={(event) => setGoal(event.target.value)}><option value="" disabled>Seçin</option>{goals.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Mevcut aşama</span><select required value={stage} onChange={(event) => setStage(event.target.value)}><option value="" disabled>Seçin</option>{stages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Düşünülen taşıyıcı sistem</span><select value={system} onChange={(event) => setSystem(event.target.value)}>{systems.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Proje yeri</span><input required value={location} onChange={(event) => setLocation(event.target.value)} placeholder="İl / ilçe" /></label>
        <label><span>Yaklaşık kapalı alan (m²)</span><input value={area} onChange={(event) => { setArea(event.target.value); setResultVisible(false); }} inputMode="decimal" placeholder="Örn. 450" aria-invalid={areaError} aria-describedby={areaError ? "decision-area-error" : undefined} />{areaError && <small id="decision-area-error" role="alert">Alanı sıfırdan büyük bir sayı olarak yazın; örneğin 450 veya 450,5.</small>}</label>
      </div></section>

      <section className="decision-step" aria-labelledby="step-documents"><div className="decision-step-title"><span>02</span><div><h3 id="step-documents">Mevcut teknik veriler</h3><p>Elinizde bulunanları işaretleyin.</p></div></div><fieldset className="decision-options"><legend className="sr-only">Mevcut teknik belgeler</legend>{documentOptions.map(([value, label]) => <label key={value} className={documents.includes(value) ? "selected" : ""}><input type="checkbox" checked={documents.includes(value)} onChange={() => toggle(value, documents, setDocuments)} /><span>{label}</span><b aria-hidden="true">{documents.includes(value) ? "✓" : "+"}</b></label>)}</fieldset></section>

      <section className="decision-step" aria-labelledby="step-priorities"><div className="decision-step-title"><span>03</span><div><h3 id="step-priorities">Karar öncelikleri</h3><p>Bir veya birden fazla seçenek işaretleyin.</p></div></div><fieldset className="decision-options"><legend className="sr-only">Proje öncelikleri</legend>{priorityOptions.map(([value, label]) => <label key={value} className={priorities.includes(value) ? "selected" : ""}><input type="checkbox" checked={priorities.includes(value)} onChange={() => toggle(value, priorities, setPriorities)} /><span>{label}</span><b aria-hidden="true">{priorities.includes(value) ? "✓" : "+"}</b></label>)}</fieldset></section>

      <button className="button copper decision-submit" type="submit">Kişisel yol haritasını oluştur <span aria-hidden="true">↗</span></button>
    </form>

    {resultVisible && <section className="decision-result demo-brief-report" id="karar-sonucu" aria-labelledby="brief-report-title" aria-live="polite">
      <header className="brief-report-header"><div><p className="eyebrow">{DEMO_ENABLED ? "DEMO / PIR" : "PIR"}</p><h2 id="brief-report-title">Brief özeti</h2></div><small>{generatedAt}</small></header>
      <div className="brief-report-overview">
        <dl className="brief-report-facts"><div><dt>Yapı türü</dt><dd>{labelOf(goals, goal)}</dd></div><div><dt>Proje yeri</dt><dd>{location || "Belirtilmedi"}</dd></div><div><dt>Mevcut aşama</dt><dd>{labelOf(stages, stage)}</dd></div><div><dt>Yaklaşık alan</dt><dd>{areaValid ? `${positiveArea(area)?.toLocaleString("tr-TR")} m²` : "Belirtilmedi"}</dd></div><div><dt>Taşıyıcı sistem</dt><dd>{labelOf(systems, system)}</dd></div><div><dt>Öncelikler</dt><dd>{priorities.length ? priorities.map(item => labelOf(priorityOptions, item)).join(", ") : "Belirtilmedi"}</dd></div></dl>
        <aside className="brief-report-status"><span>Bilgi tamlığı</span><strong>{result.score}<small>/100</small></strong><div className="brief-report-track" role="progressbar" aria-label="Beyan edilen bilgilerin tamlığı" aria-valuenow={result.score} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${result.score}%` }}/></div><p>Form bilgilerinin doluluk göstergesidir. Belgeler ve teknik uygunluk doğrulanmadı.</p><span>Önerilen ilk adım</span><h3>{result.service.title}</h3><Link href={result.service.href}>Hizmet kapsamı ↗</Link></aside>
      </div>
      <div className="brief-report-columns">
        <section><h3>Sonraki adımlar</h3><ol className="brief-report-steps">{result.nextSteps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></section>
        <section><h3>Açık konular</h3><ul className="brief-report-risks">{result.riskFlags.length ? result.riskFlags.map(flag => <li key={flag}>{flag}</li>) : <li>İşaretlenen belgelerin uzman incelemesi bekleniyor.</li>}</ul></section>
      </div>
      <div className="brief-report-columns brief-report-detail">
        <section><h3>Belge durumu</h3><ul className="brief-report-documents">{documentOptions.map(([value, label]) => <li key={value}><span>{label}</span><small>{documents.includes(value) ? "Beyan edildi · incelenmedi" : "İşaretlenmedi"}</small></li>)}</ul></section>
        <section><h3>Disiplin bazında bilgi tamlığı</h3><div className="brief-report-disciplines">{result.maturity.map(item => <div key={item.discipline}><span>{item.discipline}</span><strong>{item.score}/100</strong><div className="brief-report-track" aria-hidden="true"><i style={{ width: `${item.score}%` }}/></div></div>)}</div></section>
      </div>
      <div className="brief-report-footer"><p>Ön değerlendirmedir; teknik onay veya kesin sistem seçimi değildir.</p><Link href="/yapi-sistemi-karsilastirma">Sistem karşılaştırmasına geç ↗</Link></div>
      <div className="decision-actions brief-report-actions">{DEMO_ENABLED ? <button type="button" onClick={() => downloadTextFile("arkem-demo-yatirim-briefi.txt", summary, "text/plain;charset=utf-8")}>Metin indir</button> : <a href={`https://wa.me/${site.whatsappHref}?text=${encodeURIComponent(summary)}`} target="_blank" rel="noreferrer">WhatsApp ile gönder ↗</a>}<button type="button" onClick={printReport}>PDF / Yazdır</button><button type="button" onClick={downloadReport}>JSON indir</button><button type="button" onClick={copySummary}>{copied ? "Kopyalandı ✓" : "Özeti kopyala"}</button></div>
    </section>}
  </div>;
}
