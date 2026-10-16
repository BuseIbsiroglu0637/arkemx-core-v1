"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";
import { moduleRecord, restoreModuleValue, useModuleRestore } from "./useModuleRestore";
import { deliveryUsageKey } from "../lib/project-input-mapping";

const systems = {
  konut: ["Hafif Çelik", "Betonarme", "Karma Sistem"],
  sanayi: ["Yapısal Çelik", "Prefabrik Betonarme", "Karma Sistem"],
  ticari: ["Çelik + Kompozit", "Betonarme", "Karma Sistem"],
  altyapi: ["Betonarme", "Yapısal Çelik", "Proje özel karma"],
} as const;

const priorities = {
  program: { label: "Program kesinliği", uses: ["4B baz program", "Karar tarihleri", "Tedarik kontrol kulesi"] },
  cost: { label: "Maliyet ve kapsam", uses: ["5B sınıflandırma", "Değişiklik kaydı", "Kazanılmış değer"] },
  operation: { label: "İşletme ve varlık", uses: ["AIM / COBie", "Varlık pasaportu", "Bakım veri sözleşmesi"] },
  carbon: { label: "Karbon ve döngüsellik", uses: ["LCA modül modeli", "EPD hiyerarşisi", "Sökülebilirlik kaydı"] },
} as const;

export function DigitalInnovationLab() {
  const { project } = useProjectKernel();
  return <DigitalInnovationLabSession key={project.id} />;
}

function DigitalInnovationLabSession() {
  const { patchModule, thread } = useProjectKernel();
  const [type, setType] = useState<keyof typeof systems>("sanayi");
  const [area, setArea] = useState(4200);
  const [priority, setPriority] = useState<keyof typeof priorities>("program");
  const [phase, setPhase] = useState("Konsept / avan");
  const [modelDetail, setModelDetail] = useState("LOD 300 / koordinasyon");
  const [capabilities, setCapabilities] = useState({ gis: false, bim: false, schedule: false, cost: false, reality: false, asset: false });
  const draftReady = useModuleRestore("digital-delivery-scope", (saved) => {
    const input = moduleRecord(saved.input);
    if (typeof input.type === "string" && Object.hasOwn(systems, input.type)) setType(input.type as keyof typeof systems); else setType(type);
    setArea(restoreModuleValue(input.area, area));
    if (typeof input.priority === "string" && Object.hasOwn(priorities, input.priority)) setPriority(input.priority as keyof typeof priorities); else setPriority(priority);
    setPhase(restoreModuleValue(input.phase, phase));
    setModelDetail(restoreModuleValue(input.modelDetail, modelDetail));
    setCapabilities(restoreModuleValue(input.capabilities, capabilities));
  });

  const result = useMemo(() => {
    const active = Object.values(capabilities).filter(Boolean).length;
    const complexity = Math.min(5, Math.max(1, Math.ceil(area / 5000)));
    const informationMaturity = Math.min(96, 32 + active * 9 + (phase.includes("Uygulama") ? 8 : 0));
    const coordinationLoad = Math.min(100, 34 + complexity * 10 + active * 4);
    const gates = [
      { code: "G0", name: "Gereksinim", output: "OIR / AIR / PIR + kabul ölçütleri", status: "Kurulacak" },
      { code: "G1", name: "Fizibilite", output: "Koordinatlı parsel + alternatif kayıtları", status: capabilities.gis ? "Kapsamda" : "Eksik" },
      { code: "G2", name: "Koordinasyon", output: `${modelDetail} + çakışma / karar kaydı`, status: capabilities.bim ? "Kapsamda" : "Eksik" },
      { code: "G3", name: "Yapım", output: "4B / 5B / gerçeklik yakalama", status: capabilities.schedule || capabilities.reality ? "Kısmi" : "Eksik" },
      { code: "G4", name: "Teslim", output: "As-built + AIM + pasaport", status: capabilities.asset ? "Kapsamda" : "Eksik" },
    ];
    return { active, complexity, informationMaturity, coordinationLoad, gates, systems: systems[type], uses: priorities[priority].uses };
  }, [area, capabilities, modelDetail, phase, priority, type]);

  useEffect(() => { if (!draftReady) return; patchModule("digital-delivery-scope", { input: { type, area, priority, phase, modelDetail, capabilities }, result, status: "bep-scope-draft" }); }, [draftReady, area, capabilities, modelDetail, patchModule, phase, priority, result, type]);
  const exportScope = () => downloadTextFile("arkem-dijital-teslim-kapsami.json", JSON.stringify({ schema: "ARKEM-DIGITAL-DELIVERY/1.0", input: { type, area, priority, phase, modelDetail, capabilities }, result }, null, 2), "application/json");
  const importThreadScope = () => {
    if (thread.canonical.architecture.grossArea > 0) setArea(Math.round(thread.canonical.architecture.grossArea));
    const projectUse = deliveryUsageKey(thread.canonical.architecture.use);
    if (projectUse) setType(projectUse);
    setCapabilities((current) => ({ ...current, gis: thread.nodes.some((node) => node.id === "geo-parcel" && node.active), bim: thread.nodes.some((node) => node.id === "plan-editor" && node.active), cost: thread.nodes.some((node) => node.id === "arkem-x" && node.active), asset: thread.nodes.some((node) => node.id === "project-os" && node.active) }));
  };

  return <section className="innovation-lab innovation-lab-professional" aria-labelledby="innovation-lab-title">
    <div className="shell innovation-lab-shell">
      <ProjectKernelBar moduleKey="digital-delivery-scope" module="DIGITAL DELIVERY CONFIGURATOR" confidence="BEP kapsam taslağı" />
      <div className="innovation-lab-intro"><p className="eyebrow light">Dijital Teslim Yapılandırıcısı</p><h2 id="innovation-lab-title">Araç listesi değil,<br/><em>bilgi teslim planı.</em></h2><p>Proje aşaması, karar önceliği ve gerekli veri yetkinliklerini seçin; ISO 19650 mantığına yaklaşan teslim kapılarını, bilgi eksiklerini ve ilk BEP kapsamını görün.</p><small>Çıktı; sözleşmesel BEP, EIR, MIDP/TIDP veya işveren bilgi gereksinimi değildir. Proje ekibi ve sorumluluk matrisiyle doğrulanır.</small></div>
      <div className="innovation-thread-sync"><div><span>PROJECT THREAD / KAPSAM ÜRETİMİ</span><b>Aktif GIS, BIM, maliyet ve teslim modüllerini BEP taslağına bağlayın.</b></div><button className="thread-import-button primary" onClick={importThreadScope}>Proje zincirinden kapsam oluştur ↘</button></div>
      <div className="innovation-lab-panel">
        <div className="innovation-controls"><label><span>Yapı türü</span><select value={type} onChange={(event) => setType(event.target.value as keyof typeof systems)}><option value="konut">Konut / yaşam</option><option value="sanayi">Sanayi / depo</option><option value="ticari">Ticari / sosyal</option><option value="altyapi">Altyapı / özel yapı</option></select></label><label><span>Yaklaşık brüt alan</span><input type="number" min="100" max="200000" step="100" value={area} onChange={(event) => setArea(Number(event.target.value))}/><i>m²</i></label><label><span>Proje aşaması</span><select value={phase} onChange={(event) => setPhase(event.target.value)}><option>Fizibilite</option><option>Konsept / avan</option><option>Uygulama / koordinasyon</option><option>Yapım</option><option>Teslim / işletme</option></select></label><label><span>Model teslim seviyesi</span><select value={modelDetail} onChange={(event) => setModelDetail(event.target.value)}><option>LOD 200 / genel sistem</option><option>LOD 300 / koordinasyon</option><option>LOD 350 / arayüzler</option><option>LOD 400 / imalat</option><option>As-built / AIM</option></select></label><fieldset><legend>Birincil karar önceliği</legend>{Object.entries(priorities).map(([key, value]) => <button type="button" key={key} className={priority === key ? "active" : ""} onClick={() => setPriority(key as keyof typeof priorities)}>{value.label}</button>)}</fieldset><div className="innovation-capabilities"><span>PLANLANAN KAPSAM · belge doğrulaması değildir</span>{Object.entries({ gis: "GIS / parsel", bim: "OpenBIM", schedule: "4B program", cost: "5B maliyet", reality: "360° / nokta bulutu", asset: "AIM / varlık" }).map(([key, label]) => <button key={key} className={capabilities[key as keyof typeof capabilities] ? "active" : ""} onClick={() => setCapabilities((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))}><i>{capabilities[key as keyof typeof capabilities] ? "✓" : "+"}</i>{label}</button>)}</div></div>
        <div className="innovation-output" aria-live="polite"><div className="innovation-output-head"><span>ARKEM / DİJİTAL TESLİM KAPSAMI</span><b>{phase.toUpperCase()} · {area.toLocaleString("tr-TR")} m²</b></div><div className="innovation-score-row"><article><strong>%{result.informationMaturity}</strong><span>bilgi kapsamı</span></article><article><strong>{result.active}/6</strong><span>kapsama alınan alan</span></article><article><strong>{result.coordinationLoad}</strong><span>koordinasyon yükü</span></article></div><div className="innovation-gate-table">{result.gates.map((gate) => <article key={gate.code} className={gate.status === "Eksik" ? "risk" : ""}><b>{gate.code}</b><div><strong>{gate.name}</strong><small>{gate.output}</small></div><i>{gate.status}</i></article>)}</div><div className="innovation-use-cases"><span>ÖNCELİĞE BAĞLI KULLANIMLAR</span>{result.uses.map((item) => <p key={item}>→ {item}</p>)}</div><div className="innovation-system-list">{result.systems.map((system, index) => <div key={system}><span>0{index + 1}</span><b>{system}</b><small>{index === 0 ? "İlk teknik karşılaştırma" : "Alternatif sistem senaryosu"}</small></div>)}</div><button className="innovation-export" onClick={exportScope}>BEP kapsam taslağı / JSON ↓</button></div>
      </div>
    </div>
  </section>;
}

