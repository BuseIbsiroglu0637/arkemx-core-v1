"use client";

import { FormEvent, useState } from "react";

export function AccountOnboarding({ displayName, email, returnTo = "/dijital-proje-merkezi" }: { displayName: string; email: string; returnTo?: string }) {
  const [form, setForm] = useState({ displayName, company: "", phone: "", preferredLanguage: "tr" });
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("Zorunlu alanları tamamlayarak Arkem proje hesabınızı oluşturun.");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("saving");
    setMessage("Hesabınız hazırlanıyor…");
    const response = await fetch("/api/customer-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "profile", ...form }),
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(body.error || "Hesap oluşturulamadı. Lütfen tekrar deneyin.");
      return;
    }
    window.location.assign(returnTo);
  };

  return <form className="account-onboarding-form" onSubmit={submit}>
    <header><span>HESAP BİLGİLERİ</span><h2>Proje çalışma alanınızı oluşturun.</h2><p>{message}</p></header>
    <div className="account-form-grid">
      <label>Ad soyad<input required autoComplete="name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })}/></label>
      <label>E-posta<input readOnly value={email}/><small>Güvenli oturum kimliğinizle eşleştirilir.</small></label>
      <label>Firma / kurum<input autoComplete="organization" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Varsa firma adı"/></label>
      <label>Telefon<input autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+90 …"/></label>
      <label>Tercih edilen dil<select value={form.preferredLanguage} onChange={(event) => setForm({ ...form, preferredLanguage: event.target.value })}><option value="tr">Türkçe</option><option value="en">English</option><option value="az">Azərbaycanca</option><option value="ru">Русский</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="it">Italiano</option></select></label>
    </div>
    <label className="account-consent"><input required type="checkbox"/><span>Proje ve görüşme kayıtlarımın hesabımla ilişkilendirilmesini kabul ediyorum.</span></label>
    <button type="submit" disabled={state === "saving"}>{state === "saving" ? "Hesap hazırlanıyor…" : "Arkem hesabımı oluştur"} <span>→</span></button>
  </form>;
}
