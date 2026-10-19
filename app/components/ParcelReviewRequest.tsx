"use client";

import { useState } from 'react';
import { ProjectBriefForm } from './ProjectBriefForm';
import { useProjectKernel } from './ProjectKernel';
import { customerRecord } from '../lib/customer-journey';

export function ParcelReviewRequest() {
  const { project } = useProjectKernel();
  const record = customerRecord(customerRecord(project.modules['geo-parcel']).parcelRecord);
  const identity = customerRecord(record.identity);
  const [role, setRole] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const target = [identity.province, identity.district, identity.neighborhood, identity.block, identity.parcelNo].filter(Boolean).join(' / ');
  return <section className="parcel-review-request">
    <h2>Önce yetki ve kapsam görüşmesi.</h2>
    <p>Bu seçenek bir tapu sorgusu veya malik listesi satın alma ekranı değildir. Kendi taşınmazınıza veya geçerli temsil yetkinize ilişkin inceleme için iletişim talebi oluşturur.</p>
    <label>Başvuru ilişkiniz<select value={role} onChange={event => { setRole(event.target.value); setAcknowledged(false); }}><option value="">İlişkinizi seçin</option><option value="owner">Malikim</option><option value="representative">Yetkili temsilciyim</option><option value="information">Yalnız süreç hakkında bilgi istiyorum</option></select></label>
    {role && <><p className="parcel-reference">Hedef parsel: {target || 'Başvuruda belirtilecek'}</p><p>İş akışı: talep → yetki ve hukuki dayanak kontrolü → hizmet kapsamı / fiyat onayı → izinli resmî belge incelemesi → yalnız yetkili alıcıya teslim. Hissedarların kişisel bilgileri genel proje raporuna veya herkese açık ekrana aktarılmaz.</p><label className="consent"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>Bu aşamanın yalnız kapsam görüşmesi olduğunu; tapu, kimlik, vekâlet belgesi veya üçüncü kişilerin malik bilgilerini bu forma eklememem gerektiğini anladım.</span></label></>}
    {role && acknowledged && <ProjectBriefForm compact key={`${project.id}:${target}:${role}`} allowFiles={false} prefill={{ location: [identity.province, identity.district].filter(Boolean).join(' / '), stage: 'Fikir aşaması', requestType: 'Teknik danışmanlık', buildingType: 'Diğer' }} projectSummary={`Yetkili tapu / hissedarlık incelemesi için kapsam görüşmesi\nBaşvuru ilişkisi (öz beyan; doğrulanmadı): ${role === 'owner' ? 'Malik' : role === 'representative' ? 'Temsilci' : 'Bilgi talebi'}\nHedef parsel (beyan): ${target || 'Belirtilecek'}\nBu bir ücret tahsilatı veya malik sorgusu değildir. Kapsam, erişim yetkisi ve hukuki dayanak ayrıca incelenecektir.\nKişisel malik / kimlik verisi veya tapu belgesi eklemeyin.`} />}
  </section>;
}
