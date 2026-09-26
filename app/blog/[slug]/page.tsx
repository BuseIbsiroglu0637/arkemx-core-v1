import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { ArticleProgress, ArticleShareTools } from "../../components/ArticleTools";
import { blogPosts, getBlogPost } from "../../data/blog";
import { site } from "../../data/site";

export function generateStaticParams() { return blogPosts.map((post) => ({ slug: post.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = getBlogPost((await params).slug);
  if (!post) return {};
  return { title: post.title, description: post.description, alternates: { canonical: `/blog/${post.slug}` }, openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.published, images: [{ url: post.image, alt: post.imageAlt }] } };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getBlogPost((await params).slug);
  if (!post) notFound();
  const schema = { "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.description, image: `${site.domain}${post.image}`, datePublished: post.published, dateModified: post.published, inLanguage: "tr-TR", author: { "@type": "Person", name: "Özenç Öztürk" }, publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: `${site.domain}/brand/arkem-logo-master.svg` } }, mainEntityOfPage: `${site.domain}/blog/${post.slug}` };
  const articleUrl = `${site.hostedDomain}/blog/${post.slug}`;
  const related = [...blogPosts.filter((item) => item.slug !== post.slug && item.category === post.category), ...blogPosts.filter((item) => item.slug !== post.slug && item.category !== post.category)].slice(0, 2);
  const publishedLabel = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(`${post.published}T12:00:00Z`));
  return <main className="inner-page article-page"><ArticleProgress/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><section className="article-hero image-article-hero"><div className="article-hero-image" style={{backgroundImage:`url(${post.image})`}}/><div className="article-hero-shade"/><SiteHeader/><div className="shell article-hero-content"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/blog">Blog</Link><span>/</span><span>{post.category}</span></nav><p className="eyebrow light">{post.category}</p><h1>{post.title}</h1><div className="article-meta"><span>{post.readingTime}</span><time dateTime={post.published}>{publishedLabel}</time></div>{post.imageNote && <small className="v21-article-image-note">{post.imageNote}</small>}</div></section><div className="article-layout shell"><aside className="article-sidebar"><p className="eyebrow">Bu Yazıda</p><nav aria-label="Yazı bölümleri">{post.sections.map((section,index)=><a key={section.heading} href={`#bolum-${index+1}`}><span>{String(index+1).padStart(2,"0")}</span>{section.heading}</a>)}</nav><ArticleShareTools title={post.title} url={articleUrl}/></aside><article className="article-content"><p className="article-lead">{post.intro}</p>{post.sections.map((section,index)=><section key={section.heading} id={`bolum-${index+1}`}><h2>{section.heading}</h2>{section.paragraphs?.map((paragraph)=><p key={paragraph}>{paragraph}</p>)}{section.bullets&&<ul>{section.bullets.map((bullet)=><li key={bullet}>{bullet}</li>)}</ul>}</section>)}<aside className="article-disclaimer"><b>Teknik not</b><p>Bu içerik genel bilgilendirme amaçlıdır. Projeye özel zemin, hesap, mevzuat, izin ve saha koşulları yetkili uzmanlar tarafından ayrıca değerlendirilmelidir.</p></aside><section className="related-articles"><p className="eyebrow">İlgili Yazılar</p>{related.map((item)=><Link href={`/blog/${item.slug}`} key={item.slug}><span>{item.category}</span><b>{item.title}</b><i aria-hidden="true">↗</i></Link>)}</section></article></div><section className="service-cta"><div className="shell"><p className="eyebrow light">Projenize Özel Değerlendirme</p><h2>Genel bilgiyi,<br/><em>somut proje kararına dönüştürelim.</em></h2><a className="button copper" href="/iletisim">Projenizi Gönderin <span>↗</span></a></div></section><SiteFooter/></main>;
}
