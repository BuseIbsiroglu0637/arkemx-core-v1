"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { corporateRegistry } from "../data/corporate-registry";
import { localizedHref } from "../data/locale-routes";
import { navigationTree, site, socialChannels } from "../data/site";
import { LanguageSwitcher, useLanguage } from "./LanguageSystem";

const Arrow = () => <ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" />;

const englishNavigation: Record<string, { label: string; description: string }> = {
  HİZMETLER: { label: "SERVICES", description: "Choose the building system, engineering or delivery support your project needs." },
  "DİJİTAL ARAÇLAR": { label: "DIGITAL TOOLS", description: "Choose what you want to do without having to know the product or module name." },
  PROJELER: { label: "PROJECTS", description: "Selected work recorded with project identity, structural-system decisions, engineering scope and site evidence." },
  ARKEM: { label: "ABOUT", description: "The organisation, engineering approach and technical leadership behind ARKEM." },
  İLETİŞİM: { label: "CONTACT", description: "Send the project location, building type, stage and available technical documents." },
};

function routeIsCurrent(pathname: string, href: string, locale: "tr" | "en") {
  const localized = localizedHref(href, locale);
  return pathname === localized || pathname.startsWith(`${localized}/`);
}

function MobileNavigationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const { language, isEnglish, translate } = useLanguage();
  const pathname = usePathname() || "/";
  const locale = language === "en" ? "en" : "tr";
  const closeDrawer = useCallback(() => {
    setOpenMobileGroup(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [closeDrawer, open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="v4-mobile-nav-root" role="presentation">
    <button className="v4-mobile-nav-backdrop" type="button" onClick={closeDrawer} aria-label={isEnglish ? "Close menu" : "Menüyü kapat"} />
    <nav ref={dialog} id="v4-mobile-navigation" className="v4-mobile-nav" role="dialog" aria-modal="true" aria-label={isEnglish ? "Mobile navigation" : "Mobil navigasyon"}>
      <header>
        <Link href={isEnglish ? "/en" : "/"} onClick={closeDrawer} aria-label={isEnglish ? "ARKEM home" : "ARKEM ana sayfa"}><Logo variant="on-dark" /></Link>
        <div><LanguageSwitcher compact /><button ref={closeButton} type="button" onClick={closeDrawer} aria-label={isEnglish ? "Close menu" : "Menüyü kapat"}><X size={25} /></button></div>
      </header>
      <div className="v4-mobile-nav-groups">
        <div className="v117-mobile-priority" aria-label={isEnglish ? "Project shortcuts" : "Proje kısayolları"}>
          <Link href={isEnglish ? "/en/contact" : "/proje-baslat"} onClick={closeDrawer}><span>01</span><div><b>{isEnglish ? "Start a new project" : "Yeni proje başlat"}</b><small>{isEnglish ? "Tell us what you need" : "Teknik bilgi gerekmeden başlayın"}</small></div><Arrow /></Link>
          <Link href={isEnglish ? "/en/contact" : "/musteri-proje-portali"} onClick={closeDrawer}><span>02</span><div><b>{isEnglish ? "Continue my project" : "Projeme devam et"}</b><small>{isEnglish ? "Open project records" : "Sıradaki iş, kararlar ve dosyalar"}</small></div><Arrow /></Link>
        </div>
        {navigationTree.map((item, index) => {
          const translated = englishNavigation[item.label];
          const label = isEnglish ? translated.label : item.label;
          const description = isEnglish ? translated.description : item.description;
          const expanded = openMobileGroup === item.label;
          const hasSections = item.sections.length > 0;
          const childActive = item.sections.some((section) => section.items.some((child) => routeIsCurrent(pathname, child.href, locale)));
          const itemActive = routeIsCurrent(pathname, item.href, locale) || childActive;
          return <section key={item.href} className={expanded ? "is-open" : ""} data-current={itemActive ? "true" : undefined}>
            {hasSections ? <button type="button" aria-expanded={expanded} aria-controls={`v4-mobile-nav-${index}`} onClick={() => setOpenMobileGroup(expanded ? null : item.label)}>
              <span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b><ChevronDown size={20} aria-hidden="true" />
            </button> : <Link className="v117-mobile-direct" aria-current={itemActive ? "page" : undefined} href={localizedHref(item.href, locale)} onClick={closeDrawer}><span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b><Arrow /></Link>}
            {hasSections && expanded ? <div id={`v4-mobile-nav-${index}`} className="v4-mobile-nav-content">
              <p>{description}</p>
              <Link className="v4-mobile-overview" aria-current={routeIsCurrent(pathname, item.href, locale) ? "page" : undefined} href={localizedHref(item.href, locale)} onClick={closeDrawer}>{isEnglish ? "Overview" : "Genel bakış"} <Arrow /></Link>
              <div>{item.sections.map((section) => <section key={section.title}>
                <small>{isEnglish ? translate(section.title) : section.title}</small>
                {section.items.map((child) => <Link aria-current={routeIsCurrent(pathname, child.href, locale) ? "page" : undefined} href={localizedHref(child.href, locale)} onClick={closeDrawer} key={child.href}>
                  <b>{isEnglish ? translate(child.label) : child.label}</b><span>{isEnglish ? translate(child.note) : child.note}</span>
                </Link>)}
              </section>)}</div>
            </div> : null}
          </section>;
        })}
      </div>
      <footer>
        <div className="v4-mobile-social">{socialChannels.slice(0, 3).map((channel) => <a key={channel.label} href={channel.href} target="_blank" rel="noreferrer">{channel.label}</a>)}</div>
        <Link className="v4-mobile-project-cta" href={isEnglish ? "/en/contact" : "/proje-baslat"} onClick={closeDrawer}><b>{isEnglish ? "START A PROJECT" : "YENİ PROJE BAŞLAT"}</b><Arrow /></Link>
      </footer>
    </nav>
  </div>, document.body);
}

export function Logo({ variant = "on-light", footer = false }: { variant?: "on-light" | "on-dark"; footer?: boolean }) {
  const source = `/brand/arkem-logo-master.svg#${variant}`;
  return <span className={`official-logo${footer ? " official-logo-footer" : ""}`}><Image src={source} width={1441} height={472} sizes="(max-width: 960px) 154px, 184px" unoptimized draggable={false} alt="ARKEM Yapı Sistemleri" loading={footer ? "lazy" : "eager"} fetchPriority={footer ? "auto" : "high"} /></span>;
}

function MobileSiteHeader({ dark }: { dark: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { isEnglish } = useLanguage();
  const closeMobileMenu = useCallback(() => setMobileOpen(false), []);

  return <header className={`v4-mobile-site-header ${dark ? "is-dark" : "is-light"}`}>
    <Link className="v4-mobile-brand" href={isEnglish ? "/en" : "/"} aria-label={isEnglish ? "ARKEM home" : "ARKEM Yapı Sistemleri ana sayfa"}><Logo variant={dark ? "on-dark" : "on-light"} /></Link>
    <LanguageSwitcher compact />
    <button ref={trigger} className="v4-mobile-nav-trigger" type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-haspopup="dialog" aria-controls="v4-mobile-navigation" aria-label={isEnglish ? "Open menu" : "Menüyü aç"}><Menu size={25} strokeWidth={1.7} aria-hidden="true" /></button>
    <MobileNavigationDrawer open={mobileOpen} onClose={closeMobileMenu} />
  </header>;
}

export function SiteHeader({ dark = true }: { dark?: boolean }) {
  const [activeDesktopMenu, setActiveDesktopMenu] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { language, isEnglish, translate } = useLanguage();
  const pathname = usePathname() || "/";

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setActiveDesktopMenu(null);
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setActiveDesktopMenu(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, []);

  const homeHref = isEnglish ? "/en" : "/";
  const desktopNavigation = navigationTree;
  return <><header ref={headerRef} className={`nav shell site-nav v4-site-header v4-desktop-site-header ${dark ? "is-dark" : "is-light"}`} onMouseLeave={() => setActiveDesktopMenu(null)} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveDesktopMenu(null);
  }}>
    <Link className="brand" href={homeHref} aria-label={isEnglish ? "ARKEM home" : "ARKEM Yapı Sistemleri ana sayfa"}><Logo variant={dark ? "on-dark" : "on-light"} /></Link>
    <nav className="v4-desktop-navigation" aria-label={isEnglish ? "Primary navigation" : "Ana menü"}>
      {desktopNavigation.map((item, index) => {
        const translated = englishNavigation[item.label];
        const label = isEnglish ? translated.label : item.label;
        const localized = localizedHref(item.href, language === "en" ? "en" : "tr");
        const locale = language === "en" ? "en" : "tr";
        const childActive = item.sections.some((section) => section.items.some((child) => routeIsCurrent(pathname, child.href, locale)));
        const itemActive = routeIsCurrent(pathname, item.href, locale) || childActive;
        if (item.sections.length === 0) return <Link className="v4-nav-direct" data-current={itemActive ? "true" : undefined} aria-current={itemActive ? "page" : undefined} href={localized} key={item.href}>{label}</Link>;
        return <div className="v4-nav-group" data-current={itemActive ? "true" : undefined} key={item.href} onMouseEnter={() => setActiveDesktopMenu(item.label)} onFocus={() => setActiveDesktopMenu(item.label)}>
          <button type="button" aria-haspopup="true" aria-expanded={activeDesktopMenu === item.label} aria-controls={`v4-desktop-nav-${index}`} onClick={() => setActiveDesktopMenu((current) => current === item.label ? null : item.label)}>
            <span>{label}</span><ChevronDown size={14} aria-hidden="true" />
          </button>
          {activeDesktopMenu === item.label ? <div className="v4-mega-menu" id={`v4-desktop-nav-${index}`}>
            <div className="v4-mega-intro">
              <span>{String(index + 1).padStart(2, "0")}</span><h2>{label}</h2>
              <p>{isEnglish ? translated.description : item.description}</p>
              <Link aria-current={routeIsCurrent(pathname, item.href, locale) ? "page" : undefined} href={localizedHref(item.href, locale)} onClick={() => setActiveDesktopMenu(null)}>{isEnglish ? "View overview" : "Genel bakış"} <Arrow /></Link>
            </div>
            <div className="v4-mega-columns">{item.sections.map((section) => <section key={section.title}>
              <small>{isEnglish ? translate(section.title) : section.title}</small>
              {section.items.map((child) => <Link aria-current={routeIsCurrent(pathname, child.href, locale) ? "page" : undefined} href={localizedHref(child.href, locale)} onClick={() => setActiveDesktopMenu(null)} key={child.href}>
                <b>{isEnglish ? translate(child.label) : child.label}</b><span>{isEnglish ? translate(child.note) : child.note}</span>
              </Link>)}
            </section>)}</div>
          </div> : null}
        </div>;
      })}
    </nav>
    <Link className="v117-project-shortcut" href={isEnglish ? "/en/contact" : "/musteri-proje-portali"}>{isEnglish ? "MY PROJECT" : "PROJEM"}</Link>
    <LanguageSwitcher compact />
    <Link className="v4-nav-cta" data-analytics="guided_project_start" href={isEnglish ? "/en/contact" : "/proje-baslat"}><b>{isEnglish ? "START A PROJECT" : "YENİ PROJE BAŞLAT"}</b><Arrow /></Link>
  </header>{activeDesktopMenu ? <button className="v118-menu-backdrop" type="button" onClick={() => setActiveDesktopMenu(null)} aria-label={isEnglish ? "Close navigation menu" : "Açılır menüyü kapat"} /> : null}<MobileSiteHeader dark={dark} /></>;
}

const footerGroups = [
  { title: "Projeler", english: "Projects", links: [
    { label: "Seçilmiş Projeler", english: "Selected Projects", href: "/#proje-deneyimi" },
    { label: "Proje Arşivi", english: "Project Archive", href: "/projeler" },
  ] },
  { title: "Yapı Sistemleri", english: "Building Systems", links: [
    { label: "Betonarme Prefabrik", english: "Precast Concrete", href: "/yapi-sistemleri/betonarme-prefabrik" },
    { label: "Yapısal Çelik", english: "Structural Steel", href: "/yapi-sistemleri/celik" },
    { label: "Hafif Çelik", english: "Light-gauge Steel", href: "/yapi-sistemleri/hafif-celik" },
    { label: "Hibrit Sistemler", english: "Hybrid Systems", href: "/yapi-sistemleri/karma-sistem" },
  ] },
  { title: "Mühendislik", english: "Engineering", links: [
    { label: "Taşıyıcı Sistem Tasarımı", english: "Structural-system Design", href: "/muhendislik#tasiyici-sistem" },
    { label: "Statik Analiz", english: "Structural Analysis", href: "/muhendislik#statik-analiz" },
    { label: "Detay ve İmalat", english: "Detailing and Fabrication", href: "/muhendislik#imalat-cizimleri" },
    { label: "Saha Mühendisliği", english: "Site Engineering", href: "/muhendislik#saha" },
  ] },
  { title: "Dijital Araçlar", english: "Digital Tools", links: [
    { label: "Yeni Proje Başlat", english: "Start a New Project", href: "/proje-baslat" },
    { label: "Müşteri Proje Portalı", english: "Customer Project Portal", href: "/musteri-proje-portali" },
    { label: "Arsa Fizibilitesi", english: "Land Feasibility", href: "/arsa-fizibilite-studyosu" },
    { label: "Sistem Karşılaştırma", english: "System Comparison", href: "/yapi-sistemi-karsilastirma" },
    { label: "Proje Yönetim Alanı", english: "Project Management", href: "/proje-os" },
  ] },
  { title: "Kurumsal", english: "Corporate", links: [
    { label: "ARKEM", english: "About ARKEM", href: "/arkem" },
    { label: "Teknik Bilgiler", english: "Technical Resources", href: "/dokumanlar" },
    { label: "İletişim", english: "Contact", href: "/iletisim" },
  ] },
  { title: "İletişim", english: "Contact", links: [
    { label: site.phoneDisplay, english: site.phoneDisplay, href: `tel:${site.phoneHref}` },
    { label: "Serdivan · Sakarya", english: "Serdivan · Sakarya", href: "/iletisim" },
    { label: "Projenizi Gönderin", english: "Send Your Project", href: "/iletisim#proje-on-bilgisi" },
  ] },
] as const;

function FooterNavigationGroup({ group, isEnglish, locale }: { group: (typeof footerGroups)[number]; isEnglish: boolean; locale: "tr" | "en" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 601px)");
    const sync = () => setOpen(desktop.matches);
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  return <details className="v4-footer-accordion" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{isEnglish ? group.english : group.title}<ChevronDown size={18} aria-hidden="true" /></summary>
    <div>{group.links.map((item) => <Link key={item.href} href={item.href.startsWith("/") ? localizedHref(item.href, locale) : item.href}>{isEnglish ? item.english : item.label}</Link>)}</div>
  </details>;
}

export function SiteFooter() {
  const { language, isEnglish } = useLanguage();
  const locale = language === "en" ? "en" : "tr";
  return <footer className="v4-footer"><div className="shell v4-footer-statement"><span>ARKEM YAPI SİSTEMLERİ</span><h2>{isEnglish ? <>Engineering into delivery.<br /><em>Site experience into technology.</em></> : <>Mühendisliği uygulamaya.<br /><em>Uygulama deneyimini teknolojiye.</em></>}</h2><p>{isEnglish ? "PROJECT · ANALYSIS · DETAIL · PRODUCTION · SITE" : "PROJE · ANALİZ · DETAY · ÜRETİM · SAHA"}</p></div><div className="shell v4-footer-grid">
    <div className="v4-footer-identity"><Link className="brand footer-brand" href={isEnglish ? "/en" : "/"}><Logo variant="on-dark" footer /></Link><p>{isEnglish ? "Structural engineering, building systems and site delivery connected through one technical responsibility line." : "Betonarme prefabrik, çelik, hafif çelik ve hibrit sistemlerde mühendislikten sahaya bütünleşik çözüm."}</p><span>SAKARYA · TÜRKİYE</span></div>
    <div className="v4-footer-navigation">{footerGroups.map((group) => <FooterNavigationGroup group={group} isEnglish={isEnglish} locale={locale} key={group.title} />)}</div>
  </div>
  <div className="shell v4-footer-social"><span>@arkemyapisistemleri</span>{socialChannels.map((channel) => <a key={channel.label} href={channel.href} target="_blank" rel="noreferrer">{channel.label}</a>)}</div>
  {corporateRegistry.legalEntity.relationshipStatement ? <div className="shell v4-footer-legal"><p>{corporateRegistry.legalEntity.relationshipStatement}</p></div> : null}
  <div className="shell v4-footer-bottom"><span>© 2026 {corporateRegistry.brand.name}. {isEnglish ? "All rights reserved." : "Tüm hakları saklıdır."}</span><span>{site.location}</span></div></footer>;
}

export function FloatingContact() {
  const { isEnglish } = useLanguage();
  const pathname = usePathname();
  const [mobileVisible, setMobileVisible] = useState(false);
  const message = isEnglish ? "Hello ARKEM Yapı Sistemleri, I am contacting you through your website." : "Merhaba ARKEM Yapı Sistemleri, web siteniz üzerinden iletişime geçiyorum.";

  useEffect(() => {
    const updateVisibility = () => setMobileVisible(window.scrollY > Math.max(480, window.innerHeight * .68));
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  // The minimal ARKEMX toolbox home has no floating contact widget.
  if (pathname === "/" || pathname === "/proje-baslat" || pathname === "/dijital-proje-merkezi" || pathname === "/mimari-program-studyosu" || pathname === "/arsa-fizibilite-studyosu") return null;

  return <a className="floating-contact v4-floating-contact" data-mobile-visible={mobileVisible ? "true" : "false"} data-analytics="whatsapp_click" href={`https://wa.me/${site.whatsappHref}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" aria-label={isEnglish ? "Contact ARKEM via WhatsApp" : "ARKEM Yapı Sistemleri ile WhatsApp üzerinden iletişime geçin"}><MessageCircle className="v4-whatsapp-icon" size={22} strokeWidth={1.8} aria-hidden="true" /><b>WhatsApp</b><small>{isEnglish ? "Quick contact" : "Hızlı iletişim"}</small></a>;
}

export function SocialRail() { return null; }
