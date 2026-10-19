/** Official-source handoff coverage, not an authorized municipal data API. */
export const PRIORITY_ZONING_REGIONS = [
  {
    province: 'İstanbul',
    routingScope: 'regional-research',
    districts: ['Adalar','Arnavutköy','Ataşehir','Avcılar','Bağcılar','Bahçelievler','Bakırköy','Başakşehir','Bayrampaşa','Beşiktaş','Beykoz','Beylikdüzü','Beyoğlu','Büyükçekmece','Çatalca','Çekmeköy','Esenler','Esenyurt','Eyüpsultan','Fatih','Gaziosmanpaşa','Güngören','Kadıköy','Kağıthane','Kartal','Küçükçekmece','Maltepe','Pendik','Sancaktepe','Sarıyer','Silivri','Sultanbeyli','Sultangazi','Şile','Şişli','Tuzla','Ümraniye','Üsküdar','Zeytinburnu'],
    districtSource: 'https://istanbul.gov.tr/',
    sourcePage: 'https://ibb.istanbul/ibb/belediye-hakkinda/yetki-alani/',
    portalId: 'istanbul-plan-aski',
    label: 'İBB Plan ve Askı Sorgulama',
    authority: 'İstanbul Büyükşehir Belediyesi',
    href: 'https://planaski.ibb.gov.tr/',
    verifiedAt: '2026-10-03',
    verification: 'Sorgu alanları ve kaynak bağlantısı görüldü; canlı parsel sonucu ve harita katmanları ayrıca kontrol edilmelidir.',
    limitation: '39 ilçe için ortak plan araştırma kaynağıdır. İlçe uygulama koşulları, plan notları ve onaylı imar durumu ilgili yetkili idareden ayrıca alınır.',
  },
  {
    province: 'Ankara',
    routingScope: 'regional-research',
    districts: ['Akyurt','Altındağ','Ayaş','Bala','Beypazarı','Çamlıdere','Çankaya','Çubuk','Elmadağ','Etimesgut','Evren','Gölbaşı','Güdül','Haymana','Kahramankazan','Kalecik','Keçiören','Kızılcahamam','Mamak','Nallıhan','Polatlı','Pursaklar','Sincan','Şereflikoçhisar','Yenimahalle'],
    districtSource: 'https://www.ankara.gov.tr/yoneticilerimiz',
    sourcePage: 'https://www.ankara.bel.tr/hizmetler/interaktif-hizmetler',
    portalId: 'ankara-eimar',
    label: 'Ankara Büyükşehir E-İmar',
    authority: 'Ankara Büyükşehir Belediyesi',
    href: 'https://eimar.ankara.bel.tr/',
    verifiedAt: '2026-10-03',
    verification: 'Belediyenin resmî bağlantısı ve sayfa yanıtı kontrol edildi; etkileşimli harita ve canlı parsel sonucu doğrulanmadı.',
    limitation: '25 ilçe için ortak resmî kaynak erişimidir. Parsel verisinin bulunması ve güncelliği garanti edilmez; onaylı belge ilgili idareden alınır.',
  },
  {
    province: 'İzmir',
    routingScope: 'regional-research',
    districts: ['Aliağa','Balçova','Bayındır','Bayraklı','Bergama','Beydağ','Bornova','Buca','Çeşme','Çiğli','Dikili','Foça','Gaziemir','Güzelbahçe','Karabağlar','Karaburun','Karşıyaka','Kemalpaşa','Kınık','Kiraz','Konak','Menderes','Menemen','Narlıdere','Ödemiş','Seferihisar','Selçuk','Tire','Torbalı','Urla'],
    districtSource: 'https://www.izmir.bel.tr/tr/buyuksehirsinirharitasi/125/212',
    sourcePage: 'https://eislem.izmir.bel.tr/',
    portalId: 'izmir-kent-rehberi',
    label: 'İzmir Büyükşehir Kent Rehberi',
    authority: 'İzmir Büyükşehir Belediyesi',
    href: 'https://kentrehberi.izmir.bel.tr/izmirkentrehberi',
    verifiedAt: '2026-10-04',
    verification: 'E-İşlem Merkezi yönlendirmesi ve hedef sayfa yanıtı kontrol edildi; harita katmanları ve canlı parsel sorgusu doğrulanmadı.',
    limitation: '30 ilçe için ortak kent rehberi erişimidir; her parsel için imar sonucu bulunduğu anlamına gelmez. Uygulama koşulları ve resmî belge ilgili idareden doğrulanır.',
  },
  {
    province: 'Sakarya',
    routingScope: 'regional-research',
    districts: ['Adapazarı','Akyazı','Arifiye','Erenler','Ferizli','Geyve','Hendek','Karapürçek','Karasu','Kaynarca','Kocaali','Pamukova','Sapanca','Serdivan','Söğütlü','Taraklı'],
    districtSource: 'https://www.sakarya.bel.tr/tr/Belediyelerimiz',
    sourcePage: 'https://www.sakarya.bel.tr/haritalar.aspx/Haber/buyuksehir-size-tek-tikla-%E2%80%98yol-gosterecek-kent-rehberi-dijital-platforma-tasindi/24513',
    portalId: 'sakarya-kent-rehberi',
    label: 'Sakarya Büyükşehir İmar Haritası',
    authority: 'Sakarya Büyükşehir Belediyesi',
    href: 'https://rehber.sakarya.bel.tr/harita/imar',
    verifiedAt: '2026-10-03',
    verification: 'Resmî belediye kaynağı ve harita adresi kontrol edildi. Görüntüleyici bilgileri resmî işlemlerde kullanılmaz.',
    limitation: '16 ilçe için ortak plan araştırma kaynağıdır. Görüntüleyici ön bilgi sunar; onaylı imar durumu ve plan notları yetkili idareden alınır.',
  },
  {
    province: 'Kastamonu',
    routingScope: 'district-directory-only',
    districts: ['Merkez','Abana','Ağlı','Araç','Azdavay','Bozkurt','Cide','Çatalzeytin','Daday','Devrekani','Doğanyurt','Hanönü','İhsangazi','İnebolu','Küre','Pınarbaşı','Seydiler','Şenpazar','Taşköprü','Tosya'],
    districtSource: 'https://www.kastamonu.gov.tr/',
    sourcePage: 'https://www.kastamonuozelidare.gov.tr/',
    portalId: 'kastamonu-ozel-idare',
    label: 'Kastamonu İl Özel İdaresi E-İmar',
    authority: 'Kastamonu İl Özel İdaresi / ilgili belediye',
    href: 'https://e-imar.kastamonuozelidare.gov.tr/',
    verifiedAt: '2026-10-11',
    verification: 'İlçe dizini korundu; il özel idaresi kaynağı il genelinin otomatik yetkili idaresi olarak kullanılmaz. Belediye ve belediye dışı alanların yetki ayrımı parsel bağlamında araştırılır.',
    limitation: '20 ilçe adı yalnız konum dizinidir; imar kapsamı veya yetki kanıtı değildir. İl özel idaresi verisi belediyelerin tamamını kapsamaz. Yetki eşleşmesi bilinmiyorsa otomatik idare seçilmez.',
  },
] as const;

export function normalizeZoningPlace(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ');
}

export function priorityZoningRegion(province: string) {
  return PRIORITY_ZONING_REGIONS.find(region => normalizeZoningPlace(region.province) === normalizeZoningPlace(province)) ?? null;
}

export const PRIORITY_ZONING_DISTRICTS: Record<string, readonly string[]> = Object.fromEntries(
  PRIORITY_ZONING_REGIONS.map(region => [region.province, region.districts]),
);
