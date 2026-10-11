"use client";
import { useState, useSyncExternalStore } from "react";
import { downloadTextFile } from "../lib/engineering";
import type { CoupledModel, solveCoupledFrameShell } from "../lib/coupled-frame-shell";
type Result = ReturnType<typeof solveCoupledFrameShell>;
const subscribe=()=>()=>{},client=()=>true,server=()=>false;

export function CoupledFrameShellExample() {
  const ready=useSyncExternalStore(subscribe,client,server);
  const [twoFloors,setTwoFloors]=useState(false),[mesh,setMesh]=useState("2"),[caseId,setCaseId]=useState("G");
  const [calculation,setCalculation]=useState<{model:CoupledModel;result:Result}|null>(null);
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function solve() {
    setBusy(true);setError("");setCalculation(null);
    try {
      const [{createCoupledExample},{solveCoupledFrameShell}]=await Promise.all([import("../lib/coupled-example"),import("../lib/coupled-frame-shell")]);
      const model=createCoupledExample(Number(mesh),twoFloors);
      setCalculation({model,result:solveCoupledFrameShell(model)});
    } catch(e) {setError(e instanceof Error?e.message:"Ortak çözüm başarısız.");}
    finally {setBusy(false);}
  }
  const c=calculation?.result.cases.find(c=>c.id===caseId);
  const bases=c?.nodes.filter(n=>n.id.startsWith("BASE"))??[];
  return <section className="engineering-panel" data-testid="coupled-example">
    <h2>Döşeme–kiriş–kolon ortak çözüm örneği</h2>
    <p>Sentetik model: alt kat 4 × 3 m, isteğe bağlı üst kat 2 × 3 m, kat yüksekliği 3 m. Kabuk kalınlığı 0,18 m; E = 30.000.000 kN/m², ν = 0,2. Rijit uçlu çerçeve ve kabuk aynı düğümlerin altı hareket bileşenini paylaşır.</p>
    <p>G = 5 ve Q = 2 kN/m² açık basınç yükleridir; öz ağırlık ayrıca eklenmez. H ve MEMBER ayrı örnek yük durumlarıdır. Bu model LHM hesabı veya yetkili kabul değildir.</p>
    <p role="note">Ağ yakınsama kabulü henüz yok. Gösterilen sehim ve iç kuvvetler ağ yoğunluğuna bağlı örnek sonuçlardır; tasarım veya kapasite kararı için kullanılamaz.</p>
    <div className="shell-inputs">
      <label>Kat düzeni<select aria-label="Ortak model kat düzeni" disabled={busy} value={twoFloors?"two":"one"} onChange={e=>{setTwoFloors(e.target.value==="two");setCalculation(null);setError("");}}><option value="one">Tek kat</option><option value="two">İki farklı kat</option></select></label>
      <label>Ağ<select aria-label="Ortak model ağı" disabled={busy} value={mesh} onChange={e=>{setMesh(e.target.value);setCalculation(null);setError("");}}><option value="2">2 × 2</option><option value="4">4 × 4</option></select></label>
    </div>
    <button disabled={!ready||busy} onClick={solve}>Ortak modeli çöz</button>
    <p role="status">{busy?"Ortak model çözülüyor…":calculation?"Ortak çözüm ve denge kontrolü tamamlandı.":"Güncel ortak çözüm yok."}</p>
    {error&&<p role="alert">{error}</p>}
    {calculation&&c&&<>
      <label>Yük durumu<select aria-label="Ortak model yük durumu" value={caseId} onChange={e=>setCaseId(e.target.value)}>{calculation.result.cases.map(c=><option key={c.id}>{c.id}</option>)}</select></label>
      <p data-testid="coupled-summary">{calculation.model.nodes.length} düğüm · {calculation.model.members.length} çerçeve elemanı · {calculation.model.shells.length} kabuk. En büyük |Uz|: {(Math.max(...c.nodes.map(n=>Math.abs(n.displacements[2])))*1000).toFixed(4)} mm. Toplam taban Rz: {bases.reduce((s,n)=>s+n.reactions[2],0).toFixed(4)} kN.</p>
      <table><caption>Taban reaksiyonları ({caseId})</caption><thead><tr><th>Düğüm</th><th>Rx (kN)</th><th>Ry (kN)</th><th>Rz (kN)</th></tr></thead><tbody>{bases.map(n=><tr key={n.id}><th scope="row">{n.id}</th>{n.reactions.slice(0,3).map((v,i)=><td key={i}>{v.toFixed(4)}</td>)}</tr>)}</tbody></table>
      <button onClick={()=>downloadTextFile("arkemx-sentetik-ortak-cozum.json",JSON.stringify({fixture:"synthetic",...calculation},null,2),"application/json")}>Ortak model ve sonuç JSON indir</button>
      <p>Sonuçlar örnek kapsamındadır; proje kaydı, mühendislik onayı veya taşınabilir proje hesap yedeği değildir. Yenilemede sonuç temizlenir.</p>
    </>}
  </section>;
}
