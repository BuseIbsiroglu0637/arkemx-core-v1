import type { Metadata } from 'next';
import { ModuleWorkspaceHeader } from '../components/ModuleWorkspaceHeader';
import { SiteFooter } from '../components/SiteChrome';
import { ParcelReviewRequest } from '../components/ParcelReviewRequest';

export const metadata: Metadata = { title: 'Yetkili Parsel ve Tapu İncelemesi', description: 'Malik veya yetkili temsilci için izinli belge incelemesinin kapsamını görüşün. Bu ekrandan tapu sorgusu veya ücret tahsilatı yapılmaz.', alternates: { canonical: '/parsel-uzman-inceleme' } };
export default function ParcelReviewPage() { return <main className="module-workspace-page parcel-review-page"><ModuleWorkspaceHeader title="Yetkili inceleme için doğru başlangıç" description="Kişisel malik bilgisi açık parsel sorgusunda yer almaz. Bu seçenek, erişim ve hizmet kapsamını birlikte belirlemek için ön görüşme talebi oluşturur." target="parsel-inceleme" /><div className="shell parcel-review-shell" id="parsel-inceleme"><ParcelReviewRequest /></div><SiteFooter /></main>; }
