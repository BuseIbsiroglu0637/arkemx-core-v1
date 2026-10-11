import type { ProjectThread } from "./project-graph.ts";

/** Portal status describes recorded controls, never the intended future output. */
export function portalStageStatus(thread: Pick<ProjectThread, "nodes" | "metrics">, journey: { completed: boolean[]; achieved: boolean[] }, approvedCount: number) {
  const milestone = (id: string) => thread.nodes.some(node => node.id === id && node.milestoneComplete);
  const architectureReady = journey.completed[2] === true && milestone("architectural-program") && milestone("plan-editor");
  const deliveryReady = journey.completed.slice(0, 6).length === 6 && journey.completed.slice(0, 6).every(Boolean)
    && milestone("digital-delivery-scope") && approvedCount === 4 && thread.metrics.critical === 0;
  return {
    architectureReady,
    deliveryReady,
    stages: journey.completed.map((complete, index) => {
      const done = index === 6 ? deliveryReady : index === 2 ? architectureReady : complete;
      return { done, label: done ? "Kontroller tamamlandı" : index === 6 ? "Teslim kontrolü ve onay bekleniyor" : journey.achieved[index] ? "Çalışıldı · kontrol bekliyor" : "Henüz başlanmadı" };
    }),
  };
}
