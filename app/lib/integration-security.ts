export type IntegrationSecurityState = "live-local" | "protocol-required" | "credential-required" | "project-setup";

export const INTEGRATION_SECURITY_REGISTRY = [
  { id: "geo-local", state: "live-local", sendsDataExternally: false, secretRequired: false, scope: "KML, GeoJSON, CSV ve kullanıcı koordinatı" },
  { id: "tkgm-cadastre", state: "protocol-required", sendsDataExternally: true, secretRequired: true, scope: "Resmî kadastro servis sözleşmesi" },
  { id: "photorealistic-tiles", state: "credential-required", sendsDataExternally: true, secretRequired: true, scope: "3B harita sağlayıcı anahtarı ve faturalandırma" },
  { id: "cde", state: "project-setup", sendsDataExternally: true, secretRequired: true, scope: "Kimlik, rol, saklama ve müşteri veri bölgesi" },
  { id: "dwg-converter", state: "credential-required", sendsDataExternally: true, secretRequired: true, scope: "Lisanslı DWG dönüşüm servisi" },
] as const satisfies ReadonlyArray<{
  id: string;
  state: IntegrationSecurityState;
  sendsDataExternally: boolean;
  secretRequired: boolean;
  scope: string;
}>;

export const PUBLIC_SECURITY_POSTURE = {
  schema: "ARKEM-INTEGRATION-SECURITY/1.0",
  secretsInClientBundle: false,
  externalWritesWithoutConsent: false,
  productionDataClassification: "project-specific configuration required",
  registry: INTEGRATION_SECURITY_REGISTRY,
};
