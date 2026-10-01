"use client";

import { useState } from "react";
import { useProjectKernel } from "./ProjectKernel";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function closeEnough(first: number, second: number, tolerance = .01) {
  return first > 0 && second > 0 && Math.abs(first - second) <= tolerance;
}

export function StructuralSyncStudio() {
  const { project, hydrated, patchModule } = useProjectKernel();
  const [lastSync, setLastSync] = useState<null | {
    beforeFloors: number;
    afterFloors: number;
    beforeWidth: number;
    afterWidth: number;
    beforeDepth: number;
    afterDepth: number;
  }>(null);

  const plan = record(project.modules["plan-editor"]);
  const structural = record(project.modules["structural-concept"]);
  const structuralInput = record(structural.input);

  const planBaysX = numeric(plan.baysX);
  const planBaysY = numeric(plan.baysY);
  const planSpanX = numeric(plan.spanX);
  const planSpanY = numeric(plan.spanY);
  const planFloors = numeric(plan.floorCount);
  const planWidth = planBaysX * planSpanX;
  const planDepth = planBaysY * planSpanY;

  const structuralFloors = numeric(structuralInput.floors);
  const structuralWidth = numeric(structuralInput.width);
  const structuralDepth = numeric(structuralInput.depth);
  const structuralBaysX = numeric(structuralInput.baysX);
  const structuralBaysY = numeric(structuralInput.baysY);
  const structuralFloorHeight = numeric(structuralInput.floorHeight);

  const floorsMatch = planFloors > 0 && structuralFloors === planFloors;
  const widthMatch = closeEnough(planWidth, structuralWidth, .01);
  const depthMatch = closeEnough(planDepth, structuralDepth, .01);
  const baysMatch = planBaysX > 0 && planBaysY > 0 && structuralBaysX === planBaysX && structuralBaysY === planBaysY;
  const geometryReady = planFloors > 0 && planWidth > 0 && planDepth > 0 && planBaysX > 0 && planBaysY > 0;
  const allMatch = geometryReady && floorsMatch && widthMatch && depthMatch && baysMatch;

  const syncPlanToStructure = () => {
    if (!hydrated || !geometryReady) return;
    setLastSync({
      beforeFloors: structuralFloors,
      afterFloors: planFloors,
      beforeWidth: structuralWidth,
      afterWidth: planWidth,
      beforeDepth: structuralDepth,
      afterDepth: planDepth,
    });
    patchModule("structural-concept", {
      input: {
        floors: planFloors,
        width: Number(planWidth.toFixed(3)),
        depth: Number(planDepth.toFixed(3)),
        baysX: planBaysX,
        baysY: planBaysY,
      },
      sync: {
        source: "plan-editor",
        syncedAt: new Date().toISOString(),
        fields: ["floors", "width", "depth", "baysX", "baysY"],
      },
    });
  };

  const rows = [
    { key: "floors", label: "Kat adedi", plan: planFloors ? String(planFloors) : "—", structural: structuralFloors ? String(structuralFloors) : "—", pass: floorsMatch },
    { key: "width", label: "X toplam boyu", plan: planWidth ? `${planWidth.toFixed(2)} m` : "—", structural: structuralWidth ? `${structuralWidth.toFixed(2)} m` : "—", pass: widthMatch },
    { key: "depth", label: "Y toplam boyu", plan: planDepth ? `${planDepth.toFixed(2)} m` : "—", structural: structuralDepth ? `${structuralDepth.toFixed(2)} m` : "—", pass: depthMatch },
    { key: "bays", label: "Aks düzeni", plan: planBaysX && planBaysY ? `${planBaysX} × ${planBaysY}` : "—", structural: structuralBaysX && structuralBaysY ? `${structuralBaysX} × ${structuralBaysY}` : "—", pass: baysMatch },
  ];

  return <section className="arx-struct-sync" data-testid="structural-sync-studio">
    <div className="arx-struct-sync-project">
      <div><span>ARKEMX / STR SYNC</span><b>{project.name}</b></div>
      <div><span>{project.phase}</span><span>{project.revision}</span></div>
    </div>

    <section className="arx-struct-sync-summary" data-state={allMatch ? "pass" : "review"}>
      <div><span>PLAN MODELİ</span><b>{planFloors || "—"} kat · {planWidth ? planWidth.toFixed(2) : "—"} × {planDepth ? planDepth.toFixed(2) : "—"} m</b></div>
      <div><span>TAŞIYICI MODEL</span><b>{structuralFloors || "—"} kat · {structuralWidth ? structuralWidth.toFixed(2) : "—"} × {structuralDepth ? structuralDepth.toFixed(2) : "—"} m</b></div>
      <div><span>DURUM</span><b>{allMatch ? "Geometri senkron" : "Senkronizasyon gerekli"}</b></div>
      {!allMatch && geometryReady
        ? <button type="button" onClick={syncPlanToStructure}>Plan verisini taşıyıcı modele aktar</button>
        : allMatch
          ? <div className="arx-struct-sync-complete"><span>SENKRON TAMAMLANDI</span><b>Geometri eşleşiyor</b></div>
          : <div className="arx-struct-sync-complete pending"><span>VERİ BEKLENİYOR</span><b>Plan geometrisi eksik</b></div>}
    </section>

    {lastSync ? <section className="arx-struct-sync-result" role="status" aria-live="polite">
      <div><span>KAT ADEDİ</span><b>{lastSync.beforeFloors || "—"} → {lastSync.afterFloors}</b></div>
      <div><span>X BOYU</span><b>{lastSync.beforeWidth ? lastSync.beforeWidth.toFixed(2) : "—"} → {lastSync.afterWidth.toFixed(2)} m</b></div>
      <div><span>Y BOYU</span><b>{lastSync.beforeDepth ? lastSync.beforeDepth.toFixed(2) : "—"} → {lastSync.afterDepth.toFixed(2)} m</b></div>
      <div><span>SONUÇ</span><b>Taşıyıcı geometri girdileri güncellendi</b></div>
    </section> : null}

    <div className="arx-struct-sync-grid">
      <main>
        <section className="arx-struct-sync-table">
          <header><span>H-03 · PLAN → TAŞIYICI MODEL</span><b>Geometri devir teslim kontrolü</b></header>
          <div className="head"><span>Alan</span><span>Plan & aks modeli</span><span>Taşıyıcı ön tasarım</span><span>Durum</span></div>
          {rows.map((row) => <div className="row" key={row.key}>
            <b>{row.label}</b><span>{row.plan}</span><span>{row.structural}</span><strong className={row.pass ? "good" : "risk"}>{row.pass ? "Eşleşiyor" : "Farklı"}</strong>
          </div>)}
        </section>

        <section className="arx-struct-sync-scope">
          <span>{allMatch ? "SENKRONİZE EDİLEN ALANLAR" : "AKTARILACAK ALANLAR"}</span>
          <div><b>Kat adedi</b><b>X / Y toplam boyu</b><b>X / Y aks adedi</b></div>
          <p>{allMatch
            ? <>Bu alanlar plan modeli ile taşıyıcı ön tasarım arasında eşleştirildi. Taşıyıcı sistem, kat yüksekliği, kolon/kiriş/döşeme kesitleri, yükler, malzeme, zemin ve deprem girdileri korunmuştur.</>
            : <>Bu işlem yalnız plan geometrisini taşıyıcı ön tasarımın <code>input</code> kaydına aktarır. Taşıyıcı sistem, kat yüksekliği, kolon/kiriş/döşeme kesitleri, yükler, malzeme, zemin ve deprem girdileri korunur.</>}</p>
        </section>
      </main>

      <aside>
        <section>
          <strong>KAYNAK ÖNCELİĞİ</strong>
          <div><span>Kaynak</span><b>Plan & aks modeli</b></div>
          <div><span>Hedef</span><b>Taşıyıcı ön tasarım</b></div>
          <div><span>Devir</span><b>H-03</b></div>
        </section>
        <section>
          <strong>KORUNAN TAŞIYICI GİRDİLER</strong>
          <div><span>Kat yüksekliği</span><b>{structuralFloorHeight > 0 ? `${structuralFloorHeight.toFixed(2)} m` : "—"}</b></div>
          <p>Taşıyıcı sistem ve mühendislik kabulleri bu senkronizasyonla değiştirilmez.</p>
        </section>
      </aside>
    </div>

    <footer><b>Koordinasyon statüsü · Model senkronizasyonu</b><p>Bu işlem disiplinler arası veri tutarlılığı içindir; statik analiz, boyutlandırma veya mühendislik onayı değildir. Senkronizasyon sonrası taşıyıcı ön tasarım kontrolleri yeniden değerlendirilmelidir.</p></footer>
  </section>;
}
