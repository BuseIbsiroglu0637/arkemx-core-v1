"use client";
import { useState, type FormEvent } from "react";
import { earnedValueFromProgress, trackingEvidence, type RegisterDraft, type TrackingEvidence, type TrackingPhase, type TrackingProgress } from "../lib/tracking-register";

export function TrackingRegisterForm({ kind, revision, onSave }: { kind: "Görev" | "Belge" | "Karar"; revision: string; onSave: (draft: RegisterDraft) => void }) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const get = (key: string) => String(data.get(key) ?? "").trim();
    try {
      const required = kind === "Belge" ? ["title", "code", "discipline", "due", "revision", "source"] : ["title", "owner", "due", "revision", "source"];
      if (!required.every(key => get(key))) throw new Error("Gerekli alanları doldurun.");
      onSave({ title: get("title"), owner: get("owner"), due: get("due"), code: get("code"), revision: get("revision"), discipline: get("discipline"), source: get("source"), impact: get("impact") });
      form.reset(); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Kayıt eklenemedi"); }
  }
  return <details className="arx-track-detail"><summary>{kind} ekle</summary><form className="arx-register-form" onSubmit={submit}>
    <label>{kind} adı<input name="title" required maxLength={240} /></label>
    {kind === "Belge" ? <><label>Belge kodu<input name="code" required maxLength={80} /></label><label>Disiplin<input name="discipline" required /></label></> : <label>Sorumlu<input name="owner" required /></label>}
    <label>{kind === "Belge" ? "Belge tarihi" : "Hedef tarih"}<input name="due" type="date" required /></label>
    <label>Revizyon<input name="revision" required defaultValue={revision} /></label>
    <label>Kaynak / dayanak<input name="source" required placeholder="Belge, pafta, tutanak veya kayıt referansı" /></label>
    {kind !== "Belge" ? <label>Program / kapsam etkisi<input name="impact" /></label> : null}
    {error ? <p role="alert">{error}</p> : null}<button type="submit">{kind} kaydet</button>
  </form></details>;
}

export function TrackingActionForm({ title, revision, onSave, onCancel }: { title: string; revision: string; onSave: (evidence: TrackingEvidence) => void; onCancel: () => void }) {
  const [error, setError] = useState("");
  return <form className="arx-register-form" aria-label="İşlem dayanağı" onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    try { onSave(trackingEvidence({ actor: String(data.get("actor")), reason: String(data.get("reason")), evidence: String(data.get("evidence")), revision })); }
    catch (error) { setError(error instanceof Error ? error.message : "İşlem kaydedilemedi"); }
  }}>
    <h3>{title}</h3><p>Bu kayıt beyan edilen kişi ve dayanağı saklar. Yetkili teknik onay ayrıca doğrulanmalıdır.</p>
    <label>İşlem yapan kişi<input name="actor" required /></label>
    <label>Gerekçe / sonuç<textarea name="reason" required /></label>
    <label>Dayanak referansı<input name="evidence" required /></label>
    {error ? <p role="alert">{error}</p> : null}<button type="submit">İşlemi kaydet</button><button type="button" onClick={onCancel}>Vazgeç</button>
  </form>;
}

export function TrackingEvidenceView({ value }: { value?: TrackingEvidence }) {
  return value ? <small>{value.actor} · {value.at} · {value.revision}<br />{value.reason} · Dayanak: {value.evidence}</small> : <small>İşlem dayanağı kayıtlı değil — doğrulanacak</small>;
}

export function TrackingPhaseForm({ revision, onSave }: { revision: string; onSave: (phase: TrackingPhase) => void }) {
  const [error, setError] = useState("");
  return <details><summary>Program aktivitesi ekle</summary><form className="arx-register-form" onSubmit={event => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const get = (key: string) => String(data.get(key) ?? "").trim();
    if (get("end") < get("start")) { setError("Bitiş tarihi başlangıçtan önce olamaz."); return; }
    onSave({ id: crypto.randomUUID(), name: get("name"), owner: get("owner"), start: get("start"), end: get("end"), progress: Number(get("progress")), source: get("source"), revision });
    form.reset(); setError("");
  }}>
    <label>Aktivite adı<input name="name" required /></label><label>Aktivite sorumlusu<input name="owner" required /></label>
    <label>Başlangıç tarihi<input name="start" type="date" required /></label><label>Bitiş tarihi<input name="end" type="date" required /></label>
    <label>Aktivite ilerlemesi %<input name="progress" type="number" min="0" max="100" required /></label><label>Program dayanağı<input name="source" required /></label>
    {error ? <p role="alert">{error}</p> : null}<button type="submit">Aktivite kaydet</button>
  </form></details>;
}

export function TrackingProgressForm({ revision, value, onSave }: { revision: string; value: TrackingProgress | null; onSave: (value: TrackingProgress) => void }) {
  const [error, setError] = useState("");
  return <details><summary>İlerleme ve maliyet kaydı</summary><form className="arx-register-form" onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "").trim();
    try {
      const next = { actual: Number(get("actual")), planned: Number(get("planned")), budget: Number(get("budget")), actualCost: Number(get("actualCost")), week: Number(get("week")), evidence: trackingEvidence({ actor: get("actor"), reason: get("reason"), evidence: get("source"), revision }) };
      earnedValueFromProgress(next); onSave(next); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Kayıt geçersiz"); }
  }}>
    <p>Beyan edilen proje verisi. Bütçe ve maliyet aynı kapsam ve para biriminde, milyon TL olarak girilmeli.</p>
    <label>Gerçekleşen ilerleme %<input name="actual" type="number" min="0" max="100" step="any" required defaultValue={value?.actual} /></label>
    <label>Planlanan ilerleme %<input name="planned" type="number" min="0" max="100" step="any" required defaultValue={value?.planned} /></label>
    <label>Toplam bütçe milyon TL<input name="budget" type="number" min="0.000001" step="any" required defaultValue={value?.budget} /></label>
    <label>Gerçek maliyet milyon TL<input name="actualCost" type="number" min="0" step="any" required defaultValue={value?.actualCost} /></label>
    <label>Rapor haftası<input name="week" type="number" min="0" step="1" required defaultValue={value?.week} /></label>
    <label>Kaydı giren kişi<input name="actor" required /></label><label>Kayıt açıklaması<input name="reason" required /></label><label>İlerleme ve maliyet dayanağı<input name="source" required /></label>
    {error ? <p role="alert">{error}</p> : null}<button type="submit">İlerleme kaydet</button>
  </form></details>;
}
