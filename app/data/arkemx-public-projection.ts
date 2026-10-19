import {
  arkemXModuleGroups,
  arkemXModuleRegistry,
  arkemXRegistryMeta,
} from "./arkemx-module-registry";
import type {
  PublicArkemXModule,
  PublicArkemXModuleGroup,
} from "./arkemx-public-types";

const isVerifiedVersion = (value: string) => /^v\d+(?:\.\d+)*(?:\s|$)/i.test(value);

export const publicArkemXModuleGroups: readonly PublicArkemXModuleGroup[] =
  arkemXModuleGroups.map((group) => ({
    id: group.id,
    code: group.code,
    title: group.title,
    statement: group.statement,
  }));

export const publicArkemXModules: readonly PublicArkemXModule[] =
  arkemXModuleRegistry
    .filter((module) => module.webVisible)
    .map((module) => ({
      id: module.id,
      code: module.code,
      title: module.title,
      groupId: module.groupId,
      status: module.status,
      version: isVerifiedVersion(module.version) ? module.version : null,
      shortDescription: module.description,
      problemSolved: module.problem,
      inputs: module.inputs,
      outputs: module.outputs,
      connectedModuleCodes: module.connectedModules,
      latestPublicUpdates: module.recentUpdates,
      publicValidationSummary: module.validationStatus,
      lastUpdated: module.lastUpdated,
      seoDescription: module.seoDescription,
    }));

export const publicArkemXRegistryMeta = {
  name: arkemXRegistryMeta.name,
  version: arkemXRegistryMeta.version,
  updatedAt: arkemXRegistryMeta.updatedAt,
  moduleCount: publicArkemXModules.length,
  groupCount: publicArkemXModuleGroups.length,
} as const;
