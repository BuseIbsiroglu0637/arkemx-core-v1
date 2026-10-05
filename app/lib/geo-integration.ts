export type GeoConnectorState = "live" | "user-file" | "external-link" | "credential-required" | "protocol-required";

export type GeoConnector = {
  id: "tkgm" | "files" | "maps" | "earth" | "terrain";
  label: string;
  state: GeoConnectorState;
  authority: string;
  purpose: string;
  boundary: string;
};

export const GEO_CONNECTORS: GeoConnector[] = [
  { id: "tkgm", label: "TKGM / MEGSİS", state: "live", authority: "TKGM açık servis yanıtı", purpose: "İdari seçim ve bilgilendirme sınırı", boundary: "Aplikasyon ve tapu kaydı değildir" },
  { id: "files", label: "KML · GeoJSON · CSV", state: "user-file", authority: "Kullanıcının sağladığı dosya", purpose: "Koordinatlı parsel ve kot verisi", boundary: "Kaynak CRS ve ölçüm statüsü kullanıcı tarafından doğrulanır" },
  { id: "maps", label: "Google Maps", state: "external-link", authority: "Google harita bağlantısı", purpose: "Konumu dış haritada inceleme", boundary: "Parsel sınırı veya imar verisi sağlamaz" },
  { id: "earth", label: "Google Earth / KML", state: "external-link", authority: "KML aktarım dosyası", purpose: "Parsel ve kütleyi coğrafi bağlamda inceleme", boundary: "Fotogerçekçi 3B Tiles için API anahtarı gerekir" },
  { id: "terrain", label: "Kurumsal WMS · 3B Tiles", state: "protocol-required", authority: "Yetkili kurum / lisanslı sağlayıcı", purpose: "Resmî katman ve fotogerçekçi arazi", boundary: "Protokol, lisans, anahtar ve faturalandırma olmadan etkin değildir" },
];

export function createGeoProvenance(input: {
  reference: string;
  sourceCrs: string;
  dataStatus: string;
  administrativeSource: "official" | "fallback";
  geometryValid: boolean;
  vertexCount: number;
}) {
  return {
    schema: "ARKEM-GEO-PROVENANCE/1.0",
    capturedAt: new Date().toISOString(),
    reference: input.reference,
    coordinateReferenceSystem: input.sourceCrs,
    declaredStatus: input.dataStatus,
    administrativeSource: input.administrativeSource === "official" ? "TKGM service response" : "offline selection list",
    geometry: { valid: input.geometryValid, vertexCount: input.vertexCount },
    officialCadastre: false,
    licensedSurvey: input.dataStatus === "Harita mühendisi ölçümü" || input.dataStatus === "Onaylı aplikasyon verisi",
    limitations: ["Tapu/kadastro kaydı değildir", "İmar uygunluk belgesi değildir", "Aplikasyon krokisi değildir"],
  };
}
