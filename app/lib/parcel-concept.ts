import { polygonArea, type GeoPoint } from './geo.ts';
import { createZoningMassingModel, type ParcelFrontEdge } from './zoning-massing.ts';

/** Geometry-only ratios use the measured boundary, never unknown net zoning area. */
export function geometricAreaRatios(boundaryArea: number, footprint: number, grossArea: number) {
  if (![boundaryArea, footprint, grossArea].every(value => Number.isFinite(value) && value > 0)) return null;
  return { boundaryArea, coveragePercent: footprint / boundaryArea * 100, grossAreaRatio: grossArea / boundaryArea };
}

/** A design exercise, never stored in the parcel's zoning conditions or legal rights. */
export const CONCEPT_ASSUMPTIONS = 'Tasarım denemesi: sınır alanının en çok %35’i taban, en çok 2 kat ve tüm kenarlardan 3 m tasarım boşluğu. Bunlar imar koşulu değildir.';
export function createParcelConcept(reference: string, parcel: GeoPoint[], floorHeight: number, frontEdge: ParcelFrontEdge) {
  const model = createZoningMassingModel({ reference, parcel, floorHeight, frontEdge,
    netPlotArea: polygonArea(parcel),
    zoning: { taks: .35, kaks: .7, hmax: floorHeight * 2, frontSetback: 3, sideSetback: 3, rearSetback: 3, buildingOrder: 'Tasarım denemesi', verification: 'user-declared' },
  });
  return { ...model, conceptOnly: true, entitlementAvailable: false,
    alternatives: model.alternatives.map(a => ({ ...a, note: a.id === 'maximum-footprint' ? 'Daha geniş tekil taban; yatay kullanım ağırlıklı başlangıç.' : a.id === 'balanced' ? 'Açık alan ve yapı büyüklüğünü birlikte değerlendirin.' : 'Daha küçük yapı tabanı, daha geniş açık alan.',
      governingConstraint: 'tasarım varsayımları', checks: a.checks.map(c => ({ ...c, label: c.code === 'ZM-03' ? 'Deneme taban oranı' : c.code === 'ZM-04' ? 'Deneme alan sınırı' : c.code === 'ZM-05' ? 'Deneme kat sayısı' : c.label })) })),
    limitations: [CONCEPT_ASSUMPTIONS, 'İmar koşulları bilinmiyor. İnşa edilebilir alan, emsal dışı alan veya ruhsat uygunluğu hesaplanmış değildir.', ...model.limitations.slice(0, 2)],
  };
}
