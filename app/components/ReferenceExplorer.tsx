"use client";
import { ContentImage } from "./ContentImage";

import Link from "next/link";
import { useMemo, useState } from "react";
import { referenceRecords } from "../data/references";

const filters = ["Tümü", "3B Model", "PDF", "Video"] as const;

export function ReferenceExplorer() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("Tümü");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const normalized = query.toLocaleLowerCase("tr-TR").trim();
    return referenceRecords.filter((record) =>
      (filter === "Tümü" || record.types.includes(filter)) &&
      (!normalized || `${record.title} ${record.category} ${record.summary}`.toLocaleLowerCase("tr-TR").includes(normalized)),
    );
  }, [filter, query]);

  return <div className="reference-explorer">
    <div className="reference-tools"><label><span className="sr-only">Proje arşivinde ara</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Proje veya çalışma türü ara…" /></label><div className="reference-filters" aria-label="Arşiv türü">{filters.map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
    <div className="reference-summary"><span aria-live="polite">{visible.length} doğrulanmış arşiv kaydı</span><small>Yalnızca mevcut dosyalarla doğrulanabilen içerikler gösterilir.</small></div>
    <div className="reference-card-grid">{visible.map((record) => <article key={record.slug}><Link className="reference-card-image" href={`/referanslar/${record.slug}`}><ContentImage src={record.image} alt={record.imageAlt}/><span>Detay kaydını aç ↗</span></Link><div className="reference-card-body"><div className="reference-type-list">{record.types.map((type) => <span key={type}>{type}</span>)}</div><p className="eyebrow">{record.category}</p><h2>{record.title}</h2><p>{record.summary}</p><small>{record.archiveMeta}</small><Link href={`/referanslar/${record.slug}`}>Doğrulanmış içeriği inceleyin <span aria-hidden="true">↗</span></Link></div></article>)}</div>
    {!visible.length && <div className="empty-state"><h2>Eşleşen kayıt bulunamadı.</h2><p>Arama ifadenizi veya arşiv türünü değiştirin.</p></div>}
  </div>;
}
