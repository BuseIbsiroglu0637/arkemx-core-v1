export type PublicArkemXModuleStatus =
  | "AKTİF"
  | "AKTİF · GELİŞTİRİLİYOR"
  | "DOĞRULANIYOR"
  | "GELİŞTİRME PROGRAMINDA";

export type PublicArkemXModuleGroupId =
  | "modelleme-analiz"
  | "tasiyici-sistemler"
  | "temel-uretim"
  | "ekonomi-kontrol"
  | "yapim";

export type PublicArkemXModuleGroup = {
  id: PublicArkemXModuleGroupId;
  code: string;
  title: string;
  statement: string;
};

export type PublicArkemXModule = {
  id: string;
  code: string;
  title: string;
  groupId: PublicArkemXModuleGroupId;
  status: PublicArkemXModuleStatus;
  version: string | null;
  shortDescription: string;
  problemSolved: string;
  inputs: readonly string[];
  outputs: readonly string[];
  connectedModuleCodes: readonly string[];
  latestPublicUpdates: readonly string[];
  publicValidationSummary: string;
  lastUpdated: string;
  seoDescription: string;
};

export type PublicArkemXNavigationItem = Pick<
  PublicArkemXModule,
  "id" | "code" | "title" | "status"
>;
