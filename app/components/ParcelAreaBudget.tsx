"use client";
import { useState, type ReactNode } from 'react';
import { useProjectKernel } from './ProjectKernel';
import { parcelIdentityKey, type ParcelIdentity } from '../lib/parcel-record';
import { calculateAreaBudget, positiveArea, restoreAreaBudgetInput, type AreaBudgetInput, type AreaEntry } from '../lib/parcel-area-budget';

const format = (n: number | null) => n === null ? 'Bilgi bekleniyor' : `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} m²`;
export function ParcelAreaBudget({ identity, measuredArea, far, onFarChange, netPlotArea, netAreaBasis, onNetAreaChange, sharedSource, onSaved, confirmation }: { identity: ParcelIdentity; measuredArea: number | null; far: number; onFarChange: (n: number) => void; netPlotArea: number | null; netAreaBasis: string; onNetAreaChange: (area: number | null, basis: string) => void; sharedSource?: {reference:string;date:string}; onSaved?: () => string | void; confirmation?: ReactNode }) {
  const { project, patchModule } = useProjectKernel();
  const scope = parcelIdentityKey(identity);
  const previous = project.modules['parcel-area-budget'] as { scopes?: Record<string, { input: AreaBudgetInput }> } | undefined;
  const [draft, setDraft] = useState<AreaBudgetInput>(() => {
    const stored = previous?.scopes?.[scope]?.input;
    return restoreAreaBudgetInput(stored) ?? { netPlotArea: '', netAreaBasis: '', far: '', sourceReference: '', sourceDate: '', entries: [] };
  });
  const input = { ...draft, ...(sharedSource ? { sourceReference: sharedSource.reference, sourceDate: sharedSource.date } : {}), netPlotArea: netPlotArea === null ? '' : String(netPlotArea), netAreaBasis, far: far > 0 ? String(far) : '' };
  const result = calculateAreaBudget(input);
  const [notice, setNotice] = useState('');
  const change = (patch: Partial<AreaBudgetInput>) => { setDraft(current => ({ ...current, ...patch })); setNotice('Değişiklik var; cetveli projeye kaydedin.'); };
  const changeRow = (id: string, patch: Partial<AreaEntry>) => change({ entries: draft.entries.map(row => row.id === id ? { ...row, ...patch } : row) });
  function save() {
    patchModule('parcel-area-budget', { schema: 'ARKEM-AREA-BUDGET/1', scopes: { ...previous?.scopes, [scope]: { identity: { ...identity }, input, result, updatedAt: new Date().toISOString(), evidenceKind: 'customer-declared-schedule', authoritative: false } } });
    const message = onSaved?.();
    setNotice(message || 'Cetvel proje taslağına eklendi. Bu işlem resmî onay değildir.');
  }
  return <section className="parcel-area-budget" aria-label="Emsal ve toplam inşaat alanı cetveli">
    <header><div><span className="parcel-kicker">ALAN CETVELİ</span><h3>Ne kadar alan planlanabilir?</h3></div><span className="parcel-evidence-tag">Belge / kullanıcı beyanı</span></header>
    <p>Net imar parsel alanı ile kadastro sınırından ölçülen alan aynı olmayabilir. Emsal hesabı net imar parseli üzerinden yapılır; aşağıdaki değerler güncel plan ve belgeyle kontrol edilmelidir.</p>
    {measuredArea !== null && <p className="parcel-measurement-note">Kaynak sınırından geometrik ölçüm: <b>{format(measuredArea)}</b>. Bu değer otomatik olarak net imar parsel alanına aktarılmaz.</p>}
    <div className="parcel-budget-inputs">
      <label>Net imar parsel alanı · m²<input type="number" min="0" max="100000000" step="0.01" value={netPlotArea ?? ''} onChange={e => { onNetAreaChange(positiveArea(e.target.value), netAreaBasis); setNotice('Net alan değişti; cetveli yeniden kaydedin.'); }} placeholder="Belgedeki net alan" /></label>
      {!sharedSource && <label>Emsal · KAKS<input type="number" min="0" max="10" step="0.01" value={far > 0 ? far : ''} onChange={e => { onFarChange(Number(e.target.value)); setNotice('Emsal değişti; cetveli yeniden kaydedin.'); }} placeholder="Örn. 1,20" /></label>}
      <label>Net alanın belge dayanağı<input value={netAreaBasis} onChange={e => { onNetAreaChange(netPlotArea, e.target.value); setNotice('Dayanak değişti; cetveli yeniden kaydedin.'); }} placeholder="İmar parseli / düzenleme belgesi" maxLength={240} /></label>
      {!sharedSource && <label>İmar belgesi / plan referansı<input value={draft.sourceReference} onChange={e => change({ sourceReference: e.target.value })} placeholder="İdare, belge no, plan ve sayfa" maxLength={300} /></label>}
      {!sharedSource && <label>Belge tarihi<input type="date" value={draft.sourceDate} onChange={e => change({ sourceDate: e.target.value })} /></label>}
    </div>
    {result.capacity === null ? <p className="zoning-empty-result">Alan hesabı için net imar parsel alanını ve koşullar bölümündeki emsal değerini tamamlayın.</p> :     <div className="parcel-area-totals"><article><span>Girilen verilere göre emsal kapasitesi</span><strong>{format(result.capacity)}</strong><small>Net imar parseli × emsal · kesin ruhsat hakkı değildir</small></article><article><span>Cetvelde emsale dahil</span><strong>{format(result.completeRows ? result.included : null)}</strong><small>{result.completeRows ? 'Yazılmış tekil alanların toplamı' : 'Eksik veya incelenmemiş alan kalemleri var'}</small></article><article><span>Cetvelde emsal dışı</span><strong>{format(result.completeRows ? result.limited + result.independent : null)}</strong><small>Plan ve yönetmelik şartları ayrıca incelenir</small></article><article><span>Cetvele göre toplam inşaat alanı</span><strong>{format(result.construction)}</strong><small>Yalnız inşaat alanına dahil işaretlenen kalemler</small></article></div>}
    <details className="parcel-area-details"><summary>Emsal dışı alanları ve kat / mahal cetvelini düzenle</summary>
      <p>Her alanı yalnız bir kez yazın. Emsal dışı olması, otomatik olarak toplam inşaat alanına girdiği anlamına gelmez. Genel bir “%30 ilave inşaat hakkı” uygulanmaz.</p>
      <div className="parcel-area-rows">{draft.entries.map((row, index) => <fieldset key={row.id}><legend>Alan {index + 1}</legend><label>Kat / mahal / alan adı<input value={row.name} maxLength={120} onChange={e => changeRow(row.id, { name: e.target.value })} placeholder="Örn. Bodrum / otopark" /></label><label>Alan · m²<input inputMode="decimal" value={row.area} maxLength={18} onChange={e => changeRow(row.id, { area: e.target.value })} /></label><label>Emsal sınıfı<select value={row.category} onChange={e => changeRow(row.id, { category: e.target.value as AreaEntry['category'] })}><option value="unknown">İnceleme bekliyor</option><option value="included">Emsale dahil</option><option value="excluded-limited">Emsal dışı · sınır kapsamı incelenecek</option><option value="excluded-independent">Emsal dışı · sınır dışında olduğu beyanı</option></select></label><label>Yapı inşaat alanına dahil mi?<select value={row.countsInConstruction} onChange={e => changeRow(row.id, { countsInConstruction: e.target.value as AreaEntry['countsInConstruction'] })}><option value="unknown">İnceleme bekliyor</option><option value="yes">Evet · dayanak belirtilmeli</option><option value="no">Hayır · dayanak belirtilmeli</option></select></label><label className="parcel-budget-basis">Madde / plan notu ve ölçüm dayanağı<input value={row.basis} maxLength={300} onChange={e => changeRow(row.id, { basis: e.target.value })} placeholder="Belge, sayfa, madde, ölçülen mahal" /></label><button type="button" onClick={() => change({ entries: draft.entries.filter(item => item.id !== row.id) })} aria-label={`Alan ${index + 1} kalemini kaldır`}>Kalemi kaldır</button></fieldset>)}</div>
      <button type="button" disabled={draft.entries.length >= 50} onClick={() => change({ entries: [...draft.entries, { id: crypto.randomUUID(), name: '', area: '', category: 'unknown', countsInConstruction: 'unknown', basis: '' }] })}>Alan kalemi ekle</button>
    </details>
    {result.issues.length > 0 && <div className="parcel-budget-missing"><b>Toplamı hesaplamak için</b><ul>{result.issues.slice(0, 4).map((issue, i) => <li key={i}>{issue}</li>)}</ul></div>}
    {confirmation}
    <div className="parcel-budget-save"><button type="button" onClick={save}>{onSaved ? "İmar taslağını kaydet ve devam et →" : "Alan cetvelini projeye ekle"}</button><span role="status">{notice}</span></div>
    <small>Güncel plan, çekmeler, yükseklik, kullanım, otopark, yangın ve diğer koşullar uygulanabilir alanı ayrıca sınırlayabilir. Bu cetvel ruhsat, imar onayı veya uzman doğrulaması değildir.</small>
  </section>;
}
