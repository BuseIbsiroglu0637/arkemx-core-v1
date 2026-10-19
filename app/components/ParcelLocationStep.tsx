"use client";
import { MapPin, Map as MapIcon, Upload } from "lucide-react";
import { TKGM_PROVINCE_SOURCE } from '../data/tkgm-provinces';
import { LOCATION_DIRECTORY_SOURCE } from '../data/location-directory-source';
type Option = { id: string; label: string };
type Choice = { value: string; options: Option[]; onChange: (id: string) => void };
type Props = {
  province: Choice; district: Choice; neighborhood: Choice;
  neighborhoodName: string; onNeighborhoodName: (name: string) => void;
  block: string; parcelNo: string; onBlock: (value: string) => void; onParcel: (value: string) => void;
  loading: string; searching: boolean; found: boolean; identityReady: boolean; error?: string;
  onSearch: () => void; onImport: () => void; onZoning: () => void; onRetry: () => void;
};
export function ParcelLocationStep(props: Props) {
  const choices = [
    { label: 'İl', field: props.province, level: 'province', disabled: false, placeholder: 'İl seçin' },
    { label: 'İlçe', field: props.district, level: 'district', disabled: !props.province.value, placeholder: props.province.value ? 'İlçe seçin' : 'Önce il seçin' },
    { label: 'Mahalle / köy', field: props.neighborhood, level: 'neighborhood', disabled: !props.district.value, placeholder: props.district.value ? 'Mahalle / köy seçin' : 'Önce ilçe seçin' },
  ];
  const currentSelections = [props.province, props.district, props.neighborhood].every(field => field.options.some(option => option.id === field.value));
  const canContinue = props.identityReady && currentSelections && props.loading === 'idle' && !props.error;
  const staleSelection = choices.find(({ field }) => field.value && field.options.length > 0 && !field.options.some(option => option.id === field.value));
  const nextInstruction = props.found ? 'Parsel bulundu. Haritadaki sınırı inceleyebilirsiniz.'
    : !props.province.value ? 'Önce arsanızın bulunduğu ili seçin.'
    : !props.district.value ? 'Şimdi ilçeyi seçin.'
    : !props.neighborhood.value ? 'Şimdi mahalle veya köyü seçin.'
    : !props.block.trim() || !props.parcelNo.trim() ? 'Tapudaki ada ve parsel numarasını yazın.'
    : 'Bilgiler hazır. Parseli haritada gösterebilirsiniz.';
  return <div className="geo-control-section parcel-location-step">
    <h3><MapPin aria-hidden="true"/>Parselinizi bulun</h3>
    <p className="parcel-input-hint">İl, ilçe, mahalle ve ada/parsel bilgilerini girin. Sorgu sonucu bulunduğunda sınır haritada gösterilir.</p>
    <form onSubmit={event => { event.preventDefault(); if (canContinue && !props.searching) props.onSearch(); }} aria-busy={props.loading !== 'idle' || props.searching}>
      <div className="parcel-search-fields"><p className="parcel-field-heading">Konum <small>Listeleri sırayla seçin</small></p>
        {choices.map(({ label, field, level, disabled, placeholder }) => <label key={level} className="parcel-search-location"><span>{label}</span><select aria-label={label} value={field.options.some(item => item.id === field.value) ? field.value : ''} disabled={disabled || !field.options.length || props.searching} onChange={event => field.onChange(event.target.value)}><option value="">{props.loading === level ? 'Liste yükleniyor…' : placeholder}</option>{field.options.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>)}
        <p className="parcel-field-heading">Tapu bilgileri <small>Tapuda yazan numaralar</small></p>
        <label><span>Ada</span><input aria-label="Ada" value={props.block} onChange={event => props.onBlock(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Örn. 123" maxLength={10} disabled={!props.neighborhood.value || props.searching} /></label>
        <label><span>Parsel</span><input aria-label="Parsel" value={props.parcelNo} onChange={event => props.onParcel(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Örn. 4" maxLength={10} disabled={!props.neighborhood.value || props.searching} /></label>
      </div>
      {staleSelection && props.loading === 'idle' && <p className="parcel-directory-migration" role="status">Kayıtlı {staleSelection.label.toLocaleLowerCase('tr-TR')} seçiminizi güncel listeden yeniden seçin. Eski kaydınız silinmedi; belirsiz isimler otomatik eşleştirilmez.</p>}
      {props.error && <div className="parcel-directory-error" role="alert"><b>Konum listesi yüklenemedi</b><p>{props.error}</p><div className="parcel-recovery-actions"><button type="button" onClick={props.onRetry} disabled={props.loading !== 'idle'}>Listeyi yeniden yükle</button><a href="https://parselsorgu.tkgm.gov.tr/" target="_blank" rel="noreferrer">Resmî Parsel Sorgu’yu aç ↗</a></div></div>}
      <button className="geo-wide-action parcel-search-submit" type="submit" disabled={!canContinue || props.searching}><MapIcon aria-hidden="true"/>{props.searching ? 'Parsel aranıyor…' : props.found ? 'Parseli yeniden göster' : 'Parseli haritada göster →'}</button>
    </form>
    <button type="button" className="parcel-import-button" onClick={props.onImport}><Upload aria-hidden="true"/>KML / GeoJSON içe aktar</button>
    <p className="parcel-next-instruction" role="status">{props.loading !== 'idle' ? 'Konum listesi yükleniyor…' : props.error ? 'Konum listesini yeniden yükleyin.' : nextInstruction}</p>
    <p className="parcel-directory-caption" role="status">{props.loading !== 'idle' ? 'Konum listesi yükleniyor…' : props.error ? 'Listeyi yeniden yükleyin; mevcut girdileriniz korunur.' : props.neighborhood.options.length ? `${props.neighborhood.options.length} mahalle / köy · Konum dizini hazır` : props.district.options.length ? `${props.district.options.length} ilçe · Bir ilçe seçin` : 'Seçiminiz bir sonraki listeyi açar.'}</p>
    <details className="parcel-boundary-connection-note"><summary>Sorgu nasıl çalışır?</summary><b>Parsel sınırı otomatik sorgulanır.</b><p>Seçtiğiniz il, ilçe ve mahalle/köy TKGM kayıtlarıyla eşleştirilir. Ada ve parsel numaranıza ait kaynak sınırı bulunursa haritada gösterilir; dosya yüklemeniz gerekmez.</p><a href="https://parselsorgu.tkgm.gov.tr/" target="_blank" rel="noreferrer">Resmî Parsel Sorgu’da sınırı incele ↗</a><small>Sorgu sonucu kaynak servis erişimine bağlıdır; tapu, aplikasyon veya imar onayı değildir.</small></details>
    <details className="parcel-directory-provenance"><summary>Konum listesinin kaynağı</summary><p>İl listesi: TKGM kaynak kaydı · {new Date(TKGM_PROVINCE_SOURCE.capturedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}. İlçe ve mahalle/köy: {LOCATION_DIRECTORY_SOURCE.name} · {LOCATION_DIRECTORY_SOURCE.datasetVersion} veri sürümü. Bağımsız yerleşim dizinidir; TKGM kadastro kimliği veya güncel imar bilgisi sağlamaz.</p><a href="/data/location-directory/LICENSE.txt" target="_blank" rel="noreferrer">Veri lisansı ve telif bildirimi ↗</a></details>
    {props.found && <button type="button" className="parcel-zoning-next" onClick={props.onZoning}>İmar ve plan notlarını incele →</button>}
    <details className="parcel-search-help"><summary>Parsel bulunamazsa · dosya ve diğer seçenekler</summary><p>Ada numarası olmayan kayıt için tapudaki ada değerini (varsa 0) kullanın. Kaynak sınırı alınamazsa durum açıkça gösterilir. Elinizde doğrulanabilir bir sınır dosyası varsa uzman aktarımını ayrıca kullanabilirsiniz.</p><a href="https://parselsorgu.tkgm.gov.tr/" target="_blank" rel="noreferrer">Resmî Parsel Sorgu’yu aç ↗</a><button type="button" onClick={props.onRetry} disabled={props.loading !== 'idle'}>Seçim listelerini yenile</button></details>
  </div>;
}
