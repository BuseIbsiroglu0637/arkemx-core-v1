"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { translateText, type SiteLanguage } from "../data/i18n";
import {
  isLocaleVisible,
  localeEquivalent,
  localeRecord,
  routeLocale,
  visibleLocaleRecords,
} from "../data/locale-routes";

type LanguageContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
  isEnglish: boolean;
  translate: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * V4: Dil değişimi gerçek, eşdeğer locale rotaları arasında yapılır; seçim
 * kullanıcıyı ana sayfaya geri atmaz ve yalnız yayımlanan rotaları gösterir.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const language = routeLocale(pathname);
  const setLanguage = useCallback((nextLanguage: SiteLanguage) => {
    if (nextLanguage !== "tr" && nextLanguage !== "en") return;
    if (!isLocaleVisible(nextLanguage)) return;
    const target = localeEquivalent(pathname, nextLanguage);
    if (!target || target === pathname) return;
    window.dispatchEvent(new CustomEvent("arkem:track", { detail: { name: "language_change", context: nextLanguage } }));
    router.push(target);
  }, [pathname, router]);
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    isEnglish: language === "en",
    translate: (text) => translateText(text, language),
  }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname() || "/";
  const activeLocale = routeLocale(pathname);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const available = visibleLocaleRecords.flatMap((record) => {
    const href = localeEquivalent(pathname, record.id);
    return href ? [{ locale: record.id, href, code: record.code, label: record.label }] : [];
  });

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const active = localeRecord(activeLocale);
  if (available.length < 2) {
    const onlyVisible = available[0];
    if (onlyVisible && onlyVisible.locale !== activeLocale) {
      return <Link className="v4-language-static is-link" data-no-translate href={onlyVisible.href} hrefLang={onlyVisible.locale} aria-label={`${onlyVisible.label} dil sürümüne geç`}>{onlyVisible.code}</Link>;
    }
    return null;
  }

  if (!compact) return <div className="v4-language-list" data-no-translate aria-label="Dil / Language">
    {available.map((option) => <Link key={option.locale} href={option.href} hrefLang={option.locale} aria-current={option.locale === activeLocale ? "page" : undefined}>
      <b>{option.code}</b><span>{option.label}</span>
    </Link>)}
  </div>;

  return <div className="v4-language" ref={rootRef} data-no-translate>
    <button className="v4-language-trigger" type="button" aria-expanded={open} aria-haspopup="menu" aria-controls="v4-language-menu" onClick={() => setOpen((current) => !current)}>
      <b>{active.code}</b><span>{active.label}</span><i aria-hidden="true">⌄</i>
    </button>
    {open ? <div className="v4-language-menu" id="v4-language-menu" role="menu" aria-label="Dil / Language">
      {available.map((option) => <Link role="menuitem" key={option.locale} href={option.href} hrefLang={option.locale} aria-current={option.locale === activeLocale ? "page" : undefined} onClick={() => setOpen(false)}>
        <b>{option.code}</b><span>{option.label}</span>{option.locale === activeLocale ? <i aria-hidden="true">●</i> : null}
      </Link>)}
    </div> : null}
  </div>;
}
