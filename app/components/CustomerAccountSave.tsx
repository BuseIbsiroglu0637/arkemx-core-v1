"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useProjectKernel, type ProjectKernelState } from "./ProjectKernel";
import { readAccountRevision, rememberAccountRevision } from "../lib/customer-account-revision";
import { accountProjectsFromResponse, accountSavedAt } from "../lib/account-response";

export function CustomerAccountSave({ projectOverride, returnTo = "/arkemx" }: { projectOverride?: ProjectKernelState; returnTo?: string } = {}) {
  const kernel = useProjectKernel();
  const { hydrated, persistence } = kernel;
  const project = projectOverride ?? kernel.project;
  const [state, setState] = useState<"idle" | "saving" | "saved" | "login" | "conflict" | "error">("idle");
  const [savedContent, setSavedContent] = useState("");
  const baseline = useRef<{ id: string; updatedAt: string } | null>(null);
  const busy = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");
  const content = JSON.stringify(project);
  async function save() {
    if (busy.current || !hydrated) return;
    busy.current = true;
    setState("saving");
    setErrorMessage("");
    try {
      if (new TextEncoder().encode(content).byteLength > 300_000) { setErrorMessage("Proje kaydı 300 KB sınırını aşıyor. Dosyaları proje verisinin içine gömmeyin; belge yükleme alanını kullanın."); setState("error"); return; }
      const loaded = await fetch("/api/customer-workspace", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (loaded.status === 401) { setState("login"); return; }
      if (!loaded.ok) throw new Error();
      const projects = accountProjectsFromResponse(await loaded.json());
      const existing = projects.find(item => item.id === project.id);
      const knownRevision = baseline.current?.id === project.id ? baseline.current.updatedAt : readAccountRevision(project.id);
      if (existing?.payload && JSON.stringify(existing.payload) === content) {
        baseline.current = { id: project.id, updatedAt: existing.updatedAt };
        rememberAccountRevision(project.id, existing.updatedAt);
        setSavedContent(content); setState("saved"); return;
      }
      if (existing && knownRevision !== existing.updatedAt) {
        setState("conflict"); return;
      }
      const response = await fetch("/api/customer-workspace", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000), body: JSON.stringify({ action: "project", id: project.id, name: project.name, phase: project.phase, revision: project.revision, payload: project, expectedAccountUpdatedAt: existing?.updatedAt ?? null }) });
      if (response.status === 401) { setState("login"); return; }
      if (response.status === 409) { setState("conflict"); return; }
      if (response.status === 413) { setErrorMessage("Proje verisi boyut sınırını aşıyor. Belge dosyalarını ayrı yükleyin."); setState("error"); return; }
      if (response.status === 503) { setErrorMessage("Hesap kayıt hizmeti şu anda kullanılamıyor. Bilgileriniz bu ekranda korunuyor; daha sonra tekrar deneyin."); setState("error"); return; }
      if (!response.ok) throw new Error();
      const savedAt = accountSavedAt(await response.json());
      baseline.current = { id: project.id, updatedAt: savedAt };
      rememberAccountRevision(project.id, savedAt);
      setSavedContent(content);
      setState("saved");
    } catch { setErrorMessage("Kayıt yanıtı alınamadı. Kaydın durumunu projelerinizden kontrol edebilir veya yeniden deneyebilirsiniz; açık bilgileriniz korunuyor."); setState("error"); } finally { busy.current = false; }
  }
  const isSaved = state === "saved" && content === savedContent;
  return <div className="customer-save"><div><b>{isSaved ? "Bu sürüm hesabınıza kaydedildi." : projectOverride ? "Ayrı ihtiyaç dosyanız bu ekranda açık; henüz hesabınıza kaydedilmedi." : persistence.state === "unavailable" ? "Bu tarayıcı taslağı saklayamıyor." : "Taslağınız bu cihazda tutuluyor."}</b><p>Başka cihazdan devam etmek için değişikliklerinizi hesabınıza kaydedin. Hesap kaydı inceleme başvurusu değildir.</p></div><button type="button" onClick={save} disabled={!hydrated || state === "saving" || isSaved}>{state === "saving" ? "Kaydediliyor…" : isSaved ? "Hesaba kaydedildi" : "Hesabıma kaydet"}</button><div role="status">{state === "login" && <a href={`/hesap-baglantisi?return_to=${encodeURIComponent(returnTo)}`} target="_top">Giriş yapıp çalışmama dön</a>}{state === "conflict" && <p>Hesabınızda farklı bir sürüm var. Hiçbir kaydın üzerine yazılmadı. <Link href="/musteri-proje-portali">Sürümleri karşılaştır</Link></p>}{state === "error" && <p>{errorMessage || "Kayıt tamamlanamadı. Açık bilgileriniz korunuyor."} <Link href="/musteri-proje-portali">Hesaptaki projelerimi kontrol et</Link></p>}</div></div>;
}
