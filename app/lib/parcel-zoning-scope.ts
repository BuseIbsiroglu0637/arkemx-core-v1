import type { ZoningForm } from './zoning';

export type ParcelPlanningDraft = {
  mode?: 'zoning' | 'concept';
  zoning: ZoningForm;
  parkingPer100: number;
  inputsConfirmed: boolean;
  netPlotArea: number | null;
  netAreaBasis: string;
};
export type ParcelPlanningScopes = Record<string, ParcelPlanningDraft>;

export function emptyParcelPlanning(): ParcelPlanningDraft {
  return {
    mode: 'zoning',
    zoning: {
      landUse: 'Kullanıcı girişi bekleniyor', planName: '', planScale: '', planId: '',
      buildingOrder: '', taks: 0, kaks: 0, hmax: 0,
      frontSetback: -1, sideSetback: -1, rearSetback: -1,
      planNoteReference: '', sourceUrl: '', sourceDocument: '', verification: 'user-declared',
    },
    parkingPer100: 0,
    inputsConfirmed: false,
    netPlotArea: null,
    netAreaBasis: '',
  };
}

export function planningForParcel(scopes: ParcelPlanningScopes, identityKey: string): ParcelPlanningDraft {
  return scopes[identityKey] ?? emptyParcelPlanning();
}

export function planningInputsReady(draft: ParcelPlanningDraft): boolean {
  const z = draft.zoning;
  return draft.inputsConfirmed === true
    && typeof draft.netPlotArea === 'number' && Number.isFinite(draft.netPlotArea) && draft.netPlotArea > 0 && draft.netPlotArea <= 1e8
    && typeof draft.netAreaBasis === 'string' && draft.netAreaBasis.trim().length > 0
    && Number.isFinite(z.taks) && z.taks > 0 && z.taks <= 1
    && Number.isFinite(z.kaks) && z.kaks > 0 && z.kaks <= 10
    && Number.isFinite(z.hmax) && z.hmax > 0 && z.hmax <= 250
    && [z.frontSetback, z.sideSetback, z.rearSetback].every(n => Number.isFinite(n) && n >= 0 && n <= 100)
    && Number.isFinite(draft.parkingPer100) && draft.parkingPer100 >= 0 && draft.parkingPer100 <= 10;
}

export function parcelDesignReady(projectEligible: boolean, geometryValid: boolean, draft: ParcelPlanningDraft): boolean {
  return projectEligible && geometryValid && (draft.mode === 'concept' || planningInputsReady(draft));
}

/** Restore only the explicitly identity-keyed schema; never bind legacy planning to a new parcel. */
export function restorePlanningScopes(value: unknown): ParcelPlanningScopes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: ParcelPlanningScopes = {};
  for (const [key, raw] of Object.entries(value)) {
    try {
      const identity = JSON.parse(key);
      if (!Array.isArray(identity) || identity.length !== 5 || identity.some(v => typeof v !== 'string' || !v.trim())) continue;
    } catch { continue; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Partial<ParcelPlanningDraft>;
    if (!item.zoning || typeof item.zoning !== 'object') continue;
    const defaults = emptyParcelPlanning();
    const fields = Object.keys(defaults.zoning) as (keyof ZoningForm)[];
    if (fields.some(field => typeof item.zoning![field] !== typeof defaults.zoning[field]
      || (typeof item.zoning![field] === 'number' && !Number.isFinite(item.zoning![field])))) continue;
    if (!['user-declared', 'municipal-viewer', 'approved-plan', 'certified-document'].includes(item.zoning.verification)) continue;
    if (typeof item.parkingPer100 !== 'number' || !Number.isFinite(item.parkingPer100)) continue;
    result[key] = { mode: item.mode === 'concept' ? 'concept' : 'zoning', zoning: { ...item.zoning }, parkingPer100: item.parkingPer100, inputsConfirmed: item.inputsConfirmed === true,
      netPlotArea: typeof item.netPlotArea === 'number' && Number.isFinite(item.netPlotArea) && item.netPlotArea > 0 && item.netPlotArea <= 1e8 ? item.netPlotArea : null,
      netAreaBasis: typeof item.netAreaBasis === 'string' ? item.netAreaBasis.slice(0, 300) : '',
    };
  }
  return result;
}
