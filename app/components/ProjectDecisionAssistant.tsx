"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { site } from "../data/site";
import { downloadTextFile } from "../lib/engineering";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";
import { moduleRecord, restoreModuleValue, useModuleRestore } from "./useModuleRestore";
import { decisionAssistantInput } from "../lib/project-input-mapping";

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
  ["karbon", "Düşük karbon"],
  ["isletme", "İşletme performansı"],
] as const;

const labelOf = (options: readonly (readonly [string, string])[], value: string) => options.find(([key]) => key === value)?.[1] || "Belirtilmedi";

export function ProjectDecisionAssistant() {
  const { project } = useProjectKernel();
  return <ProjectDecisionAssistantSession key={project.id} />;
}

function ProjectDecisionAssistantSession() {
  const { patchModule } = useProjectKernel();
  const [goal, setGoal] = useState("");
  const [stage, setStage] = useState("");
  const [system, setSystem] = useState("kararsiz");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [documents, setDocuments] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [inputMappingSource, setInputMappingSource] = useState<Record<string, unknown>>({});
  const [resultVisible, setResultVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const draftReady = useModuleRestore("decision-assistant", (saved) => {
    setInputMappingSource(moduleRecord(saved.inputMappingSource ?? saved.input));
    const input = decisionAssistantInput(saved.input);
    setGoal(restoreModuleValue(input.goal, goal));
    setStage(restoreModuleValue(input.stage, stage));
    setSystem(restoreModuleValue(input.system, system));
    setLocation(restoreModuleValue(input.location, location));
    setArea(restoreModuleValue(input.area, area));
    setDocuments(restoreModuleValue(input.documents, documents));
    setPriorities(restoreModuleValue(input.priorities, priorities));
    setResultVisible(saved.status === "report-generated");
  });

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
      (area.trim() ? 10 : 0) +
      (system && system !== "kararsiz" ? 8 : 0) +
      Math.min(24, documents.length * 6) +
      Math.min(12, priorities.length * 4),
    );

    const nextSteps = [
      !location.trim() ? "Yapının il ve ilçe bilgisini netleştirin." : "Konuma bağlı imar, iklim, deprem ve saha verilerini doğrulayın.",
      !area.trim() ? "Yaklaşık kapalı alanı ve ihtiyaç programını oluşturun." : "Yaklaşık alanı kat ve kullanım bazında kontrol edin.",
      system === "kararsiz" ? "Uygun taşıyıcı sistemleri süre, maliyet ve performans açısından karşılaştırın." : `${labelOf(systems, system)} seçeneğini proje girdileri üzerinden doğrulayın.`,
      documents.length < 2 ? "Mevcut pafta, arsa belgesi, zemin verisi ve görselleri tek dosyada toplayın." : "Mevcut belgelerdeki eksik ve güncel olmayan verileri işaretleyin.",
      isDemolition ? "Yıkım yöntemi kararı öncesinde yapı, çevre ve resmî izin koşulları için uzman ön incelemesi yaptırın." : "İlk teknik görüşmede kapsam, teslimler ve sorumlulukları yazılı hale getirin.",
    ];

    const uncheckedDocuments = documentOptions.filter(([value]) => !documents.includes(value)).map(([, label]) => label);

    const maturity = [
      { discipline: "Arsa / imar", score: (location.trim() ? 45 : 0) + (documents.includes("arsa") ? 45 : 0) + (stage ? 10 : 0) },
      { discipline: "Mimari", score: (goal ? 25 : 0) + (area.trim() ? 25 : 0) + (documents.includes("mimari") ? 50 : 0) },
      { discipline: "Zemin / geoteknik", score: documents.includes("zemin") ? 90 : location.trim() ? 20 : 0 },
      { discipline: "Taşıyıcı sistem", score: (system !== "kararsiz" ? 35 : 10) + (documents.includes("statik") ? 55 : 0) + (area.trim() ? 10 : 0) },
      { discipline: "Saha / mevcut durum", score: documents.includes("gorsel") ? 70 : 15 },
    ].map((item) => ({ ...item, score: Math.min(100, item.score) }));
    const riskFlags = [
      !documents.includes("arsa") && stage !== "santiye" ? "İmar ve parsel verisi doğrulanmadı" : "",
      !documents.includes("zemin") && !isDemolition ? "Zemin verisi yok; temel ve sistem kararı belirsiz" : "",
      system === "kararsiz" ? "Taşıyıcı sistem kararı açık" : "",
      isDemolition && !documents.includes("gorsel") ? "Mevcut yapı / çevre kaydı eksik" : "",
      priorities.length > 3 ? "Birden fazla öncelik arasında ağırlıklandırma gerekli" : "",
    ].filter(Boolean);
    return { service, score, nextSteps, uncheckedDocuments, maturity, riskFlags };
  }, [area, documents, goal, location, priorities.length, stage, system]);

  useEffect(() => { if (!draftReady) return;
    patchModule("decision-assistant", { input: { goal, stage, system, location, area, documents, priorities }, inputMappingSource, result, status: resultVisible ? "report-generated" : "draft" });
  }, [draftReady, area, documents, goal, inputMappingSource, location, patchModule, priorities, result, resultVisible, stage, system]);

  const summary = useMemo(() => [
    "Merhaba Arkem Yapı Sistemleri, Proje Karar Asistanı özetimi iletiyorum.",
    "",
    `Yapı / ihtiyaç: ${labelOf(goals, goal)}`,
    `Mevcut aşama: ${labelOf(stages, stage)}`,
    `Düşünülen sistem: ${labelOf(systems, system)}`,
    `Konum: ${location || "Belirtilmedi"}`,
    `Yaklaşık alan: ${area || "Belirtilmedi"}`,
    `Mevcut belgeler: ${documents.length ? documents.map((item) => labelOf(documentOptions, item)).join(", ") : "Belirtilmedi"}`,
    `Öncelikler: ${priorities.length ? priorities.map((item) => labelOf(priorityOptions, item)).join(", ") : "Belirtilmedi"}`,
    `Önerilen ilk hizmet: ${result.service.title}`,
    `Hazırlık skoru: ${result.score}/100`,
    `Henüz işaretlenmeyen belgeler: ${result.uncheckedDocuments.length ? result.uncheckedDocuments.join(", ") : "Yok"}`,
  ].join("\n"), [area, documents, goal, location, priorities, result.score, result.service.title, result.uncheckedDocuments, stage, system]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCopied(false);
    setGeneratedAt(new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short" }).format(new Date()));
    setResultVisible(true);
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

  const downloadReport = () => downloadTextFile("arkem-proje-on-hazirlik.json", JSON.stringify({ schema: "ARKEM-BRIEF/1.0", input: { goal, stage, system, location, area, documents, priorities }, result, generatedAt }, null, 2), "application/json");

  return <div className="decision-assistant">
    <ProjectKernelBar moduleKey="decision-assistant" module="PROJECT DEFINITION & READINESS" confidence="Veri olgunluğu taraması" />
    <form className="decision-form" onSubmit={submit}>
      <div className="decision-form-heading"><p className="eyebrow">Proje Verisi</p><h2>İhtiyacı adım adım<br/><em>somutlaştıralım.</em></h2><p>Yanıtlar yalnızca bu tarayıcıda sonucu oluşturur; sunucuya kaydedilmez.</p></div>

      <section className="decision-step" aria-labelledby="step-project"><div className="decision-step-title"><span>01</span><div><h3 id="step-project">Projenin çerçevesi</h3><p>Yapı türü ve mevcut aşamayı seçin.</p></div></div><div className="decision-fields">
        <label><span>Yapı / ihtiyaç türü</span><select required value={goal} onChange={(event) => setGoal(event.target.value)}><option value="" disabled>Seçin</option>{goals.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Mevcut aşama</span><select required value={stage} onChange={(event) => setStage(event.target.value)}><option value="" disabled>Seçin</option>{stages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Düşünülen taşıyıcı sistem</span><select value={system} onChange={(event) => setSystem(event.target.value)}>{systems.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Proje yeri</span><input required value={location} onChange={(event) => setLocation(event.target.value)} placeholder="İl / ilçe" /></label>
        <label><span>Yaklaşık kapalı alan</span><input value={area} onChange={(event) => setArea(event.target.value)} inputMode="decimal" placeholder="Örn. 450 m²" /></label>
      </div></section>

      <section className="decision-step" aria-labelledby="step-documents"><div className="decision-step-title"><span>02</span><div><h3 id="step-documents">Mevcut teknik veriler</h3><p>Elinizde bulunanları işaretleyin.</p></div></div><fieldset className="decision-options"><legend className="sr-only">Mevcut teknik belgeler</legend>{documentOptions.map(([value, label]) => <label key={value} className={documents.includes(value) ? "selected" : ""}><input type="checkbox" checked={documents.includes(value)} onChange={() => toggle(value, documents, setDocuments)} /><span>{label}</span><b aria-hidden="true">{documents.includes(value) ? "✓" : "+"}</b></label>)}</fieldset></section>

      <section className="decision-step" aria-labelledby="step-priorities"><div className="decision-step-title"><span>03</span><div><h3 id="step-priorities">Karar öncelikleri</h3><p>Bir veya birden fazla seçenek işaretleyin.</p></div></div><fieldset className="decision-options"><legend className="sr-only">Proje öncelikleri</legend>{priorityOptions.map(([value, label]) => <label key={value} className={priorities.includes(value) ? "selected" : ""}><input type="checkbox" checked={priorities.includes(value)} onChange={() => toggle(value, priorities, setPriorities)} /><span>{label}</span><b aria-hidden="true">{priorities.includes(value) ? "✓" : "+"}</b></label>)}</fieldset></section>

      <button className="button copper decision-submit" type="submit">Kişisel yol haritasını oluştur <span aria-hidden="true">↗</span></button>
    </form>

    {resultVisible && <section className="decision-result" id="karar-sonucu" aria-live="polite">
      <header className="decision-report-head"><div><b>ARKEM</b><span>YAPI SİSTEMLERİ</span></div><div><strong>Proje Ön Hazırlık Raporu</strong><small>{generatedAt}</small></div></header>
      <div className="decision-score"><div><span>Proje hazırlık skoru</span><strong>{result.score}<small>/100</small></strong></div><div className="score-track" aria-hidden="true"><span style={{ width: `${result.score}%` }}/></div><p>Bu puan yalnızca paylaştığınız ön bilgilerin tamamlanma seviyesini gösterir; mühendislik uygunluğu, maliyet veya onay sonucu değildir.</p></div>
      <div className="decision-recommendation"><p className="eyebrow">Önerilen İlk Hizmet</p><h2>{result.service.title}</h2><p>Mevcut aşamanıza göre ilk teknik görüşmenin bu hizmet çerçevesinde başlaması daha verimli görünür.</p><Link className="text-link" href={result.service.href}>Hizmet kapsamını inceleyin <span aria-hidden="true">↗</span></Link></div>
      <div className="decision-roadmap"><p className="eyebrow">Öncelikli Yol Haritası</p><ol>{result.nextSteps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></div>
      <div className="decision-maturity"><div><p className="eyebrow">Disiplin Bazlı Veri Olgunluğu</p><h2>Tek toplam puanın<br/><em>arkasını görün.</em></h2><p>Her disiplinin başlangıç verisi ayrı değerlendirilir; yüksek toplam skor kritik bir eksikliği gizleyemez.</p></div><section>{result.maturity.map((item) => <article key={item.discipline}><span>{item.discipline}</span><i><b style={{ width: `${item.score}%` }}></b></i><strong>{item.score}<small>/100</small></strong></article>)}</section><aside><span>ERKEN RİSK KAYDI</span>{result.riskFlags.length ? result.riskFlags.map((flag) => <p key={flag}><i>!</i>{flag}</p>) : <p className="good"><i>✓</i>Form girdilerinde açık kritik eksik görünmüyor</p>}</aside></div>
      <div className="decision-checklist"><div><p className="eyebrow">Belge Kontrolü</p><h2>Görüşme dosyanızı tamamlayın.</h2><p>Bu liste zorunlu belge listesi değildir; yalnızca formda henüz işaretlemediğiniz genel veri başlıklarını gösterir.</p></div><ul>{documentOptions.map(([value, label]) => <li key={value} className={documents.includes(value) ? "ready" : "missing"}><span aria-hidden="true">{documents.includes(value) ? "✓" : "○"}</span>{label}<small>{documents.includes(value) ? "Mevcut" : "İşaretlenmedi"}</small></li>)}</ul></div>
      <div className="decision-next-tool"><div><p className="eyebrow">Sonraki Dijital Adım</p><h2>Taşıyıcı sistem alternatiflerini birlikte görün.</h2></div><Link className="text-link" href="/yapi-sistemi-karsilastirma">Yapı Sistemi Karşılaştırma Aracını açın <span aria-hidden="true">↗</span></Link></div>
      <div className="decision-actions"><a className="button copper" href={`https://wa.me/${site.whatsappHref}?text=${encodeURIComponent(summary)}`} target="_blank" rel="noreferrer">Özeti WhatsApp ile gönder <span aria-hidden="true">↗</span></a><button type="button" onClick={printReport}>PDF olarak kaydet / yazdır</button><button type="button" onClick={downloadReport}>Teknik JSON indir</button><button type="button" onClick={copySummary}>{copied ? "Özet kopyalandı ✓" : "Özeti kopyala"}</button></div>
    </section>}
  </div>;
}

