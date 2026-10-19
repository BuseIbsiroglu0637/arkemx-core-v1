"use client";

import { useEffect, useState } from "react";
import { site } from "../data/site";

const items=[
  {type:"video",platform:"SAHA VİDEOSU",title:"Plaza yapı teknik incelemesi",copy:"Mevcut yapı ve saha koşullarının görsel kayıt üzerinden incelendiği 64 saniyelik doğrulanmış teknik arşiv.",src:"https://video.wixstatic.com/video/44ce0e_f4dbc637852345b4af72dc83dd8177c9/720p/mp4/file.mp4",poster:"https://static.wixstatic.com/media/44ce0e_f4dbc637852345b4af72dc83dd8177c9f002.jpg",href:"/referanslar/plaza-yapi-incelemesi",status:"64 sn / doğrulanmış kayıt"},
  {type:"image",platform:"3B MODEL",title:"ROMON etkileşimli taşıyıcı model",copy:"Taşıyıcı sistem bileşenlerini döndürün, yakınlaştırın ve Sketchfab görüntüleyicisiyle site içinde teknik olarak inceleyin.",src:"https://static.wixstatic.com/media/44ce0e_b689c732462945e78a9f4ed35d25f5d4~mv2.png",href:"/3b-model-kutuphanesi",status:"Site içi 3B inceleme"},
  {type:"image",platform:"BIM / PDF",title:"DİYANET dijital mühendislik çalışması",copy:"Prefabrikasyon, çelik çerçeve ve yapı bileşenlerinin birlikte incelendiği model ve PDF arşivi.",src:"https://static.wixstatic.com/media/44ce0e_f81db79215f24f048da62f06351b4d60~mv2.png",href:"/referanslar/diyanet-tasiyici-sistem-modeli",status:"Model + teknik PDF"},
  {type:"image",platform:"ARKEMX",title:"Prototip proje veri koordinasyonu",copy:"Parsel, mimari, taşıyıcı, konu, karbon ve teslim bilgisinin ortak proje kimliğinde ilişkilendirilmesini araştıran dijital akış.",src:"/visuals/arkem-x-coordination-v2.webp",href:"/dijital-proje-merkezi",status:"Geliştirme prototipi"},
  {type:"image",platform:"INSTAGRAM",title:"Güncel saha, model ve uygulama notları",copy:"Yeni kısa videoları ve proje güncellemelerini @arkemyapisistemleri resmî hesabından takip edin.",src:"/portfolio/light-steel-house.webp",href:site.instagram,external:true,status:"Resmî sosyal kanal"},
] as const;

export function SocialContentFeed(){
  const [active,setActive]=useState(0);
  const [paused,setPaused]=useState(false);
  useEffect(()=>{if(paused)return;const timer=window.setInterval(()=>setActive((value)=>(value+1)%items.length),7200);return()=>window.clearInterval(timer)},[paused]);
  const item=items[active];
  return <div className="content-feed content-feed-v2" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={()=>setPaused(false)}>
    <div className="content-feed-stage">{item.type==="video"?<video key={item.src} controls playsInline poster={item.poster}><source src={item.src} type="video/mp4"/></video>:<img key={item.src} src={item.src} alt={item.title}/>}<div className="content-feed-topline"><span>ARKEM MEDIA / {String(active+1).padStart(2,"0")}</span><b>{item.status}</b></div><div className="content-feed-overlay"><span>{item.platform}</span><h3>{item.title}</h3><p>{item.copy}</p><a href={item.href} target={"external" in item&&item.external?"_blank":undefined} rel={"external" in item&&item.external?"noreferrer":undefined}>İçeriği açın ↗</a></div></div>
    <div className="content-feed-rail"><header><span>SEÇİLİ YAYINLAR</span><b>{items.length} doğrulanmış içerik yüzeyi</b></header>{items.map((entry,index)=><button type="button" className={active===index?"active":""} key={entry.title} onClick={()=>setActive(index)} aria-pressed={active===index}><span>{String(index+1).padStart(2,"0")} / {entry.platform}</span><b>{entry.title}</b><small>{entry.status}</small></button>)}<footer><i className={paused?"paused":""}></i>{paused?"Akış duraklatıldı":"Otomatik yayın geçişi aktif"}</footer></div>
  </div>;
}
