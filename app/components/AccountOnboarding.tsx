"use client";

import { FormEvent, useState } from "react";

export function AccountOnboarding({ displayName, email, returnTo = "/dijital-proje-merkezi" }: { displayName: string; email: string; returnTo?: string }) {
  const [form, setForm] = useState({ displayName, company: "", phone: "", preferredLanguage: "tr" });
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("Profil bilgilerinizi tamamlayarak kurulumu bitirin.");

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
    <header>
      <span>ADIM 2 / 3</span>
      <h2>Profil bilgilerinizi tamamlayın</h2>
      <p>{message}</p>
    </header>

    <div className="account-form-grid">
      <label>
        Ad soyad
        <input required autoComplete="name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })}/>
      </label>

      <label>
        E-posta
        <input readOnly value={email}/>
        <small>Güvenli oturum hesabınızla eşleştirilir.</small>
      </label>

      <label>
        Firma / kurum
        <input autoComplete="organization" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Varsa firma adı"/>
      </label>

      <label>
        Telefon
        <input autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+90 …"/>
      </label>
    </div>

    <button type="submit" disabled={state === "saving"}>
      {state === "saving" ? "Kurulum tamamlanıyor…" : "Kurulumu Tamamla"}
      <span aria-hidden="true">→</span>
    </button>
  </form>;
}
