"use client";

import { useEffect, useRef, useState } from "react";

export function ArticleProgress() {
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const maximum = Math.max(1, root.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / maximum));
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <div className="article-progress" aria-hidden="true"><span ref={bar}/></div>;
}

export function ArticleShareTools({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const shareText = `${title} — Arkem Yapı Sistemleri`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      setCopied(document.execCommand("copy"));
      field.remove();
    }
  };

  return <div className="article-share"><p>Yazıyı paylaş</p><a href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`} target="_blank" rel="noreferrer">WhatsApp <span aria-hidden="true">↗</span></a><a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span></a><button type="button" onClick={copy}>{copied ? "Bağlantı kopyalandı ✓" : "Bağlantıyı kopyala"}</button></div>;
}
