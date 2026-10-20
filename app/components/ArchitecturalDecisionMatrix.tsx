"use client";
import type { ProgrammeSpace, ProgrammeRelationship } from '../lib/architectural-programme';
export type ArchitecturalStrategy={id:'compact'|'balanced'|'daylight';label:string;note:string;aspect:number;netRatio:number;wwr:{north:number;east:number;south:number;west:number}};
type Props={strategies:ArchitecturalStrategy[];current:{aspect:number;netRatio:number;wwr:ArchitecturalStrategy['wwr']};spaces:ProgrammeSpace[];relationships:ProgrammeRelationship[];onApply:(strategy:ArchitecturalStrategy)=>void;onUndo:()=>void;canUndo:boolean;onEditRelationships:()=>void};
export function ArchitecturalDecisionMatrix({strategies,current,spaces,relationships,onApply,onUndo,canUndo,onEditRelationships}:Props){
 const active=strategies.find(s=>Math.abs(s.aspect-current.aspect)<1e-8&&s.netRatio===current.netRatio&&(['north','east','south','west'] as const).every(k=>s.wwr[k]===current.wwr[k]));
 const shown=spaces.slice(0,8);
 const relationship=(a:string,b:string)=>relationships.find(r=>(r.from===a&&r.to===b)||(r.from===b&&r.to===a));
 return <section className="arc-decision-matrix" aria-label="Mimari karar matrisi">
  <header className="arc-decision-header"><span>V83 / MİMARİ KARAR MATRİSİ</span><h2>Mimari alternatifleri karşılaştırın</h2><p>Aynı mahal programı için üç başlangıç senaryosu. Seçim; plaka oranını, net/brüt kabulünü ve yönlere göre cam oranlarını değiştirir.</p></header>
  <div className="arc-decision-current"><div><b>{active?`${active.label} uygulanıyor`:'Özel girdilerle çalışıyorsunuz'}</b><p>Mevcut plaka oranı {current.aspect.toLocaleString('tr-TR',{maximumFractionDigits:2})} · Net/brüt %{current.netRatio} · Güney cam oranı %{current.wwr.south}</p></div>{canUndo&&<button type="button" onClick={onUndo}>Önceki girdilere dön</button>}</div>
  <div className="arc-decision-cards">{strategies.map((s,index)=><article key={s.id} className={active?.id===s.id?'is-applied':''} aria-label={`${s.label} senaryosu`}>
   <header><span>0{index+1}</span>{active?.id===s.id&&<b>Uygulanıyor</b>}</header>
   <div className="arc-decision-sketch" aria-hidden="true"><i style={{width:Math.sqrt(s.aspect)*64,height:64/Math.sqrt(s.aspect)}}/></div>
   <h3>{s.label}</h3><p>{s.note}</p>
   <dl><div><dt>Plaka oranı <small>En / boy</small></dt><dd>{s.aspect.toLocaleString('tr-TR',{minimumFractionDigits:2})}</dd></div><div><dt>Net / brüt</dt><dd>%{s.netRatio}</dd></div><div><dt>Güney cam oranı</dt><dd>%{s.wwr.south}</dd></div></dl>
   <details><summary>Tüm yönlerde cam oranları</summary><p>Kuzey %{s.wwr.north} · Doğu %{s.wwr.east} · Güney %{s.wwr.south} · Batı %{s.wwr.west}</p></details>
   <button type="button" disabled={active?.id===s.id} onClick={()=>onApply(s)} aria-label={`${s.label} senaryosunu uygula`}>{active?.id===s.id?'Uygulanıyor':'Senaryoyu uygula'}</button>
  </article>)}</div>
  <p className="arc-decision-note">Şekiller ölçeksiz oran gösterimidir. Senaryo uygulamak mahal adlarını, adetlerini, alanlarını ve komşuluk ihtiyaçlarını değiştirmez; plan şeması yeni girdilerle hesaplanır.</p>
  <section className="arc-decision-relations" aria-labelledby="arc-matrix-title"><header><div><h3 id="arc-matrix-title">Mahal ilişki matrisi</h3><p>{shown.length}/{spaces.length} mahal türü gösteriliyor. Hücreler kayıtlı yakınlık ihtiyaçlarının özetidir.</p></div><button type="button" onClick={onEditRelationships}>İlişkileri düzenle →</button></header>
   {!shown.length?<p>Mahal listesi boş. Önce programınıza mahal ekleyin.</p>:<><p className="arc-matrix-scroll-hint">Tablonun tamamı için yatay kaydırabilirsiniz.</p><div className="arc-matrix-scroll" role="region" aria-label="Mahal ilişkileri tablosu" tabIndex={0}><table><caption>Mahal türleri arasındaki zorunlu ve tercih edilen yakınlıklar</caption><thead><tr><th scope="col">Mahal</th>{shown.map(s=><th scope="col" key={s.id}><b>{s.code}</b><span>{s.name}</span></th>)}</tr></thead><tbody>{shown.map(row=><tr key={row.id}><th scope="row"><b>{row.code}</b><span>{row.name}</span></th>{shown.map(col=>{const r=row.id===col.id?undefined:relationship(row.name,col.name);return <td key={col.id}>{row.id===col.id?<span className="arc-matrix-self" aria-label="Aynı mahal">—</span>:r?<span className={`arc-matrix-mark ${r.priority==='Zorunlu'?'required':'preferred'}`} title={`${r.priority} yakınlık${r.confirmed?' · Gözden geçirildi':' · İnceleme bekliyor'}`}><abbr title={r.priority}>{r.priority==='Zorunlu'?'Z':'T'}</abbr>{r.confirmed&&<small aria-label="Gözden geçirildi">✓</small>}</span>:<span className="arc-matrix-empty" aria-label="İlişki tanımlanmadı">·</span>}</td>;})}</tr>)}</tbody></table></div></>}
   <div className="arc-matrix-legend"><span><b className="required">Z</b>Zorunlu yakınlık</span><span><b className="preferred">T</b>Tercih edilen yakınlık</span><span><b>✓</b>İhtiyaç gözden geçirildi</span><span><b>·</b>İlişki tanımlanmadı</span></div>
   <p className="arc-decision-note">İlişkileri “İlişkileri düzenle” bölümünden değiştirin. Mesafe sonuçları Plan şeması sekmesinde gösterilir; gözden geçirme işareti teknik onay değildir.</p>
  </section>
 </section>;
}
