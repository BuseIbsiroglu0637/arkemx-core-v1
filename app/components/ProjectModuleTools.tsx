"use client";

import Link from "next/link";
import { ArrowUpRight, Blocks, ClipboardList, DraftingCompass, FileBox, GitMerge, Layers3, Map, Scale, Wrench, type LucideIcon } from "lucide-react";
import { PROJECT_MODULES, type ProjectModuleKey } from "../lib/project-graph";
import { useProjectKernel } from "./ProjectKernel";

const icons: Record<ProjectModuleKey, LucideIcon> = {
  "decision-assistant": ClipboardList,
  "geo-parcel": Map,
  "quick-site-scenario": Blocks,
  "architectural-program": Layers3,
  "plan-editor": DraftingCompass,
  "system-comparison": Scale,
  "structural-concept": Blocks,
  "engineering-coordination": GitMerge,
  "digital-delivery-scope": FileBox,
  "arkem-x": Scale,
  "project-os": Wrench,
  "model-library-review": Layers3,
  "demolition-screening": Wrench,
};

const workspaceRoutes: Partial<Record<ProjectModuleKey, string>> = {
  "architectural-program": "/mimari-program-studyosu",
  "system-comparison": "/sistem-karsilastirma",
  "structural-concept": "/tasiyici-on-tasarim",
  "engineering-coordination": "/bim-koordinasyon",
  "project-os": "/proje-takibi",
};

export function ProjectModuleTools() {
  const { thread, hydrated } = useProjectKernel();
  return <section className="arx-module-tools" aria-labelledby="arx-module-tools-title" data-testid="project-module-tools">
    <div className="arx-module-tools-heading">
      <h2 id="arx-module-tools-title">{PROJECT_MODULES.length} proje modülü</h2>
      <p>Durumlar bu cihazdaki mevcut proje kaydına göre güncellenir.</p>
    </div>
    <div className="arx-simple-grid">
      {PROJECT_MODULES.map((module) => {
        const Icon = icons[module.id];
        const node = thread.nodes.find((item) => item.id === module.id);
        const state = !hydrated ? "loading" : node?.milestoneComplete ? "complete" : node?.active ? node.readiness < 100 ? "review" : "recorded" : "empty";
        const status = state === "loading" ? "Kontrol ediliyor" : state === "complete" ? "Aşama kontrolü geçti" : state === "review" ? "İnceleme bekliyor" : state === "recorded" ? "Kayıt var" : "Başlatılmadı";
        const missing = hydrated ? node?.blockedBy.map((id) => PROJECT_MODULES.find((item) => item.id === id)?.label).filter(Boolean) ?? [] : [];
        return <Link key={module.id} href={workspaceRoutes[module.id] ?? module.route} className="arx-simple-tool arx-module-tool" data-testid="project-module-card" data-module={module.id}>
          <span className="arx-simple-tool-icon"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="arx-simple-tool-content">
            <small>{module.code} · {module.stage}</small>
            <strong>{module.label}</strong>
            <span className="arx-module-output">{module.output}</span>
            <span className="arx-module-status" data-state={state}>{status}</span>
            {missing.length ? <small>Bekleyen veri: {missing.join(" · ")}</small> : null}
          </span>
          <ArrowUpRight className="arx-simple-tool-arrow" size={19} strokeWidth={1.7} aria-hidden="true" />
        </Link>;
      })}
    </div>
  </section>;
}
