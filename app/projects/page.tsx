import { permanentRedirect } from "next/navigation";

/**
 * Eski Wix/İngilizce proje liste bağlantılarını Türkçe kanonik arşive taşır.
 * Yeni iç bağlantıların tamamı doğrudan /projeler kullanır.
 */
export default function LegacyProjectsPage() {
  permanentRedirect("/projeler");
}
