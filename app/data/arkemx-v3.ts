export {
  arkemXCoreFamilies,
  arkemXProductGuardrails,
  arkemXValidationRecords,
} from "./arkemx-v22.ts";

export type { ArkemXDevelopmentStatus } from "./arkemx-v22.ts";

import {
  arkemXModuleGroups,
  arkemXModuleRegistry,
  arkemXRoadmap,
  type ArkemXModuleGroupId,
  type ArkemXModuleStatus,
} from "./arkemx-module-registry.ts";

export type ArkemXV3Status = ArkemXModuleStatus;

export type ArkemXProjectCategory = {
  id: ArkemXModuleGroupId;
  code: string;
  title: string;
  statement: string;
};

export type ArkemXProjectModule = {
  id: string;
  code: string;
  title: string;
  category: ArkemXModuleGroupId;
  version: string;
  problem: string;
  inputs: readonly string[];
  process: readonly string[];
  connections: readonly string[];
  outputs: readonly string[];
  status: ArkemXModuleStatus;
  boundary: string;
  capabilities: readonly string[];
  lastUpdated: string;
  validationStatus: string;
  dependencies: readonly string[];
  recentUpdates: readonly string[];
  workingRoute: string;
};

export const arkemXProjectCategories: readonly ArkemXProjectCategory[] = arkemXModuleGroups.map((group) => ({
  id: group.id,
  code: group.code,
  title: group.title,
  statement: group.statement,
}));

export const arkemXProjectModules: readonly ArkemXProjectModule[] = arkemXModuleRegistry.map((module) => ({
  id: module.id,
  code: module.code,
  title: module.title,
  category: module.groupId,
  version: module.version,
  problem: module.problem,
  inputs: module.inputs,
  process: module.process,
  connections: module.connections,
  outputs: module.outputs,
  status: module.status,
  boundary: module.boundary,
  capabilities: module.capabilities,
  lastUpdated: module.lastUpdated,
  validationStatus: module.validationStatus,
  dependencies: module.dependencies,
  recentUpdates: module.recentUpdates,
  workingRoute: module.workingRoute,
}));

export const arkemXIntegrationLayers = [
  {
    title: "BIM ve Veri Bağlantıları",
    role: "IFC, BIM, CAD, API ve diğer yazılımlarla veri alışverişini proje modüllerine bağlayan entegrasyon katmanı.",
    boundary: "Yalnız çalışan ve doğrulanmış entegrasyonlar mevcut özellik olarak yayımlanır.",
  },
] as const;

export const arkemXSharedServices = [
  {
    title: "Raporlama ve Dokümantasyon",
    role: "Her modülün kendi doğrulanmış verisinden analiz, kontrol, metraj ve teknik çıktı üretmesini sağlayan ortak platform servisi.",
    boundary: "Çıktı üretimi, ilgili mühendislik modülünün doğrulanma seviyesini aşamaz.",
  },
] as const;

export const arkemXDecisionEffects = [
  "Analiz modeli",
  "İç kuvvet ve davranış",
  "Malzeme miktarı",
  "Detay ve bağlantı",
  "Metraj",
  "Üretim verisi",
  "Rapor ve revizyon izi",
] as const;

export const arkemXConstructionStages = [
  "Üretim",
  "Taşıma",
  "Kaldırma",
  "Geçici sabitleme",
  "Montaj",
  "Nihai sistem",
] as const;

export const arkemXValidationPublication = {
  package: "ARKEMX doğrulama özeti",
  sourceStatus: "Kaynak manifestosu bekleniyor",
  verifiedOn: null,
  publishExactCounts: false,
  note: "Güncel sürüm, tarih ve kaynak manifestosu bağlanmadan kesin test sayıları yayımlanmaz.",
} as const;

export const arkemXDevelopmentRoadmap = arkemXRoadmap.map((item) => `${item.stage}: ${item.summary}`);
