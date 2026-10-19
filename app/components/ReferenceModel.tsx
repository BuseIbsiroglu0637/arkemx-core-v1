'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Download, Maximize2, RotateCcw, X } from 'lucide-react';
import type { PresentationImage, PresentationModel } from '../data/project-presentations';
import type { ReferenceViewer, ReferenceView, ReferenceLayer } from '../lib/reference-model-viewer';

export function ReferenceModel({ model, poster, title }: { model: PresentationModel; poster: PresentationImage; title: string }) {
  const host = useRef<HTMLDivElement>(null), wrapper = useRef<HTMLDivElement>(null), viewer = useRef<ReferenceViewer | null>(null);
  const [requested, setRequested] = useState(false), [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [view, setView] = useState<ReferenceView>('perspective');
  const [layer, setLayer] = useState<ReferenceLayer>('architecture');
  const [snapshot, setSnapshot] = useState<string | null>(null);
  useEffect(() => {
    if (!requested || !host.current) return;
    const controller = new AbortController();
    let local: ReferenceViewer | null = null;
    setState('loading');
    setView('perspective'); setLayer('architecture'); setSnapshot(null);
    const mountedHost = host.current;
    import('../lib/reference-model-viewer').then(module => {
      if (controller.signal.aborted || !mountedHost.isConnected || host.current !== mountedHost) throw new DOMException('Aborted', 'AbortError');
      return module.createReferenceViewer(mountedHost, model, controller.signal, () => { if (!controller.signal.aborted) setState('error'); });
    })
      .then(instance => { local = instance; if (controller.signal.aborted) { instance.dispose(); return; } viewer.current = instance; setState('ready'); })
      .catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => { controller.abort(); local?.dispose(); viewer.current = null; };
  }, [requested, model.src, model.bytes, model.upAxis, model.layers]);
  const selectView = (value: ReferenceView) => { setView(value); viewer.current?.setView(value); };
  const saveImage = () => { if (viewer.current) setSnapshot(viewer.current.capture()); };
  const downloadSize = model.bytes < 100_000 ? `${Math.ceil(model.bytes / 1000)} KB` : `${(model.bytes / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
  const close = () => { if (document.fullscreenElement === wrapper.current) void document.exitFullscreen().catch(() => {}); setRequested(false); setState('idle'); setView('perspective'); setLayer('architecture'); };
  return <div className="ref-model" ref={wrapper}>
    <div className="ref-model-toolbar"><span><Box size={17} aria-hidden="true" />{model.label}</span><div>
      {model.layers === 'isil-villa' && (['architecture', 'structure'] as const).map(value => <button type="button" key={value} disabled={state !== 'ready'} aria-pressed={layer === value} onClick={() => { setLayer(value); viewer.current?.setLayer(value); }}>{value === 'architecture' ? 'Mimari' : 'Taşıyıcı'}</button>)}
      {(['perspective', 'top', 'front'] as const).map(value => <button type="button" key={value} disabled={state !== 'ready'} aria-pressed={view === value} onClick={() => selectView(value)}>{value === 'top' ? 'Üstten' : value === 'front' ? 'Cephe' : 'Perspektif'}</button>)}
      <button type="button" disabled={state !== 'ready'} aria-label="Modeli başlangıç görünümüne getir" onClick={() => selectView('perspective')}><RotateCcw size={17} /></button>
      <button type="button" disabled={state !== 'ready'} aria-label="3B sunum görünüşünü kaydet" onClick={saveImage}><Download size={17} /></button>
      <button type="button" aria-label="Modeli tam ekran aç" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void wrapper.current?.requestFullscreen?.().catch(() => {}); }}><Maximize2 size={17} /></button>
      {requested && <button type="button" aria-label="3B modeli kapat" onClick={close}><X size={17} /></button>}
    </div></div>
    <div className="ref-model-stage" tabIndex={state === 'ready' ? 0 : -1} role="region" aria-label={`${title} etkileşimli 3B model. Ok tuşlarıyla döndürün, artı ve eksiyle yakınlaştırın.`} onKeyDown={event => { if (state === 'ready' && ['ArrowLeft', 'ArrowRight', '+', '=', '-'].includes(event.key)) { event.preventDefault(); viewer.current?.move(event.key); } }}>
      <div className="ref-model-canvas" ref={host} />
      {state !== 'ready' && <div className="ref-model-poster"><img src={poster.src} alt={poster.alt} loading="lazy" /><div>
        {state === 'idle' ? <button type="button" className="ref-solid-button" onClick={() => setRequested(true)}><Box size={19} aria-hidden="true" />3B modeli aç <small>{downloadSize}</small></button> : state === 'loading' ? <p role="status">Model hazırlanıyor…</p> : <><p role="alert">3B görünüm bu cihazda açılamadı. Galerideki görselleri inceleyebilirsiniz.</p><button type="button" onClick={close}>Görsele dön</button></>}
      </div></div>}
    </div>
    <p className="ref-model-help">{state === 'ready' ? 'Sürükleyin: döndür · Kaydırın: yakınlaş · Sağ tuş: kaydır · Klavye: ← → + −' : 'Model yalnız siz açtığınızda indirilir. Galeri, 3B desteği olmayan cihazlarda da kullanılabilir.'}</p>
    {snapshot && <div className="ref-snapshot"><p>Seçtiğiniz açıdan 3B sunum · uygulama veya imalat belgesi değildir.</p><img src={snapshot} alt="Oluşturulan 3B sunum görünüşü" /><a href={snapshot} download="arkem-3b-sunum.png">Görünüşü indir</a><button type="button" onClick={() => setSnapshot(null)}>Görünüşü kapat</button></div>}
  </div>;
}
