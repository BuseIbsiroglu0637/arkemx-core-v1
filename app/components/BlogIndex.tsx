"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BlogPost } from "../data/blog";

export function BlogIndex({ posts }: { posts: BlogPost[] }) {
  const categories = ["Tümü", ...Array.from(new Set(posts.map((post) => post.category)))];
  const [category, setCategory] = useState("Tümü");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.toLocaleLowerCase("tr-TR").trim();
    return posts.filter((post) => (category === "Tümü" || post.category === category) && (!needle || `${post.title} ${post.description} ${post.category}`.toLocaleLowerCase("tr-TR").includes(needle)));
  }, [category, posts, query]);

  return <div className="blog-index">
    <div className="blog-index-tools">
      <div className="blog-category-tabs" aria-label="Blog kategorileri">
        {categories.map((item) => <button type="button" key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <label><span>Teknik konuda arayın</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Örn. BIM, deprem, prefabrik…" /></label>
    </div>
    <div className="blog-index-summary"><p><b>{visible.length}</b> teknik yazı</p><span>Arsa · mimari · yapı · saha · dijital teslim · yaşam döngüsü</span></div>
    <div className="blog-editorial-grid">
      {visible.map((post, index) => <article className={index === 0 && category === "Tümü" && !query ? "featured" : ""} key={post.slug}>
        <Link className="blog-card-image" href={`/blog/${post.slug}`}><Image src={post.image} width={1200} height={760} sizes="(max-width: 760px) 100vw, 50vw" unoptimized alt={post.imageAlt}/><span>{post.category}</span>{post.imageNote && <small className="v21-image-note">{post.imageNote}</small>}</Link>
        <div className="blog-card-copy"><div><span>{String(index + 1).padStart(2, "0")} / ARKEM NOTU</span><small>{post.readingTime}</small></div><h2>{post.title}</h2><p>{post.description}</p><Link href={`/blog/${post.slug}`}>Teknik yazıyı okuyun <span aria-hidden="true">↗</span></Link></div>
      </article>)}
    </div>
    {!visible.length && <div className="empty-state"><h2>Bu aramada yazı bulunamadı.</h2><p>Kategori seçimini veya arama ifadesini değiştirin.</p></div>}
  </div>;
}
