export type ProjectOperatingWorkType = "task" | "rfi" | "decision" | "ncr" | "procurement";
export type ProjectOperatingWorkStatus = "open" | "in-review" | "blocked" | "closed";

type ClashLike = {
  guid?: string;
  title?: string;
  severity?: string;
  disciplines?: string[];
  location?: string;
  assignee?: string;
  sourceRefs?: string[];
};

export type ProjectOperatingModelInput = {
  projectId: string;
  projectRevision: string;
  generatedAt?: string;
  bimCoordination?: {
    schema?: string;
    clashes?: ClashLike[];
    schedule4D?: { totalWeeks?: number; phases?: unknown[] };
    cost5D?: { linkedQuantities?: boolean; relativeStructuralCost?: number };
  };
};

export type ProjectOperatingWorkItem = {
  id: string;
  type: ProjectOperatingWorkType;
  title: string;
  owner: string;
  dueDate: string;
  status: ProjectOperatingWorkStatus;
  priority: "critical" | "high" | "normal";
  revision: string;
  source: string;
  sourceGuid?: string;
  location?: string;
  disciplines: string[];
  scheduleImpact: string;
  costImpact: string;
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function createProjectOperatingModel(input: ProjectOperatingModelInput) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const revision = text(input.projectRevision, "P01");
  const coordination = input.bimCoordination ?? {};
  const clashes = Array.isArray(coordination.clashes) ? coordination.clashes : [];
  const coordinationConnected = coordination.schema === "ARKEM-BIM-COORDINATION/3.0";

  const clashWork: ProjectOperatingWorkItem[] = clashes.map((clash, index) => {
    const guid = text(clash.guid, `BCF-${String(index + 1).padStart(3, "0")}`);
    const critical = clash.severity === "critical";
    return {
      id: `RFI-${String(41 + index).padStart(3, "0")}`,
      type: "rfi",
      title: text(clash.title, "Koordinasyon issue incelemesi"),
      owner: text(clash.assignee, "BIM Koordinatörü"),
      dueDate: addDays(generatedAt, critical ? 2 : 5),
      status: critical ? "blocked" : "open",
      priority: critical ? "critical" : clash.severity === "high" ? "high" : "normal",
      revision,
      source: "V115 BIM koordinasyon issue kaydı",
      sourceGuid: guid,
      location: text(clash.location, "Model konumu bekleniyor"),
      disciplines: Array.isArray(clash.disciplines) ? clash.disciplines.filter(Boolean) : [],
      scheduleImpact: critical ? "Kritik yol kontrolü gerekli" : "Aktivite etkisi incelenecek",
      costImpact: "Değişiklik kararı sonrası değerlendirilecek",
    };
  });

  const workItems: ProjectOperatingWorkItem[] = [
    ...clashWork,
    {
      id: "TASK-116-01",
      type: "task",
      title: "Cephe paneli teknik onay paketini tamamla",
      owner: "Mimari Koordinatör",
      dueDate: addDays(generatedAt, 3),
      status: "in-review",
      priority: "high",
      revision,
      source: "PKG-04 tedarik paketi",
      disciplines: ["ARC", "PROC"],
      scheduleImpact: "Montaj başlangıcı +4 gün riski",
      costImpact: "Eşdeğer ürün karşılaştırması açık",
    },
    {
      id: "NCR-116-02",
      type: "ncr",
      title: "Aks C ankraj düşeylik toleransını doğrula",
      owner: "Saha Kalite Mühendisi",
      dueDate: addDays(generatedAt, 1),
      status: "open",
      priority: "critical",
      revision,
      source: "360° saha kalite kaydı",
      location: "Aks C / temel kotu",
      disciplines: ["STR", "FIELD"],
      scheduleImpact: "Kolon montajı öncesi kapatılmalı",
      costImpact: "Düzeltme yöntemi bekleniyor",
    },
    {
      id: "DEC-116-03",
      type: "decision",
      title: "Yükleme kapısı ürün ve termin kararını kilitle",
      owner: "İşveren Temsilcisi",
      dueDate: addDays(generatedAt, 4),
      status: "open",
      priority: "high",
      revision,
      source: "PKG-09 karar kaydı",
      disciplines: ["CLIENT", "PROC"],
      scheduleImpact: "Uzun terminli paket",
      costImpact: "Teklif karşılaştırması açık",
    },
  ];

  const completeOwnership = workItems.every((item) => Boolean(item.owner && item.dueDate && item.revision && item.source));
  const criticalOpen = workItems.filter((item) => item.priority === "critical" && item.status !== "closed").length;

  return {
    schema: "ARKEM-PROJECT-OS/2.0" as const,
    project: { id: input.projectId, revision, generatedAt },
    source: {
      coordinationConnected,
      coordinationSchema: coordination.schema ?? "missing",
      dataStatus: "project-kernel-derived" as const,
    },
    workItems,
    revisions: [
      { code: revision, title: "Koordinasyon ve proje kontrolü güncel çalışma kaydı", status: "current" as const, source: "Project Kernel", publishedAt: generatedAt },
      { code: "P03", title: "Önceki koordinasyon ve karar kaydı", status: "obsolete" as const, source: "CDE revizyon geçmişi", supersededBy: revision },
      { code: "R05", title: "Çelik genel yerleşim", status: "current" as const, source: "V115 federasyon manifestosu", publishedAt: generatedAt },
    ],
    healthGates: [
      { code: "OS-116-OWNER-DUE", label: "Sorumlu ve hedef tarih", status: completeOwnership ? "passed" as const : "blocked" as const, count: workItems.length },
      { code: "OS-116-CRITICAL", label: "Kritik açık işler", status: criticalOpen ? "attention" as const : "passed" as const, count: criticalOpen },
      { code: "OS-116-REVISION", label: "Güncel revizyon ayrımı", status: "passed" as const, count: 1 },
      { code: "OS-116-EVIDENCE", label: "Kaynak ve kanıt izi", status: coordinationConnected ? "passed" as const : "attention" as const, count: clashes.length },
    ],
    links: {
      schedule4D: { connected: Boolean(coordination.schedule4D?.totalWeeks), totalWeeks: coordination.schedule4D?.totalWeeks ?? 0, phaseCount: coordination.schedule4D?.phases?.length ?? 0 },
      cost5D: { connected: coordination.cost5D?.linkedQuantities === true, relativeStructuralCost: coordination.cost5D?.relativeStructuralCost ?? 0 },
    },
    views: {
      customer: { label: "Müşteri", focus: ["karar", "onay", "teslim"] },
      manager: { label: "Proje yöneticisi", focus: ["sorumlu", "termin", "sapma", "bütçe"] },
      discipline: { label: "Disiplin ekibi", focus: ["RFI", "revizyon", "model konumu"] },
      field: { label: "Saha", focus: ["görev", "kalite", "kanıt", "kapanış"] },
    },
    limitations: [
      "Bu tarayıcı prototipi kurumsal CDE veya sözleşmesel kayıt sistemi değildir.",
      "4B ve 5B göstergeleri onaylı iş programı, hakediş veya kesin maliyet hesabı değildir.",
      "Hesap bağlantısı yoksa kayıt bu cihazda tutulur; kurumsal sunucu ve yetkilendirme ayrıca yapılandırılmalıdır.",
    ],
  };
}
