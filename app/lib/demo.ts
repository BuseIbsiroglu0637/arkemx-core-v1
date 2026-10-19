import type { ProjectKernelState } from "../components/ProjectKernel";

// This branch is an isolated demonstration build.
export const DEMO_ENABLED = true;
export const DEMO_STORAGE_KEY = "arkem-demo-v177-project";
export const DEMO_BACKUP_KEY = "arkem-demo-v177-backup";

export function isDemoRequestBlocked(pathname: string, method: string) {
  if (!DEMO_ENABLED) return false;
  const path = pathname.replace(/\/+$/, "");
  if (/^\/api\/(customer-workspace|project-intake|project-evidence)(\/|$)/.test(path)) return true;
  return path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function createDemoProject(): ProjectKernelState {
  const updatedAt = new Date().toISOString();
  const input = { name: "DEMO — Kastamonu Konut", projectType: "new", usage: "residential", location: "Kastamonu / Merkez", parcelStatus: "searching", targetArea: 600, floors: 2, floorHeight: 3, system: "undecided", priorities: ["cost", "safety"], budget: "undecided", timeline: "flexible", documents: [], experienceMode: "technical" };
  return {
    schema: "ARKEM-PROJECT/1.0", id: "DEMO-V177-KONUT", name: input.name,
    revision: "D01", phase: "Ön fizibilite", coordinateReference: "WGS84 / EPSG:4326", updatedAt,
    experience: { mode: "technical", autoHandoff: false, lastSynchronizedAt: "" },
    modules: {
      "decision-assistant": { input, status: "Örnek yatırım hedefi; gerçek başvuru değildir" },
      "geo-parcel": { reference: "DEMO — arsa aranıyor", province: "Kastamonu", district: "Merkez", parcelStatus: "searching", dataStatus: "Örnek bölge; resmî parsel ve imar verisi yok", usage: "Konut / Villa", floors: 2, floorHeight: 3 },
      "architectural-program": { input: { use: "residential", targetGross: 600, floors: 2, floorHeight: 3 }, spaces: [
        { id: "DEMO-SALON", code: "D-01", name: "Salon", zone: "Yaşam", count: 4, unitArea: 30, density: 10, daylight: true, accessible: true },
        { id: "DEMO-ODA", code: "D-02", name: "Yatak odası", zone: "Özel", count: 8, unitArea: 16, density: 10, daylight: true, accessible: true },
        { id: "DEMO-MUTFAK", code: "D-03", name: "Mutfak", zone: "Yaşam", count: 4, unitArea: 14, density: 10, daylight: true, accessible: true }
      ], needsReview: true, status: "Örnek mahal listesi; hesap ve uzman incelemesi bekliyor" }
    },
    events: [{ id: "demo-created", module: "decision-assistant", action: "create", revision: "D01", timestamp: updatedAt }]
  };
}
