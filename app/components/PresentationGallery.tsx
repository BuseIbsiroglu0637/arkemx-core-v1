'use client';

import { useState } from 'react';
import { ProjectPhoto } from './ProjectPhoto';
import { presentationKindLabel, type PresentationImage } from '../data/project-presentations';

export function PresentationGallery({ images, title }: { images: PresentationImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const image = images[index] ?? images[0];
  return <div className="ref-gallery">
    <figure className={`ref-gallery-main is-${image.kind}`}><a href={image.src} target="_blank" rel="noreferrer" aria-label={`${image.caption} — büyük görseli yeni sekmede aç`}><ProjectPhoto src={image.src} alt={image.alt || title} natural priority /></a><figcaption><span>{presentationKindLabel(image.kind)}</span><strong>{image.caption}</strong><a href={image.src} target="_blank" rel="noreferrer">Büyüt ↗</a></figcaption></figure>
    {images.length > 1 && <div className="ref-gallery-thumbs" aria-label="Proje görselleri">{images.map((item, n) => <button type="button" key={`${item.src}-${n}`} aria-label={item.caption} aria-pressed={index === n} onClick={() => setIndex(n)}><ProjectPhoto src={item.src} alt="" /><span>{String(n+1).padStart(2, '0')} / {presentationKindLabel(item.kind)}</span></button>)}</div>}
  </div>;
}
