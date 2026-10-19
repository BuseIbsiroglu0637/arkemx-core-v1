"use client";

type ArkemAnalyticsEvent = {
  event: "arkem_interaction";
  arkem_event: string;
  arkem_context?: string;
  page_path: string;
};

export const ARKEM_ANALYTICS_EVENTS = {
  heroCta: "hero_cta",
  projectOpen: "project_open",
  systemOpen: "system_open",
  engineeringOpen: "engineering_open",
  arkemxOpen: "arkemx_open",
  arkemxModuleOpen: "arkemx_module_open",
  projectFilePrepare: "project_file_prepare",
  projectBriefSubmit: "project_brief_submit",
  phoneClick: "phone_click",
  emailClick: "email_click",
  whatsappClick: "whatsapp_click",
  languageChange: "language_change",
} as const;

declare global {
  interface Window {
    __arkemV21AnalyticsReady?: boolean;
    dataLayer?: ArkemAnalyticsEvent[];
  }
}

function publish(name: string, context?: string) {
  const entry: ArkemAnalyticsEvent = {
    event: "arkem_interaction",
    arkem_event: name,
    page_path: window.location.pathname,
  };
  if (context) entry.arkem_context = context;
  window.dataLayer ??= [];
  window.dataLayer.push(entry);
  document.documentElement.dataset.analyticsLastEvent = name;
  window.dispatchEvent(new CustomEvent("arkem:analytics", { detail: entry }));
}

function initializeAnalytics() {
  if (window.__arkemV21AnalyticsReady) return;
  window.__arkemV21AnalyticsReady = true;
  window.dataLayer ??= [];
  document.documentElement.dataset.analyticsReady = "true";

  let lastArkemxView = "";
  const trackArkemxPage = () => {
    const pageKey = window.location.pathname + window.location.search;
    if (window.location.pathname !== "/arkemx" || lastArkemxView === pageKey) return;
    lastArkemxView = pageKey;
    publish("arkemx_page_view");
  };

  document.addEventListener("click", (event) => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-analytics]") : null;
    if (!node) return;
    publish(node.dataset.analytics ?? "interaction", node.dataset.analyticsContext);
  });

  document.addEventListener("toggle", (event) => {
    const node = event.target;
    if (!(node instanceof HTMLDetailsElement) || !node.open || !node.dataset.moduleId) return;
    publish("arkemx_module_open", node.dataset.moduleId);
  }, true);

  window.addEventListener("arkem:track", (event) => {
    const detail = (event as CustomEvent<{ name?: string; context?: string }>).detail;
    if (detail?.name) publish(detail.name, detail.context);
  });

  (["pushState", "replaceState"] as const).forEach((method) => {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History[typeof method]>) {
      const result = original.apply(this, args);
      queueMicrotask(trackArkemxPage);
      return result;
    } as History[typeof method];
  });
  window.addEventListener("popstate", trackArkemxPage);
  trackArkemxPage();
}

if (typeof window !== "undefined") initializeAnalytics();

export function V21Analytics() {
  return null;
}
