export function createZoningEnvelope(input: {
  parcelWidth: number; parcelDepth: number; front: number; side: number; rear: number;
  parcelArea: number; taks: number; kaks: number; hmax: number; typicalFloorHeight: number;
}) {
  const buildableWidth = Math.max(0, input.parcelWidth - input.side * 2);
  const buildableDepth = Math.max(0, input.parcelDepth - input.front - input.rear);
  const setbackFootprint = buildableWidth * buildableDepth;
  const taksFootprint = input.parcelArea * input.taks;
  const footprint = Math.min(setbackFootprint, taksFootprint);
  const areaFloors = footprint > 0 ? Math.max(1, Math.floor((input.parcelArea * input.kaks) / footprint)) : 0;
  const heightFloors = Math.max(0, Math.floor(input.hmax / input.typicalFloorHeight));
  const floors = Math.min(areaFloors, heightFloors);
  return {
    schema: "ARKEM-ZONING-ENVELOPE/1.0",
    buildableWidth, buildableDepth, footprint, floors,
    grossArea: footprint * floors,
    height: floors * input.typicalFloorHeight,
    constraints: {
      footprint: setbackFootprint <= taksFootprint ? "setback" : "taks",
      floors: areaFloors <= heightFloors ? "kaks" : "hmax",
    },
    limitation: "Kavramsal 3B yapı zarfıdır; kotlandırma, yol cephesi, plan notu, yangın, otopark ve ruhsat hükümleri ayrıca doğrulanır.",
  };
}
