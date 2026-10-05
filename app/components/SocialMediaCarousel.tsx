"use client";

import { useEffect, useState } from "react";
import { site } from "../data/site";

const channels = [
  {name:"Instagram",code:"IG",url:site.instagram,color:"#c15a79",mode:"showcase",title:"Saha, model ve uygulama akışı",copy:"@arkemyapisistemleri profilindeki güncel kısa videoları, uygulama detaylarını ve proje notlarını resmî profil üzerinden takip edin.",image:"/portfolio/light-steel-house.webp",tag:"GÜNCEL PROFİL AKIŞI"},
  {name:"Facebook",code:"FB",url:site.facebook,color:"#3c6caa",mode:"showcase",title:"Kurumsal yayın ve proje güncellemeleri",copy:"Arkem duyuruları, proje içerikleri ve uzun format açıklamalar Facebook sayfasında tek akışta toplanır.",image:"/visuals/arkem-corporate-hero-v2.png",tag:"RESMÎ SAYFA AKIŞI"},
  {name:"YouTube",code:"YT",url:site.youtube,color:"#d24339",mode:"showcase",title:"Teknik video ve saha anlatımları",copy:"Yapı sistemleri, BIM, uygulama ve kontrollü yıkım içeriklerini video arşivinden izleyin.",image:"/portfolio/industrial-steel.webp",tag:"VİDEO KANALI"},
  {name:"LinkedIn",code:"IN",url:site.linkedin,color:"#2979ad",mode:"showcase",title:"Mühendislik ve kurumsal yayınlar",copy:"Teknik değerlendirmeler, yeni yetkinlikler ve profesyonel iş birliği duyuruları için LinkedIn profilini açın.",image:"/portfolio/bim-engineering.webp",tag:"PROFESYONEL AĞ"},
  {name:"TikTok",code:"TK",url:site.tiktok,color:"#21b8b1",mode:"showcase",title:"Kısa saha ve model kesitleri",copy:"Üretim, montaj, 3B model ve proje süreçlerinden kısa teknik anlatımlara hızlıca ulaşın.",image:"/visuals/arkem-x-site-v2.webp",tag:"KISA FORMAT"},
  {name:"Threads",code:"TH",url:site.threads,color:"#8b8b8b",mode:"showcase",title:"Günlük proje ve mühendislik notları",copy:"Geliştirme notları, proje kararları ve ARKEMX güncellemeleri için kısa yayın akışını izleyin.",image:"/visuals/arkem-x-coordination-v2.webp",tag:"PROJE NOTLARI"},
] as const;

type Channel = (typeof channels)[number];

function LiveSurface({channel}:{channel:Channel}) {
  return <a className="social-channel-showcase" href={channel.url} target="_blank" rel="noreferrer"><img src={channel.image} alt={`${channel.name} teknik içerik vitrini`}/><div><span>{channel.tag}</span><b>{channel.title}</b><small>Resmî {channel.name} kanalını açın ↗</small></div><i aria-hidden="true">{channel.code}</i></a>;
}

export function SocialMediaCarousel(){
  const [active,setActive]=useState(0);
  const [paused,setPaused]=useState(false);
  useEffect(()=>{
    if(paused) return;
    const timer=window.setInterval(()=>setActive(value=>(value+1)%channels.length),6500);
    return()=>window.clearInterval(timer);
  },[paused]);
  const item=channels[active];
  return <section className="social-carousel social-live-carousel social-newsroom" style={{"--social-color":item.color} as React.CSSProperties} aria-roledescription="carousel" aria-label="Arkem sosyal medya yayın merkezi" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={()=>setPaused(false)}>
    <div className="social-live-stage"><LiveSurface channel={item}/></div>
    <div className="social-carousel-copy"><p>ARKEM / SOSYAL YAYIN MERKEZİ</p><small>{String(active+1).padStart(2,"0")} — {String(channels.length).padStart(2,"0")}</small><h3>{item.name}</h3><strong>{item.title}</strong><p>{item.copy}</p><a href={item.url} target="_blank" rel="noreferrer">{item.name} hesabını açın <span>↗</span></a><div className="social-rotation-status"><i className={paused?"paused":""}></i><span>{paused?"Geçiş duraklatıldı":"Sonraki kanal otomatik açılacak"}</span></div><div className="social-carousel-nav" aria-label="Sosyal kanal seçimi">{channels.map((channel,index)=><button type="button" key={channel.name} className={active===index?"active":""} onClick={()=>setActive(index)} aria-label={`${channel.name} yayınını göster`} aria-pressed={active===index}><span>{channel.code}</span>{channel.name}</button>)}</div></div>
  </section>;
}
