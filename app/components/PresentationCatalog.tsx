'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Box, Search } from 'lucide-react';
import { projectPresentations, presentationKindLabel } from '../data/project-presentations';
import { ProjectPhoto } from './ProjectPhoto';

export function PresentationCatalog({ modelsOnly = false, legacy = [] }: { modelsOnly?: boolean; legacy?: { slug: string; title: string; src: string; summary: string }[] }) {
  const [category, setCategory] = useState('Tümü'), [query, setQuery] = useState(''), [limit, setLimit] = useState(12), [only3d, setOnly3d] = useState(modelsOnly);
  const items = useMemo(() => [
    ...projectPresentations.map(p => ({ slug: p.slug, title: p.title, src: p.cover.src, alt: p.cover.alt, summary: p.summary, category: p.category, tags: [p.category, ...(p.tags || [])], kind: p.cover.kind, hasModel: !!p.model })),
    ...legacy.filter(p => !projectPresentations.some(item => item.slug === p.slug)).map(p => ({ ...p, alt: p.title, category: 'Tarımsal', tags: ['Tarımsal'], kind: 'model' as const, hasModel: false })),
  ], [legacy]);
  const normalized = (value: string) => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ı', 'i');
  const candidates = items.filter(p => !only3d || p.hasModel);
  const categories = ['Tümü', ...Array.from(new Set(candidates.flatMap(p => p.tags)))];
  const active = categories.includes(category) ? category : 'Tümü';
  const results = candidates.filter(p => (active === 'Tümü' || p.tags.includes(active)) && normalized(`${p.title} ${p.tags.join(' ')} ${p.summary}`).includes(normalized(query.trim())));
  return <div className="ref-catalog" id="proje-katalogu">
    <div className="ref-catalog-tools"><label className="ref-search"><Search size={19} aria-hidden="true" /><span className="sr-only">Proje adı veya yapı türü ara</span><input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(12); }} placeholder="Proje adı veya yapı türü arayın" /></label>{!modelsOnly && <label className="ref-model-filter"><input type="checkbox" checked={only3d} onChange={e => { setOnly3d(e.target.checked); setLimit(12); }} /><Box size={17} aria-hidden="true" />Yalnız etkileşimli 3B</label>}</div>
    <div className="ref-category-filters" aria-label="Sistem veya kullanım alanına göre filtrele">{categories.map(name => <button key={name} type="button" aria-pressed={active === name} onClick={() => { setCategory(name); setLimit(12); }}>{name}<span>{name === 'Tümü' ? candidates.length : candidates.filter(p => p.tags.includes(name)).length}</span></button>)}</div>
    <p className="ref-results" role="status">{results.length} proje / arşiv sunumu{query ? ` · “${query}”` : ''}</p>
    {results.length ? <div className="ref-catalog-grid">{results.slice(0, limit).map(p => <article className="ref-project-card" key={p.slug}>
      <Link className={`ref-card-image is-${p.kind}`} href={`/projeler/${p.slug}`} aria-label={`${p.title} projesini incele`}><ProjectPhoto src={p.src} alt={p.alt} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" /><span>{presentationKindLabel(p.kind)}</span>{p.hasModel && <b><Box size={15} aria-hidden="true" />3B</b>}</Link>
      <div className="ref-card-copy"><small>{p.category}</small><h2><Link href={`/projeler/${p.slug}`}>{p.title}</Link></h2><p>{p.summary}</p><Link className="ref-card-link" href={`/projeler/${p.slug}`}>Projeyi keşfet <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
    </article>)}</div> : <div className="ref-empty"><h3>Bu seçimle eşleşen proje bulunamadı.</h3><p>Farklı bir kelime deneyin veya filtreleri temizleyin.</p><button type="button" onClick={() => { setQuery(''); setCategory('Tümü'); setOnly3d(modelsOnly); }}>Filtreleri temizle</button></div>}
    {results.length > limit && <button className="ref-load-more" type="button" onClick={() => setLimit(value => value + 12)}>Daha fazla proje göster <span>{results.length - limit} kayıt daha</span></button>}
  </div>;
}
