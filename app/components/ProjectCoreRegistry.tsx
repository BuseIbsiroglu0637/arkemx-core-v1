"use client";

import { useProjectKernel } from "./ProjectKernel";

const trustLabels = {
  verified: "Kaynağı doğrulandı",
  declared: "Kullanıcı beyanı",
  derived: "Modül hesabı",
  missing: "Bekleniyor",
} as const;

export function ProjectCoreRegistry({ compact = false }: { compact?: boolean }) {
  const { core } = useProjectKernel();

  return <section className={`project-core-registry${compact ? " compact" : ""}`} aria-label="Ortak proje verisi ve kaynak kaydı">
    <header>
      <div>
        <span>V106 / TEK PROJE VERİSİ</span>
        <h3>Alan bazlı kaynak ve güven durumu</h3>
        <p>Her bilgi tek bir sorumlu modüle, proje kimliğine ve revizyona bağlıdır.</p>
      </div>
      <aside aria-label={`Proje verisi yüzde ${core.metrics.completion} tamamlandı`}>
        <strong>%{core.metrics.completion}</strong>
        <span>{core.metrics.complete}/{core.metrics.total} alan hazır</span>
      </aside>
    </header>
    <div className="project-core-fields" tabIndex={compact ? 0 : undefined} aria-label="Proje veri alanları">
      {core.fields.map((item) => <article className={`trust-${item.trust}`} key={item.id}>
        <div><span>{item.label}</span><i>{trustLabels[item.trust]}</i></div>
        <strong>{item.value}</strong>
        <small><b>{item.sourceLabel}</b> · {item.boundary}</small>
      </article>)}
    </div>
    <footer>
      <span><i className="verified"/>Doğrulandı <b>{core.metrics.verified}</b></span>
      <span><i className="declared"/>Beyan <b>{core.metrics.declared}</b></span>
      <span><i className="derived"/>Hesap <b>{core.metrics.derived}</b></span>
      <span><i className="missing"/>Eksik <b>{core.metrics.missing}</b></span>
      <small>{core.projectId} · {core.projectRevision}</small>
    </footer>
  </section>;
}
