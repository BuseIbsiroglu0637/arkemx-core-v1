import { parcelPreviewPoints } from '../lib/parcel-experience';
import type { GeoPoint } from '../lib/geo';

export function ParcelBoundaryPreview({ points, eligible, label }: { points: GeoPoint[]; eligible: boolean; label: string }) {
  const shape = eligible ? parcelPreviewPoints(points) : null;
  return <figure className="parcel-boundary-preview" data-has-boundary={Boolean(shape)}>
    {shape ? <svg viewBox="0 0 200 200" role="img" aria-label={`${label}: kaynak geometrisinin sınır önizlemesi`}><title>Kaynak parsel geometrisi · aplikasyon değildir</title><polygon points={shape} /><text x="180" y="16">K ↑</text></svg> : <div className="parcel-boundary-empty"><b>Sınır bekleniyor</b><small>Henüz bu parsele bağlı geçerli geometri yok.</small></div>}
    <figcaption>{shape ? 'Kaynak sınır önizlemesi · ölçekli aplikasyon değildir' : 'Konum işareti, parsel sınırı anlamına gelmez.'}</figcaption>
  </figure>;
}
