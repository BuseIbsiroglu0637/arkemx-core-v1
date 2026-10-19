export type ParcelEdge = { length: number; road: boolean; roadWidth?: number; direction: string };

export function analyzeParcelEdges(edges: ParcelEdge[]) {
  const roadEdges = edges.filter((edge) => edge.road);
  const frontage = roadEdges.reduce((sum, edge) => sum + edge.length, 0);
  const cornerParcel = roadEdges.length > 1;
  const primaryRoad = [...roadEdges].sort((a, b) => (b.roadWidth ?? 0) - (a.roadWidth ?? 0) || b.length - a.length)[0] ?? null;
  return {
    schema: "ARKEM-PARCEL-EDGE/1.0",
    edgeCount: edges.length,
    roadEdgeCount: roadEdges.length,
    frontage,
    cornerParcel,
    primaryRoad,
    decisions: [
      cornerParcel ? "Birden fazla yol cephesi nedeniyle ön/yan bahçe yorumu yetkili idareden doğrulanmalıdır." : "Tek yol cephesi varsayımı kaynak pafta üzerinde doğrulanmalıdır.",
      primaryRoad ? `${primaryRoad.roadWidth ?? 0} m yol genişliği; kotlandırma, yaklaşma ve otopark giriş kararında ana referanstır.` : "Yol cephesi tanımlanmadan yerleşim zarfı resmî kabul edilmez.",
    ],
    limitation: "Kavramsal sınır/cephe analizidir; kadastro, halihazır, yol projesi ve aplikasyon verisiyle doğrulanır.",
  };
}
