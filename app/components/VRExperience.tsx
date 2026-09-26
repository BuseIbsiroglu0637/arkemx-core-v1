"use client";

import { useState } from "react";

const scenes = [
  { code:"01", label:"Model içinde gezin", title:"Yapıyı gerçek ölçekte deneyimleyin", copy:"VR gözlükle kolon, kiriş, duvar ve mekân ilişkilerini masa başındaki çizimden çıkarıp 1:1 ölçekte inceleyin." },
  { code:"02", label:"Kararı işaretle", title:"Değişiklik noktasını model üzerinde gösterin", copy:"Kapı konumu, cephe açıklığı, bölme duvarı, malzeme veya taşıyıcı kararını baktığınız yerde işaretleyin." },
  { code:"03", label:"Revizyonu karşılaştır", title:"Alternatifleri aynı oturumda görün", copy:"A ve B senaryoları arasında geçiş yapın; kararın mekâna, taşıyıcı sisteme ve proje koordinasyonuna etkisini görün." },
  { code:"04", label:"Onaya gönder", title:"Kararı kayıtlı bir çıktıya dönüştürün", copy:"Seçilen revizyonlar proje ekibine not, ekran görüntüsü ve model konumu ile iletilir; uygulama öncesi belirsizlik azalır." },
] as const;

export function VRExperience(){
  const [active,setActive]=useState(0); const scene=scenes[active];
  return <section className="vr-experience" aria-label="VR tasarım deneyimi anlatımı">
    <div className="vr-stage">
      <div className="vr-grid"></div><div className="vr-building"><i></i><i></i><i></i><i></i><b></b><b></b></div>
      <div className="vr-reticle"><span>+</span></div><div className="vr-change-tag">REVİZYON NOKTASI <b>R-{active+1}</b></div>
      <div className="vr-hud"><span>ARKEMXR / CANLI OTURUM</span><b>{scene.code} — 04</b></div>
      <div className="vr-caption"><small>{scene.label}</small><strong>{scene.title}</strong><p>{scene.copy}</p></div>
    </div>
    <div className="vr-timeline">{scenes.map((item,index)=><button key={item.code} className={active===index?"active":""} onClick={()=>setActive(index)}><span>{item.code}</span><b>{item.label}</b></button>)}</div>
  </section>
}
