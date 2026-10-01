"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildMcdaProjectSnapshot, mcdaInputMatchesSource, mcdaSourceKey, mcdaSourceMatches, type McdaSourceSnapshot } from "../lib/mcda-source";
import { useProjectKernel } from "./ProjectKernel";

type SystemId = "light" | "steel" | "precast" | "concrete" | "hybrid";
type DecisionRecord = {
  status?: string;
  decisionType?: string;
  selectedSystem?: string;
  recommendedSystem?: string;
  rationale?: string;
  decidedBy?: string;
  role?: string;
  date?: string;
  note?: string;
  mcdaSourceKey?: string;
};

const SYSTEM_LABELS: Record<SystemId, string> = {
  light: "Hafif Çelik",
  steel: "Yapısal Çelik",
  precast: "Betonarme Prefabrik",
  concrete: "Betonarme",
  hybrid: "Karma Sistem",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function systemId(value: unknown): SystemId | "" {
  const raw = typeof value === "string" ? value.trim().toLocaleLowerCase("tr-TR") : "";
  if (raw === "light" || raw.includes("hafif")) return "light";
  if (raw === "hybrid" || raw.includes("karma")) return "hybrid";
  if (raw === "precast" || raw.includes("prefabrik")) return "precast";
  if (raw === "steel" || raw.includes("çelik")) return "steel";
  if (raw === "concrete" || raw.includes("beton")) return "concrete";
  return "";
}

export function SystemDecisionStudio() {
  const { project, patchModule, hydrated, thread } = useProjectKernel();
  const comparison = record(project.modules["system-comparison"]);
  const comparisonInput = record(comparison.input);
  const comparisonSourceSnapshot = record(comparison.sourceSnapshot);
  const structural = record(project.modules["structural-concept"]);
  const structuralInput = record(structural.input);
  const ranking = Array.isArray(comparison.ranking) ? comparison.ranking.map(record) : [];
  const winner = ranking[0] ?? {};
  const currentProjectSource = buildMcdaProjectSnapshot({
    use: thread.canonical.architecture.use,
    floors: thread.canonical.architecture.floors,
    grossArea: thread.canonical.architecture.grossArea,
    spanX: thread.canonical.structure.spanX,
    spanY: thread.canonical.structure.spanY,
  });
  const hasStoredSource = Boolean(Object.keys(comparisonSourceSnapshot).length);
  const mcdaSourceCurrent = currentProjectSource
    ? hasStoredSource
      ? mcdaSourceMatches(comparisonSourceSnapshot as McdaSourceSnapshot, currentProjectSource)
      : mcdaInputMatchesSource(comparisonInput, currentProjectSource)
    : false;
  const currentSourceKey = mcdaSourceKey(currentProjectSource);
  const recommendedId = systemId(winner.id || winner.name);
  const modeledId = systemId(structuralInput.system);
  const savedDecision = record(comparison.decision) as DecisionRecord;

  const [rationale, setRationale] = useState(savedDecision.rationale ?? "");
  const [decidedBy, setDecidedBy] = useState(savedDecision.decidedBy ?? "");
  const [role, setRole] = useState(savedDecision.role ?? "");
  const [date, setDate] = useState(savedDecision.date ?? "");
  const [note, setNote] = useState(savedDecision.note ?? "");
  const [message, setMessage] = useState("");

  const recommendationScore = typeof winner.score === "number" ? winner.score : 0;
  const mismatch = Boolean(recommendedId && modeledId && recommendedId !== modeledId);
  const savedDecisionValid = Boolean(
    mcdaSourceCurrent
    && savedDecision.status === "recorded"
    && systemId(savedDecision.selectedSystem) === modeledId
    && systemId(savedDecision.recommendedSystem) === recommendedId
    && savedDecision.mcdaSourceKey === currentSourceKey
    && (savedDecision.rationale ?? "").trim().length >= 10
    && (savedDecision.decidedBy ?? "").trim()
    && (savedDecision.role ?? "").trim()
    && (savedDecision.date ?? "").trim()
  );

  const currentLabel = modeledId ? SYSTEM_LABELS[modeledId] : "Model sistemi bulunamadı";
  const recommendedLabel = recommendedId ? SYSTEM_LABELS[recommendedId] : "MCDA sonucu bulunamadı";

  const rationaleReady = useMemo(() => (
    rationale.trim().length >= 10
    && decidedBy.trim().length > 0
    && role.trim().length > 0
    && date.trim().length > 0
    && mcdaSourceCurrent
    && Boolean(modeledId && recommendedId)
  ), [date, decidedBy, mcdaSourceCurrent, modeledId, rationale, recommendedId, role]);

  const keepCurrentSystem = () => {
    if (!hydrated || !mcdaSourceCurrent || !rationaleReady || !modeledId || !recommendedId) return;
    patchModule("system-comparison", {
      decision: {
        status: "recorded",
        decisionType: "retain-modeled-system",
        selectedSystem: modeledId,
        selectedSystemLabel: SYSTEM_LABELS[modeledId],
        recommendedSystem: recommendedId,
        recommendedSystemLabel: SYSTEM_LABELS[recommendedId],
        rationale: rationale.trim(),
        decidedBy: decidedBy.trim(),
        role: role.trim(),
        date,
        note: note.trim(),
        mcdaSourceKey: currentSourceKey,
        scope: "conceptual-system-decision",
      },
    });
    setMessage("Farklı sistem seçimi karar kaydına bağlandı. MCDA önerisi değişmedi; modellenen sistem gerekçeli olarak korundu.");
  };

  const applyRecommendation = () => {
    if (!hydrated || !mcdaSourceCurrent || !recommendedId) return;
    patchModule("structural-concept", { input: { system: recommendedId } });
    patchModule("system-comparison", {
      decision: {
        status: "recorded",
        decisionType: "aligned-with-mcda",
        selectedSystem: recommendedId,
        selectedSystemLabel: SYSTEM_LABELS[recommendedId],
        recommendedSystem: recommendedId,
        recommendedSystemLabel: SYSTEM_LABELS[recommendedId],
        rationale: "MCDA ön eleme birincisi kavramsal taşıyıcı modele aktarıldı.",
        decidedBy: decidedBy.trim() || "Proje çalışma alanı",
        role: role.trim() || "Kavramsal koordinasyon",
        date: date || new Date().toISOString().slice(0, 10),
        note: note.trim(),
        mcdaSourceKey: currentSourceKey,
        scope: "conceptual-system-decision",
      },
    });
    setMessage(`${SYSTEM_LABELS[recommendedId]} kavramsal taşıyıcı modele aktarıldı. Kesitler ve mühendislik kabulleri tam taşıyıcı stüdyoda yeniden değerlendirilmelidir.`);
  };

  return <section className="arx-system-decision" data-testid="system-decision-studio">
    <div className="arx-system-decision-project">
      <div><span>ARKEMX / SYS DECISION</span><b>{project.name}</b></div>
      <div><span>{project.phase}</span><span>{project.revision}</span></div>
    </div>

    <section className="arx-system-decision-summary" data-state={mcdaSourceCurrent && (!mismatch || savedDecisionValid) ? "pass" : "review"}>
      <article><span>MCDA ÖN ELEME BİRİNCİSİ</span><b>{recommendedLabel}</b><small>{recommendationScore > 0 ? `${recommendationScore.toFixed(1)} / 100` : "puan bulunamadı"}</small></article>
      <article><span>MODELLENEN SİSTEM</span><b>{currentLabel}</b><small>Taşıyıcı ön tasarım girdisi</small></article>
      <article><span>DURUM</span><b>{!mcdaSourceCurrent ? "MCDA güncel değil" : !mismatch ? "Sistemler eşleşiyor" : savedDecisionValid ? "Farklı seçim gerekçelendirildi" : "Karar kaydı gerekli"}</b><small>{!mcdaSourceCurrent ? "Önce proje verisini MCDA'ya yeniden aktarın." : mismatch ? "MCDA sonucu nihai mühendislik kararı değildir." : "SYS-041 kapalı"}</small></article>
    </section>

    {!mcdaSourceCurrent && currentProjectSource ? <section className="arx-system-decision-stale" role="alert">
      <div><span>SYS-040 · MCDA KAYNAK SENKRONU</span><b>Sistem kararı geçici olarak kilitlendi.</b><p>MCDA girdileri güncel proje verisiyle eşleşmiyor. Güncel kaynak: {currentProjectSource.area.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² · {currentProjectSource.floors} kat · {currentProjectSource.span.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} m açıklık.</p></div>
      <Link href="/yapi-sistemi-karsilastirma/mcda">MCDA verisini güncelle →</Link>
    </section> : null}

    {!recommendedId || !modeledId ? <section className="arx-system-decision-missing">
      <b>Karar için kaynak veri eksik.</b>
      <p>MCDA sıralaması ve taşıyıcı ön tasarım sistemi aynı proje kaydında bulunmalıdır.</p>
    </section> : null}

    {recommendedId && modeledId ? <div className="arx-system-decision-grid">
      <main>
        <section className="arx-system-decision-explain">
          <span>SYS-041 · KARAR AYRIMI</span>
          <h2>Öneri ile model farklı olabilir; fark gerekçesiz kalmamalı.</h2>
          <p>MCDA; kullanım, açıklık, kat, yangın, hız, maliyet öngörülebilirliği ve benzeri kriterlerle kavramsal ön eleme yapar. Model sistemi ise mühendislik ve proje kararının veri sahibidir. Bu ekran yalnız iki kayıt arasındaki karar izini kurar.</p>
        </section>

        <section className="arx-system-decision-options">
          <article>
            <header><span>SEÇENEK A</span><h3>MCDA önerisini modele aktar</h3></header>
            <p><b>{recommendedLabel}</b> sistem kimliğini taşıyıcı ön tasarım girdisine aktarır. Geometri korunur; kesit, yük, malzeme ve diğer mühendislik kabulleri yeni sisteme göre yeniden incelenmelidir.</p>
            <button type="button" onClick={applyRecommendation} disabled={!mcdaSourceCurrent || !mismatch}>MCDA önerisini modele uygula</button>
          </article>

          <article className="is-primary">
            <header><span>SEÇENEK B</span><h3>Mevcut modeli koru ve gerekçeyi kaydet</h3></header>
            <p><b>{currentLabel}</b> modelini korur. Farklı seçimin teknik/proje gerekçesini karar kaydına bağlar; MCDA sıralamasını değiştirmez.</p>
            <div className="arx-system-decision-form">
              <label>Karar gerekçesi<textarea rows={4} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Örn. yerel tedarik, yangın çözümü, uygulayıcı kapasitesi, maliyet/termin teklifi, zemin-temel etkisi veya proje ekibi kararı…" /></label>
              <div>
                <label>Kararı kaydeden<input value={decidedBy} onChange={(event) => setDecidedBy(event.target.value)} placeholder="Ad Soyad / ekip" /></label>
                <label>Rol / disiplin<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Statik, mimari, PM…" /></label>
              </div>
              <label>Karar tarihi<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
              <label>Ek not<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opsiyonel karar notu" /></label>
            </div>
            <button type="button" onClick={keepCurrentSystem} disabled={!mcdaSourceCurrent || !mismatch || !rationaleReady}>Mevcut sistemi gerekçeli olarak koru</button>
          </article>
        </section>
      </main>

      <aside>
        <section>
          <strong>KARAR KAYDI</strong>
          <div><span>MCDA</span><b>{recommendedLabel}</b></div>
          <div><span>Model</span><b>{currentLabel}</b></div>
          <div><span>Fark</span><b className={mismatch ? "risk" : "good"}>{mismatch ? "Var" : "Yok"}</b></div>
          <div><span>Gerekçe kaydı</span><b className={savedDecisionValid ? "good" : "watch"}>{savedDecisionValid ? "Tamamlandı" : "Bekliyor"}</b></div>
        </section>
        <section>
          <strong>SINIR</strong>
          <p>Bu kayıt nihai statik sistem onayı değildir. MCDA puanı bir karar desteğidir; sistem seçimi yetkili mühendislik değerlendirmesi, proje hedefleri ve doğrulanmış girdilerle kesinleştirilmelidir.</p>
        </section>
      </aside>
    </div> : null}

    {message ? <div className="arx-system-decision-message" role="status"><b>Karar kaydı güncellendi</b><span>{message}</span></div> : null}
  </section>;
}
