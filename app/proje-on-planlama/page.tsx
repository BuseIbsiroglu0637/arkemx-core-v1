import type { Metadata } from 'next';
import { ParcelPreplanning } from '../components/ParcelContinuation';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';
export const metadata: Metadata = {title:'Proje Ön Planlama | ARKEM',description:'Seçtiğiniz parsel yerleşimini aynı proje içinde ön maliyet ve iş adımlarıyla geliştirin.'};
export default function PreplanningPage(){return <><SiteHeader/><main id="main-content" className="inner-page"><div className="shell section"><header className="parcel-preplanning-heading"><h1>Proje ön planlama</h1><p>Parselinizden ihtiyaç programına, sistem seçimine ve iş adımlarına aynı proje kaydıyla devam edin.</p></header><ParcelPreplanning/></div></main><SiteFooter/></>;}
