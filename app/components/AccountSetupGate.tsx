"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountOnboarding } from "./AccountOnboarding";

type SetupState = "checking" | "setup" | "existing" | "error";

export function AccountSetupGate({
  displayName,
  email,
  returnTo,
  showExistingAccountChoice = false,
}: {
  displayName: string;
  email: string;
  returnTo: string;
  showExistingAccountChoice?: boolean;
}) {
  const [state, setState] = useState<SetupState>("checking");
  const [message, setMessage] = useState("Hesap bilgileri kontrol ediliyor…");

  const checkProfile = useCallback(async () => {
    setState("checking");
    setMessage("Hesap bilgileri kontrol ediliyor…");
    try {
      const response = await fetch("/api/customer-workspace", { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { profile?: unknown; error?: string };
      if (response.status === 401) {
        window.location.assign(`/giris?return_to=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (!response.ok) {
        setState("error");
        setMessage(
          response.status === 503
            ? "Oturum doğrulandı ancak hesap veritabanı bağlantısı hazır değil."
            : body.error || "Hesap bilgileri şu anda kontrol edilemiyor.",
        );
        return;
      }
      if (body.profile) {
        if (showExistingAccountChoice) {
          setState("existing");
          setMessage("ARKEMX hesabınız daha önce oluşturulmuş.");
          return;
        }
        window.location.replace(returnTo);
        return;
      }
      setState("setup");
      setMessage("Profil bilgilerinizi tamamlayarak kurulumu bitirin.");
    } catch {
      setState("error");
      setMessage("Hesap servisine bağlanılamadı. Lütfen tekrar deneyin.");
    }
  }, [returnTo, showExistingAccountChoice]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void checkProfile(); }, 0);
    return () => window.clearTimeout(timer);
  }, [checkProfile]);

  if (state === "checking") {
    return <div className="arx-setup-gate" role="status">
      <span>HESAP KONTROLÜ</span>
      <h2>Çalışma alanınız hazırlanıyor</h2>
      <p>{message}</p>
    </div>;
  }

  if (state === "existing") {
    return <div className="arx-setup-gate arx-setup-existing" role="status">
      <span>HESAP HAZIR</span>
      <h2>Hesabınız hazır</h2>
      <p>{message}</p>
      <div className="arx-setup-existing-actions single">
        <a href={returnTo}>Çalışma Alanına Git <span aria-hidden="true">→</span></a>
      </div>
    </div>;
  }

  if (state === "error") {
    return <div className="arx-setup-gate is-error" role="alert">
      <span>BAĞLANTI KONTROLÜ</span>
      <h2>Hesap bilgileri doğrulanamadı</h2>
      <p>{message}</p>
      <button type="button" onClick={() => { void checkProfile(); }}>Tekrar dene</button>
    </div>;
  }

  return <AccountOnboarding displayName={displayName} email={email} returnTo={returnTo} />;
}
