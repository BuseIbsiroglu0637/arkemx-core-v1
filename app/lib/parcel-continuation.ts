import { parcelIdentityKey } from './parcel-record.ts';
export type ParcelContinuation = {
  schema: 'ARKEM-PARCEL-CONTINUATION/1'; projectId: string; identityKey: string; reference: string;
  selectedMassingId: string; sourceSignature: string; sourceRevision: string; mode: 'concept'|'zoning';
  authoritative: false; zoningPending: boolean; parcelOnly?: boolean; boundaryArea: number; grossArea: number; footprint: number;
  floors: number; floorHeight: number; usage: string; system: string; width: number; depth: number; limitations: string[];
};
const record = (x: unknown): Record<string, any> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, any> : {};
export function parcelContinuationState(projectId: string, modules: Record<string, unknown>): { value: ParcelContinuation|null; stale: boolean } {
  const raw = record(modules['parcel-continuation']), geo = record(modules['geo-parcel']);
  const parcelOnly = raw.parcelOnly === true;
  if (raw.schema !== 'ARKEM-PARCEL-CONTINUATION/1' || raw.projectId !== projectId || raw.authoritative !== false
    || !['concept','zoning'].includes(raw.mode) || typeof raw.reference !== 'string' || typeof raw.sourceSignature !== 'string'
    || !['identityKey','sourceRevision','selectedMassingId','usage','system'].every(k => typeof raw[k] === 'string' && raw[k].length > 0 && raw[k].length < 1000)
    || !Number.isInteger(raw.floors) || raw.floors > 50 || typeof raw.zoningPending !== 'boolean'
    || !Array.isArray(raw.limitations) || raw.limitations.length > 30 || !raw.limitations.every((x: unknown)=>typeof x === 'string' && x.length < 4000)
    || !Number.isFinite(raw.boundaryArea) || raw.boundaryArea <= 0
    || !['grossArea','footprint','floors','floorHeight','width','depth'].every(k => Number.isFinite(raw[k]) && (parcelOnly ? raw[k] === 0 : raw[k] > 0))) return {value:null,stale:false};
  const identityKey = parcelIdentityKey({province:geo.province??'',district:geo.district??'',neighborhood:geo.neighborhood??'',block:geo.block??'',parcelNo:geo.parcelNo??''});
  const planningScope = record(geo.planningScopes)[identityKey];
  const effectiveMode = record(planningScope).mode ?? 'zoning';
  const modeMatches = raw.mode === effectiveMode && raw.zoningPending === (effectiveMode === 'concept' || record(planningScope).inputsConfirmed !== true);
  const signature = JSON.stringify([identityKey, geo.parcel, geo.building, planningScope, geo.usage, geo.system, geo.floors, geo.floorHeight]);
  const metrics = record(geo.metrics);
  const linkedNumbers = [[raw.grossArea,metrics.gross],[raw.footprint,metrics.footprint],[raw.boundaryArea,metrics.area],
    [raw.width,geo.buildingWidth ?? (parcelOnly ? 0 : NaN)],[raw.depth,geo.buildingDepth ?? (parcelOnly ? 0 : NaN)],[raw.floors,geo.floors ?? (parcelOnly ? 0 : NaN)],[raw.floorHeight,geo.floorHeight ?? (parcelOnly ? 0 : NaN)]];
  const valuesMatch = linkedNumbers.every(([a,b])=>Number.isFinite(b) && Math.abs(a-b) < 0.00001)
    && raw.selectedMassingId === geo.selectedMassingId && raw.usage === geo.usage && raw.system === geo.system;
  const geometryReady = metrics.geometryValid === true && record(geo.parcelRecord).projectEligible === true && Array.isArray(geo.parcel) && geo.parcel.length >= 3;
  const stateMatches = parcelOnly ? geometryReady && geo.hasPlacedModel === false && raw.selectedMassingId === 'none' && Array.isArray(geo.building) && geo.building.length === 0 : geo.designReady && metrics.buildingFits === true && geo.hasPlacedModel !== false;
  const stale = !stateMatches || geo.needsReview === true || !modeMatches || !valuesMatch || identityKey !== raw.identityKey || signature !== raw.sourceSignature;
  // Return an isolated snapshot. Consumers may show stale data, but may not calculate or apply it.
  return {value:structuredClone(raw) as ParcelContinuation,stale};
}
export function preliminaryCost(grossArea: number, unitRate: number|null) {
  return Number.isFinite(grossArea) && grossArea > 0 && unitRate !== null && Number.isFinite(unitRate) && unitRate > 0 && unitRate <= 1e8 ? grossArea * unitRate : null;
}
