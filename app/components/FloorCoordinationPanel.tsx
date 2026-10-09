"use client";

import { useState } from "react";
import Link from "next/link";
import { floorCoordinationBasis, inspectFloorCoordination, type FloorBeam, type FloorCoordinationSource } from "../lib/floor-coordination";
import { traceJson } from "../lib/structural-traceability";
import { projectIntegrityIssues } from "../lib/project-integrity";
import { useProjectKernel } from "./ProjectKernel";

type Plan = { floorPlates?: Array<{ level: number; width: number; depth: number }>; elements?: Array<{ id: string; type: string; level: number }>; floorCoordination?: FloorCoordinationSource };
const labels: Record<string, string> = { "aligned-candidate": "Geometrik eşleşme adayı", "ambiguous": "Birden fazla eşleşme", "transfer-review": "Alt kiriş üzerinde; transfer incelemesi gerekli", "no-support-source": "Alt katta destek kaynağı yok", "no-matching-beam-source": "Alt katta eşleşen kiriş yok" };

export function FloorCoordinationPanel({ editable = false }: { editable?: boolean }) {
  const { project } = useProjectKernel();
  const plan = (project.modules["plan-editor"] ?? {}) as Plan;
  const report = inspectFloorCoordination(plan), g = report.geometry;
  let basis = "";
  try { basis = floorCoordinationBasis(plan); } catch { /* Invalid source remains unavailable. */ }
  const coordinates = g?.floors.flatMap(f => [f.x, f.y, f.x + f.width, f.y + f.depth]) ?? [];
  const minX = g ? Math.min(...g.floors.map(f => f.x)) : 0, minY = g ? Math.min(...g.floors.map(f => f.y)) : 0;
  const width = g ? Math.max(...g.floors.map(f => f.x + f.width)) - minX : 1;
  const height = g ? Math.max(...g.floors.map(f => f.y + f.depth)) - minY : 1;
  const scale = Math.min(480 / width, 260 / height);
  const blocked = projectIntegrityIssues(project).some(i => i.startsWith("plan-editor:"));
  return <section className="engineering-panel" data-testid="floor-coordination-panel">
    <h2>Kat konumu ve taşıyıcı bağlantıları</h2>
    <p>Ortak proje koordinatları metre cinsindedir. X/Y eksenleri paraleldir; döndürülmüş plakalar desteklenmez. Eşleşme toleransı 1 mm; bu kontrol taşıma kapasitesi veya mühendislik onayı değildir.</p>
    <p role="status" data-testid="floor-coordination-status">{g ? "Ortak konum kaydedildi; yalnız geometrik kontrol." : "Ortak konum doğrulanacak."}</p>
    {report.issues.length > 0 && <ul>{report.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
    {g && <>
      <div style={{ overflowX: "auto" }}><table><caption>Ortak koordinatlarda kat yerleşimi (m)</caption><thead><tr><th>Kat</th><th>X</th><th>Y</th><th>Kot Z</th><th>Boyut</th></tr></thead><tbody>{g.floors.map(f => <tr key={f.level}><th scope="row">K{f.level}</th><td>{f.x}</td><td>{f.y}</td><td>{f.z}</td><td>{f.width} × {f.depth}</td></tr>)}</tbody></table></div>
      <p>{g.floors.map(f => <span key={f.level} style={{ display: "inline-block", marginRight: 16, color: f.level % 2 ? "#b96636" : "#173143" }}>K{f.level} · Z {f.z} m</span>)}</p>
      {coordinates.every(Number.isFinite) && Number.isFinite(scale) && <svg viewBox="0 0 560 330" role="img" aria-label="Katların ortak koordinatlarda üstten görünümü" style={{ width: "100%", maxWidth: 700 }}>
        {g.floors.map(f => <g key={f.level}><title>K{f.level} · Z {f.z} m</title><rect data-testid={`common-floor-${f.level}`} x={30 + (f.x - minX) * scale} y={30 + (f.y - minY) * scale} width={f.width * scale} height={f.depth * scale} fill="none" stroke={f.level % 2 ? "#b96636" : "#173143"} strokeWidth="2"/></g>)}
        {g.beams.map(b => <line key={b.id} x1={30 + (b.start.x - minX) * scale} y1={30 + (b.start.y - minY) * scale} x2={30 + (b.end.x - minX) * scale} y2={30 + (b.end.y - minY) * scale} stroke="#648993" strokeDasharray="4 3"/>)}
        {g.columns.map(c => <circle key={c.id} cx={30 + (c.x - minX) * scale} cy={30 + (c.y - minY) * scale} r="4" fill={c.level % 2 ? "#b96636" : "#173143"}><title>{c.id} · K{c.level} · ({c.x}, {c.y}, {c.z}) m</title></circle>)}
      </svg>}
      <ul data-testid="column-continuity-results">{g.columnLinks.map(link => <li key={link.upperColumnId}>{link.upperColumnId}: {labels[link.status]} · alt kolon: {link.lowerColumnIds.join(", ") || "—"} · alt kiriş: {link.transferBeamIds.join(", ") || "—"}</li>)}</ul>
      <ul data-testid="beam-continuity-results">{g.beamLinks.map(link => <li key={link.upperBeamId}>{link.upperBeamId}: {labels[link.status]} · alt kiriş: {link.lowerBeamIds.join(", ") || "—"}</li>)}</ul>
    </>}
    {editable && basis && !blocked && Array.isArray(plan.floorPlates) && <CoordinationEditor key={basis + traceJson(plan.floorCoordination ?? null)} plan={plan} basis={basis}/>}
    {editable && blocked && <p role="alert">Planın proje, revizyon veya birimleri geçersiz; kaynak kaydı düzeltilmeden koordinasyon kaydedilemez.</p>}
    {!editable && <p>Konum ve kiriş kaynaklarını Plan ve Aks ekranında düzenleyin. Kolonlar plan nesnelerinden alınır.</p>}
  </section>;
}

function CoordinationEditor({ plan, basis }: { plan: Plan; basis: string }) {
  const { patchModule } = useProjectKernel();
  const source = plan.floorCoordination;
  const [placements, setPlacements] = useState(() => plan.floorPlates!.map(f => {
    const saved = Array.isArray(source?.placements) ? source.placements.find(p => p.level === f.level) : undefined;
    return { level: f.level, x: saved ? String(saved.x) : "", y: saved ? String(saved.y) : "", z: saved ? String(saved.z) : "" };
  }));
  const [beams, setBeams] = useState<FloorBeam[]>(() => Array.isArray(source?.beams) ? source.beams : []);
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [error, setError] = useState("");
  const columns = Array.isArray(plan.elements) ? plan.elements.filter(e => e.type === "column") : [];
  const save = () => {
    if (placements.some(p => [p.x, p.y, p.z].some(v => !v.trim()))) { setError("Her katın X/Y/kot değerini açıkça girin; boş alan 0 kabul edilmez."); return; }
    const candidate: FloorCoordinationSource = { schema: "ARKEM-FLOOR-COORDINATION/1.0", basis, placements: placements.map(p => ({ level: p.level, x: Number(p.x), y: Number(p.y), z: Number(p.z) })), beams };
    const check = inspectFloorCoordination({ ...plan, floorCoordination: candidate });
    if (!check.geometry) { setError(check.issues.join(" ")); return; }
    patchModule("plan-editor", { floorCoordination: candidate });
  };
  const addBeam = () => {
    const a = columns.find(c => c.id === start), b = columns.find(c => c.id === end);
    if (!a || !b || a.id === b.id || a.level !== b.level || beams.some(beam => [beam.startColumnId, beam.endColumnId].includes(start) && [beam.startColumnId, beam.endColumnId].includes(end))) { setError("Aynı kattaki iki farklı kolonu seçin; kiriş bağlantısı tekrarlanamaz."); return; }
    setBeams(current => [...current, { id: `BEAM-${crypto.randomUUID()}`, startColumnId: start, endColumnId: end }]); setError("");
  };
  return <div data-testid="floor-coordination-editor">
    <h3>Kat konumlarını tanımla</h3>
    {placements.map(p => <fieldset key={p.level}><legend>K{p.level} · ortak proje koordinatları</legend><div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{(["x", "y", "z"] as const).map(axis => <label key={axis}>K{p.level} {axis === "z" ? "kot Z" : axis.toUpperCase()} (m)<input type="number" step="any" value={p[axis]} onChange={e => setPlacements(current => current.map(row => row.level === p.level ? { ...row, [axis]: e.target.value } : row))}/></label>)}</div></fieldset>)}
    <h3>Gerçek kolonlar arasında kiriş tanımla</h3>
    <p>Kolon kaynağı yoksa <Link href="/tasarim-calismalari/km-kr-kaynaklari">kolon kaynaklarını düzenleme ekranına</Link> gidin; ardından kat konumlarını inceleyip kaydedin. Burada otomatik kolon veya kiriş üretilmez.</p>
    <label>Başlangıç kolonu<select aria-label="Başlangıç kolonu" value={start} onChange={e => setStart(e.target.value)}><option value="">Seçin</option>{columns.map(c => <option key={c.id} value={c.id}>K{c.level} · {c.id}</option>)}</select></label>
    <label>Bitiş kolonu<select aria-label="Bitiş kolonu" value={end} onChange={e => setEnd(e.target.value)}><option value="">Seçin</option>{columns.map(c => <option key={c.id} value={c.id}>K{c.level} · {c.id}</option>)}</select></label>
    <button type="button" onClick={addBeam}>Kirişi taslağa ekle</button>
    <ul>{beams.map(b => <li key={b.id}>{b.id}: {b.startColumnId} → {b.endColumnId} <button type="button" aria-label={`${b.id} kirişini taslaktan kaldır`} onClick={() => setBeams(current => current.filter(item => item.id !== b.id))}>Kaldır</button></li>)}</ul>
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={save}>Kat konumlarını ve kirişleri kaydet</button>
    <p>Kaydetmek güncel plan geometrisi ve kolon kaynaklarıyla bağlantıyı yeniler. Kaynak değişirse tekrar inceleyip kaydedin.</p>
  </div>;
}
