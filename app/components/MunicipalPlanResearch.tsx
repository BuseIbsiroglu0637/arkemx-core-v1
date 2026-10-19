"use client";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProjectKernel } from './ProjectKernel';
import { parcelIdentityKey, type ParcelIdentity } from '../lib/parcel-record';
import type { GeoPoint } from '../lib/geo';
import { normalizeZoningPlace } from '../data/zoning-regions';
import { resolveZoningPortal } from '../data/zoning-authorities';
import { canCommitMunicipalResearch, createMunicipalResearchClient, createMunicipalResearchScope, municipalResearchKey, municipalResearchState, type MunicipalResearchResult } from '../lib/municipal-plan-research';

export type Result = MunicipalResearchResult;
const queryMunicipalPlans = createMunicipalResearchClient();

export function MunicipalPlanResearch({ identity, points, eligible, onResolved, sourceRevision = '' }: { identity: ParcelIdentity; points: GeoPoint[]; eligible: boolean; onResolved?: (result: Result) => void; sourceRevision?: string }) {
  const { project, patchModule } = useProjectKernel();
  const [state, setState] = useState<{ key: string; result: Result }>({ key: '', result: municipalResearchState('idle', null) });
  const [attempt, setAttempt] = useState(0);
  const [copyStatus, setCopyStatus] = useState({ key: '', message: '' });
  const scope = createMunicipalResearchScope(identity, points, project.id, project.revision, sourceRevision);
  const key = municipalResearchKey(scope);
  const supported = ['istanbul', 'kastamonu'].includes(normalizeZoningPlace(identity.province));
  const currentKey = useRef<string | null>(null);
  const callback = useRef(onResolved);
  useLayoutEffect(() => { callback.current = onResolved; });
  useLayoutEffect(() => { currentKey.current = eligible ? key : null; return () => { currentKey.current = null; }; }, [key, eligible]);
  const previous = useRef(project.modules['municipal-plan-research']); previous.current = project.modules['municipal-plan-research'];
  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    const controller = new AbortController();
    const publish = (result: Result) => {
      if (!canCommitMunicipalResearch(cancelled, currentKey.current, key, scope, result)) return;
      setState({ key, result });
      callback.current?.(result);
      if (result.status !== 'loading' && result.status !== 'idle') {
        const saved = previous.current as { scopes?: Record<string, unknown> } | undefined;
        patchModule('municipal-plan-research', { scopes: { ...saved?.scopes, [parcelIdentityKey(identity)]: { ...result, targetIdentity: { ...identity }, geometryKey: scope.geometryKey, needsReview: true } } });
      }
    };
    if (!supported) {
      publish(municipalResearchState('unsupported', scope, 'Bu bölge için otomatik parsel imar kaynağı henüz bağlı değil.'));
      return () => { cancelled = true; controller.abort(); };
    }
    const timeout = setTimeout(() => controller.abort(), 12000);
    publish(municipalResearchState('loading', scope));
    queryMunicipalPlans(identity, points, scope, controller.signal, attempt > 0)
      .then(publish)
      .catch(() => publish(municipalResearchState('unavailable', scope, 'İmar kaynağına bu sorguda erişilemedi.')))
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
    // The primitive key includes every identity, geometry and project revision input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, eligible, supported, attempt, patchModule]);
  if (!eligible) return null;
  const portal = resolveZoningPortal(identity.province, identity.district, identity.neighborhood);
  const result = state.key === key ? state.result : municipalResearchState(supported ? 'loading' : 'unsupported', scope);
  const needsOfficialCheck = result.status === 'action-required';
  const label = { idle: 'İmar araştırması hazır', loading: 'İmar kaynağı kontrol ediliyor…', 'research-only': 'Askı planı adayı bulundu · imar koşulu değil', 'not-found': 'Askı katmanında kayıt yok · imar durumu belirsiz', unavailable: 'İmar kaynağına erişilemedi', unsupported: 'Otomatik imar kaynağı yok', 'action-required': 'Belediye kaynağı bulundu · resmî ekranda kontrol gerekli', 'authority-required': 'Yetkili idare doğrulaması gerekli' }[result.status];
  return <section className="parcel-municipal-research" aria-label="Seçili parselin belediye plan araştırması" data-research-status={result.status} aria-busy={result.status === 'loading'}>
    <header><b>İmar kaynağı ve sorgu sonucu</b><span role="status" aria-live="polite">{label}</span></header>
    <div className="municipal-capability"><b>{portal?.authority || result.authority || 'Yetkili idare araştırması'}</b><p>{identity.province} / {identity.district} · {identity.neighborhood} · Ada {identity.block} / Parsel {identity.parcelNo}</p>{portal && <a href={portal.href} target="_blank" rel="noreferrer">{needsOfficialCheck ? 'Belediyenin e-imar girişine git ↗' : 'Resmî kaynakta incele ↗'}</a>}</div>
    {needsOfficialCheck && <div className="municipal-official-check">
      <p>{result.message}</p>
      <ol><li>{portal?.id === 'besiktas-keos' ? 'Beşiktaş Belediyesi sayfasından E-Belediye → İmar Durumu bölümünü açın.' : 'Kastamonu Belediyesi E-Uygulama sayfasından E-İmar bölümünü açın.'}</li><li>Ada / Parsel bölümünde <strong>{identity.block} / {identity.parcelNo}</strong> arayın; tapu mahallesi olarak <strong>{identity.neighborhood}</strong> eşleşmesini kontrol edin.</li><li>Varsa belediyenin güvenlik doğrulamasını kendiniz tamamlayın. Güncel imar belgesi ve plan notlarını birlikte inceleyin.</li></ol>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${identity.block}/${identity.parcelNo}`); setCopyStatus({ key, message: 'Ada / parsel kopyalandı.' }); } catch { setCopyStatus({ key, message: 'Kopyalanamadı; yukarıdaki ada / parseli belediye ekranına yazın.' }); } }}>Ada / parseli kopyala</button>
      <small role="status">{copyStatus.key === key ? copyStatus.message : ''}</small>
      <p>{result.limitation}</p>
    </div>}
    {result.status === 'research-only' && <p>Kaynakta {result.plans.length} plan adayı bulundu. Güncel plan, plan notları ve parselin tamamına uygulanabilirlik doğrulanmadığı için imar hesabına aktarılmadı.</p>}
    {result.status === 'not-found' && <p>Bu sorguda, araştırılan kaynakta parselinizle kesişen plan kaydı bulunamadı. Bu sonuç parselin plansız olduğunu göstermez.</p>}
    {(result.status === 'unavailable' || result.status === 'unsupported' || result.status === 'authority-required') && <p>{result.message || 'Bu bölge için otomatik imar kaynağına erişilemedi.'}</p>}
    {result.status !== 'loading' && <p>İmar bilgisi girmek isteğe bağlıdır; imar girmeden kavramsal yerleşime devam edebilirsiniz.</p>}
    {(result.status === 'research-only' || result.status === 'not-found') && <details><summary>Kaynak ve plan ayrıntıları{result.partial ? ' · kısmi kapsam' : ''}</summary>
      <p>Sorgu zamanı: {result.observedAt?.replace('T', ' ').slice(0, 16)} UTC.</p>
      {result.source && <a href={result.source} target="_blank" rel="noreferrer">Sorgulanan plan katmanı ↗</a>}
      {result.partial && <p>Kaynağın kapsamı sınırlıdır; diğer planlar ve kullanımlar için ayrıca doğrulama gerekir.</p>}
      {result.limitation && <p>{result.limitation}</p>}
      <ul className="parcel-plan-candidates">{result.plans.map((plan, i) => <li key={`${plan.id}-${i}`}><b>{plan.name || 'Plan adı kaynakta yok'}</b>
        <small>Ölçek: {plan.scale || 'Bilinmiyor'} · Tarih: {plan.date || 'Bilinmiyor'} · Karar: {plan.decision || 'Bilinmiyor'}</small>
        {(plan.district || plan.block || plan.parcel) && <p>Kaynak kimliği: {plan.district || 'İlçe yok'} · Ada {plan.block || 'Yok'} / Parsel {plan.parcel || 'Yok'}</p>}
        {plan.rawConditions && <div className="parcel-plan-values"><span>Kaynak TAKS: {plan.rawConditions.taks ?? 'Yok'}</span><span>Kaynak emsal: {plan.rawConditions.far ?? 'Yok'}</span><span>Kaynak kat: {plan.rawConditions.floors ?? 'Yok'}</span><span>Kaynak yükseklik: {plan.rawConditions.height === null ? 'Yok' : `${plan.rawConditions.height} m`}</span></div>}
        {plan.note && <p>{plan.note}</p>}{plan.qualityIssues?.map(issue => <p key={issue}>{issue}</p>)}
      </li>)}</ul>
    </details>}
    {supported && !needsOfficialCheck && result.status !== 'authority-required' && <button type="button" disabled={result.status === 'loading'} onClick={() => setAttempt(value => value + 1)}>Plan kaynağını yeniden kontrol et</button>}
  </section>;
}
