"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";

const systems = [
  { id: "concrete", code: "RC", label: "Betonarme", note: "Rijitlik ve yerel tedarik odağı" },
  { id: "steel", code: "ST", label: "Yapısal çelik", note: "Büyük açıklık ve hızlı montaj" },
  { id: "light", code: "LS", label: "Hafif çelik", note: "Hafiflik ve kuru yapım" },
  { id: "hybrid", code: "HY", label: "Karma sistem", note: "Çekirdek ve açıklık optimizasyonu" },
] as const;

export function StructuralDesignerPreview() {
  const [systemId, setSystemId] = useState<(typeof systems)[number]["id"]>("concrete");
  const [span, setSpan] = useState(6);
  const [floors, setFloors] = useState(4);
  const system = systems.find((item) => item.id === systemId) ?? systems[0];
  const metrics = useMemo(() => {
    const bayCount = Math.max(2, Math.ceil(24 / span));
    const height = floors * 3.4;
    const decision = systemId === "light" && floors > 5
      ? "Kat adedi için mühendislik kontrolü"
      : span > 9 && systemId === "concrete"
        ? "Açıklık için alternatif sistem karşılaştırması"
        : "Kavramsal modellemeye uygun başlangıç";
    return { bayCount, height, decision };
  }, [floors, span, systemId]);

  return <section className="structural-preview" aria-label="Taşıyıcı sistem hızlı ön değerlendirmesi">
    <div className="structural-preview-visual">
      <Image src="/visuals/arkem-x-design-v2.webp" width={1600} height={900} sizes="(max-width: 760px) 100vw, 50vw" unoptimized alt="Taşıyıcı sistem ve BIM tasarım modelinin teknik görselleştirmesi"/>
      <div className="structural-preview-signal">
        <span>ARKEMX / STR</span>
        <b>{system.label}</b>
        <small>{span.toFixed(1)} m açıklık · {floors} kat</small>
      </div>
      <div className="structural-preview-metrics">
        <p><span>Aks</span><b>{metrics.bayCount}</b></p>
        <p><span>Yükseklik</span><b>{metrics.height.toFixed(1)} m</b></p>
        <p><span>Durum</span><b>Ön model</b></p>
      </div>
    </div>
    <div className="structural-preview-panel">
      <header>
        <span>HIZLI TAŞIYICI ÖN DEĞERLENDİRME</span>
        <h3>Sistemi seçin, açıklığı ve katı değiştirin.</h3>
        <p>Ana sayfadaki bu hafif çalışma alanı ilk kararı görünür kılar; ayrıntılı yük, kesit, kontrol, metraj ve pafta üretimi tam stüdyoda yapılır.</p>
      </header>
      <div className="structural-preview-systems" role="group" aria-label="Taşıyıcı sistem seçimi">
        {systems.map((item) => <button
          type="button"
          key={item.id}
          className={systemId === item.id ? "active" : ""}
          aria-pressed={systemId === item.id}
          onClick={() => setSystemId(item.id)}
        >
          <i>{item.code}</i><span><b>{item.label}</b><small>{item.note}</small></span>
        </button>)}
      </div>
      <div className="structural-preview-inputs">
        <label><span>Ana açıklık <b>{span.toFixed(1)} m</b></span><input type="range" min="4" max="12" step=".5" value={span} onChange={(event) => setSpan(Number(event.target.value))}/></label>
        <label><span>Kat adedi <b>{floors}</b></span><input type="range" min="1" max="12" step="1" value={floors} onChange={(event) => setFloors(Number(event.target.value))}/></label>
      </div>
      <div className="structural-preview-result">
        <span>ÖN KARAR NOTU</span>
        <b>{metrics.decision}</b>
        <small>Bu sonuç statik hesap veya uygulama projesi değildir.</small>
      </div>
      <Link href="/tasarim-calismalari#tasiyici-on-tasarim">Ayrıntılı taşıyıcı stüdyosunu açın <span aria-hidden="true">↗</span></Link>
    </div>
  </section>;
}
