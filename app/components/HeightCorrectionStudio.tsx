"use client";

import Link from "next/link";
import { useState } from "react";
import { useProjectKernel } from "./ProjectKernel";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function HeightCorrectionStudio() {
  const { project, thread, hydrated, patchModule } = useProjectKernel();
  const [correctionNotice, setCorrectionNotice] = useState<null | {
    fromFloors: number;
    toFloors: number;
    fromHeight: number;
    toHeight: number;
  }>(null);

  const plan = record(project.modules["plan-editor"]);
  const architecture = record(project.modules["architectural-program"]);
  const architectureInput = record(architecture.input);
  const geo = record(project.modules["geo-parcel"]);
  const structure = record(project.modules["structural-concept"]);
  const structureInput = record(structure.input);

  const planFloors = numeric(plan.floorCount);
  const architectureFloors = numeric(architectureInput.floors);
  const geoFloors = numeric(geo.floors);
  const structureFloors = numeric(structureInput.floors);

  const owner = planFloors > 0
    ? { key: "plan-editor", label: "Plan & aks modeli", floors: planFloors }
    : architectureFloors > 0
      ? { key: "architectural-program", label: "Mimari program", floors: architectureFloors }
      : geoFloors > 0
        ? { key: "geo-parcel", label: "Yapı Yerleşimi", floors: geoFloors }
        : { key: "structural-concept", label: "Taşıyıcı ön tasarım", floors: structureFloors };

  const structureFloorHeight = numeric(structureInput.floorHeight);
  const geoFloorHeight = numeric(geo.floorHeight);
  const architectureFloorHeight = numeric(architectureInput.floorHeight);
  const floorHeight = structureFloorHeight || geoFloorHeight || architectureFloorHeight;
  const floorHeightSource = structureFloorHeight > 0
    ? "Taşıyıcı ön tasarım"
    : geoFloorHeight > 0
      ? "Yapı Yerleşimi"
      : architectureFloorHeight > 0
        ? "Mimari program"
        : "Bilinmeyen kaynak";

  const maxHeight = thread.canonical.site.maxHeight;
  const proposedHeight = owner.floors * floorHeight;
  const heightPass = maxHeight > 0 && floorHeight > 0 && owner.floors > 0 && proposedHeight <= maxHeight + .01;
  const overage = maxHeight > 0 ? Math.max(0, proposedHeight - maxHeight) : 0;
  const maxFloorsAtCurrentHeight = maxHeight > 0 && floorHeight > 0 ? Math.floor((maxHeight + .0001) / floorHeight) : 0;
  const structuralMismatch = structureFloors > 0 && owner.key !== "structural-concept" && structureFloors !== owner.floors;

  const updateFloorCount = (next: number) => {
    if (!hydrated) return;
    const safe = Math.max(1, Math.min(30, Math.round(next)));
    if (owner.key === "plan-editor") patchModule("plan-editor", { floorCount: safe });
    else if (owner.key === "architectural-program") patchModule("architectural-program", { input: { floors: safe } });
    else if (owner.key === "geo-parcel") patchModule("geo-parcel", { floors: safe });
    else patchModule("structural-concept", { input: { floors: safe } });
  };

  const applyRecommendedFloorCount = () => {
    if (!(maxFloorsAtCurrentHeight >= 1) || !owner.floors || !(floorHeight > 0)) return;
    const fromFloors = owner.floors;
    const toFloors = maxFloorsAtCurrentHeight;
    setCorrectionNotice({
      fromFloors,
      toFloors,
      fromHeight: fromFloors * floorHeight,
      toHeight: toFloors * floorHeight,
    });
    updateFloorCount(toFloors);
  };

  return <section className="arx-height-fix" data-testid="height-correction-studio">
    <div className="arx-height-project-strip">
      <div><span>ARKEMX / HEIGHT</span><b>{project.name}</b></div>
      <div><span>{project.phase}</span><span>{project.revision}</span></div>
    </div>

    <section className="arx-height-summary" data-state={heightPass ? "pass" : "review"}>
      <div><span>MEVCUT YÜKSEKLİK</span><b>{floorHeight > 0 && owner.floors > 0 ? `${proposedHeight.toFixed(2)} m` : "—"}</b></div>
      <div><span>HMAX / YENÇOK</span><b>{maxHeight > 0 ? `${maxHeight.toFixed(2)} m` : "—"}</b></div>
      <div><span>DURUM</span><b>{maxHeight <= 0 ? "Hmax girdisi eksik" : heightPass ? "Hmax sınırı içinde" : `${overage.toFixed(2)} m azaltılmalı`}</b></div>
      {!heightPass && maxFloorsAtCurrentHeight >= 1 ? <button type="button" onClick={applyRecommendedFloorCount}>Kat adedini {maxFloorsAtCurrentHeight} yap</button> : null}
    </section>

    {correctionNotice ? <section className="arx-height-change-summary" role="status" aria-live="polite">
      <div><span>DÜZELTME UYGULANDI</span><b>{correctionNotice.fromFloors} → {correctionNotice.toFloors} kat</b></div>
      <div><span>YÜKSEKLİK</span><b>{correctionNotice.fromHeight.toFixed(2)} → {correctionNotice.toHeight.toFixed(2)} m</b></div>
      <div><span>SONUÇ</span><b>{correctionNotice.toHeight <= maxHeight + .01 ? "Hmax sınırı içinde" : "Ek düzeltme gerekli"}</b></div>
    </section> : null}

    <div className="arx-height-grid">
      <main>
        <section className="arx-height-equation">
          <span>PLN-013 · YÜKSEKLİK DENKLEMİ</span>
          <div>
            <article><small>KAT ADEDİ</small><b>{owner.floors || "—"}</b><p>{owner.label}</p></article>
            <i>×</i>
            <article><small>KAT YÜKSEKLİĞİ</small><b>{floorHeight > 0 ? `${floorHeight.toFixed(2)} m` : "—"}</b><p>{floorHeightSource}</p></article>
            <i>=</i>
            <article><small>TOPLAM</small><b>{proposedHeight > 0 ? `${proposedHeight.toFixed(2)} m` : "—"}</b><p>Hmax {maxHeight > 0 ? `${maxHeight.toFixed(2)} m` : "—"}</p></article>
          </div>
        </section>

        <section className="arx-height-editor">
          <header><span>DÜZELTİLECEK KAYIT</span><b>{owner.label}</b></header>
          <label>
            <span>Kat adedi</span>
            <input type="number" min="1" max="30" value={owner.floors || 1} onChange={(event) => { setCorrectionNotice(null); updateFloorCount(Number(event.target.value)); }} />
          </label>
          <p>Bu ekran yalnız kat adedinin gerçek veri sahibini değiştirir. <strong>{floorHeightSource}</strong> kaynağındaki {floorHeight.toFixed(2)} m kat yüksekliği burada değiştirilmez.</p>
          {maxFloorsAtCurrentHeight > 0 ? <div className="arx-height-guidance"><span>MEVCUT KAT YÜKSEKLİĞİNDE AZAMİ</span><b>{maxFloorsAtCurrentHeight} kat</b><small>{maxFloorsAtCurrentHeight} × {floorHeight.toFixed(2)} = {(maxFloorsAtCurrentHeight * floorHeight).toFixed(2)} m ≤ Hmax {maxHeight.toFixed(2)} m</small></div> : null}
        </section>
      </main>

      <aside>
        <section>
          <strong>HMAX ÖN KONTROLÜ</strong>
          <div><span>Kat adedi kaynağı</span><b>{owner.label}</b></div>
          <div><span>Kat yüksekliği kaynağı</span><b>{floorHeightSource}</b></div>
          <div><span>Toplam yükseklik</span><b className={heightPass ? "good" : "risk"}>{proposedHeight > 0 ? `${proposedHeight.toFixed(2)} m` : "—"}</b></div>
          <div><span>Hmax</span><b>{maxHeight > 0 ? `${maxHeight.toFixed(2)} m` : "—"}</b></div>
        </section>

        <section className={structuralMismatch ? "arx-height-coordination warning" : "arx-height-coordination"}>
          <strong>MODEL KOORDİNASYONU</strong>
          {structureFloors > 0 ? <><div><span>Taşıyıcı model</span><b>{structureFloors} kat</b></div><div><span>{owner.label}</span><b>{owner.floors} kat</b></div></> : <p>Taşıyıcı model kat adedi henüz kayıtlı değil.</p>}
          {structuralMismatch ? <p>Kat adetleri farklı. Hmax kontrolü düzelse bile taşıyıcı model ayrıca senkronize edilmelidir.</p> : <p>Kat adedi kaynakları mevcut durumda aynı görünüyor.</p>}
        </section>

        <Link className="arx-height-zoning-link" href="/arsa-fizibilite-studyosu?stage=zoning&focus=hmax#geo-studyo">Hmax girdisini ve kaynağını incele</Link>
      </aside>
    </div>

    <footer><b>Kontrol statüsü · Parametrik ön kontrol</b><p>Bu ekran resmî imar uygunluğu veya ruhsat onayı üretmez. Hmax kaynağı ayrıca doğrulanmalı; kat adedi değişikliği mimari, taşıyıcı ve diğer disiplin modellerinde koordine edilmelidir.</p></footer>
  </section>;
}
