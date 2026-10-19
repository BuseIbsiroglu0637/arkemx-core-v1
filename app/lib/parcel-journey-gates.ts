import type { ParcelIdentity } from './parcel-record';

export function isParcelIdentityReady(identity: ParcelIdentity) {
  return [identity.province, identity.district, identity.neighborhood].every(value => typeof value === 'string' && value.trim().length > 1 && !value.includes('proje notunda'))
    && /^\d{1,10}$/.test(identity.block) && /^\d{1,10}$/.test(identity.parcelNo);
}

export function parcelJourneyGate(index: number, identityReady: boolean, boundaryReady: boolean) {
  if (index === 0) return true;
  if (index === 2) return identityReady;
  return (index === 1 || index === 3) && boundaryReady;
}
