type V3ELanguage = "en" | "az" | "ru" | "it" | "de" | "fr";
type V3ETranslationRow = readonly [string, string, string, string, string, string, string];

const rows = [
  ["DOĞRULANMIŞ PROJE KANITI", "VERIFIED PROJECT EVIDENCE", "DOĞRULANMIŞ LAYİHƏ SÜBUTU", "ПРОВЕРЕННОЕ ДОКАЗАТЕЛЬСТВО ПРОЕКТА", "EVIDENZA DI PROGETTO VERIFICATA", "GEPRÜFTER PROJEKTNACHWEIS", "PREUVE DE PROJET VÉRIFIÉE"],
  ["KANIT BAĞLI PROJELER", "EVIDENCE-LINKED PROJECTS", "SÜBUTA BAĞLI LAYİHƏLƏR", "ПРОЕКТЫ С ПРИВЯЗАННЫМИ ДОКАЗАТЕЛЬСТВАМИ", "PROGETTI COLLEGATI ALLE EVIDENZE", "NACHWEISGEBUNDENE PROJEKTE", "PROJETS LIÉS AUX PREUVES"],
  ["Kaydı inceleyin ↗", "Review record ↗", "Qeydi araşdırın ↗", "Изучить запись ↗", "Esamina la scheda ↗", "Datensatz prüfen ↗", "Consulter la fiche ↗"],
  [
    "Genel vaka aşamaları yalnız proje düzeyi sayaçlarda görünür ve tek başına bir uzmanlığı doğrulamaz. Uzmanlık sayacı, Proje Kanıt Merkezi’nde doğrudan ilgili mühendislik alanına bağlanıp yayımlanan kaynak dosyalarından oluşur.",
    "General case-study stages appear only in project-level counters and do not verify a discipline on their own. A discipline counter is built exclusively from source files linked directly to that engineering field and published through the Project Evidence Centre.",
    "Ümumi keys mərhələləri yalnız layihə səviyyəli sayğaclarda görünür və təkbaşına heç bir ixtisası doğrulamır. İxtisas sayğacı yalnız Layihə Sübut Mərkəzində birbaşa müvafiq mühəndislik sahəsinə bağlanaraq yayımlanan mənbə fayllarından formalaşır.",
    "Общие этапы кейса отображаются только в проектных счётчиках и сами по себе не подтверждают специализацию. Счётчик направления формируется исключительно из исходных файлов, напрямую привязанных к соответствующей инженерной области и опубликованных через Центр доказательств проекта.",
    "Le fasi generali del caso compaiono solo nei contatori di progetto e non verificano da sole una disciplina. Il contatore di disciplina deriva esclusivamente dai file fonte collegati direttamente a quell'ambito ingegneristico e pubblicati tramite il Centro evidenze di progetto.",
    "Allgemeine Fallstudienphasen erscheinen nur in Projektzählern und bestätigen keine Fachdisziplin. Ein Fachzähler entsteht ausschließlich aus Quelldateien, die im Projektnachweiszentrum direkt dem betreffenden Ingenieurbereich zugeordnet und veröffentlicht wurden.",
    "Les étapes générales de l'étude de cas n'apparaissent que dans les compteurs de projet et ne valident aucune discipline à elles seules. Un compteur de discipline repose exclusivement sur les fichiers sources directement liés au domaine d'ingénierie concerné et publiés via le Centre de preuves du projet.",
  ],
  ["UZMANLIK KANITLARI", "DISCIPLINE EVIDENCE", "İXTİSAS SÜBUTLARI", "ДОКАЗАТЕЛЬСТВА ПО СПЕЦИАЛИЗАЦИЯМ", "EVIDENZE PER DISCIPLINA", "FACHSPEZIFISCHE NACHWEISE", "PREUVES PAR DISCIPLINE"],
  ["Mühendislik kapsamı,", "Engineering scope,", "Mühəndislik əhatəsi,", "Инженерный объём,", "Il perimetro ingegneristico,", "Ingenieurumfang,", "Le périmètre d'ingénierie,"],
  ["doğrudan kaynağına bağlı.", "linked directly to its source.", "birbaşa mənbəyinə bağlıdır.", "напрямую связан с источником.", "collegato direttamente alla fonte.", "direkt mit seiner Quelle verknüpft.", "directement lié à sa source."],
  [
    "Bu kayıtlar genel vaka aşamasından üretilmez; Proje Kanıt Merkezi’nde ilgili uzmanlık alanına açıkça bağlanıp yayımlanır.",
    "These records are not derived from a general case-study stage; they are explicitly linked to the relevant discipline and published through the Project Evidence Centre.",
    "Bu qeydlər ümumi keys mərhələsindən yaradılmır; Layihə Sübut Mərkəzində müvafiq ixtisas sahəsinə açıq şəkildə bağlanaraq yayımlanır.",
    "Эти записи не выводятся из общего этапа кейса; они явно привязываются к соответствующей специализации и публикуются через Центр доказательств проекта.",
    "Queste schede non derivano da una fase generale del caso; vengono collegate esplicitamente alla disciplina pertinente e pubblicate tramite il Centro evidenze di progetto.",
    "Diese Datensätze werden nicht aus einer allgemeinen Fallstudienphase abgeleitet; sie werden im Projektnachweiszentrum ausdrücklich der jeweiligen Fachdisziplin zugeordnet und veröffentlicht.",
    "Ces fiches ne sont pas déduites d'une étape générale de l'étude de cas ; elles sont explicitement liées à la discipline concernée et publiées via le Centre de preuves du projet.",
  ],
  ["Kanıt dosyasını inceleyin ↗", "Review evidence file ↗", "Sübut faylını araşdırın ↗", "Изучить файл доказательства ↗", "Esamina il file di evidenza ↗", "Nachweisdatei prüfen ↗", "Consulter le fichier de preuve ↗"],
  ["Mühendislik uzmanlığı", "Engineering discipline", "Mühəndislik ixtisası", "Инженерная специализация", "Disciplina ingegneristica", "Ingenieurdisziplin", "Discipline d'ingénierie"],
  ["Proje kaydına açık kaynak bağlayın.", "Link an explicit source to the project record.", "Layihə qeydinə açıq mənbə bağlayın.", "Привяжите явный источник к записи проекта.", "Collega una fonte esplicita alla scheda progetto.", "Eine eindeutige Quelle mit dem Projektdatensatz verknüpfen.", "Reliez une source explicite à la fiche projet."],
  ["V3.0‑E / PROJE KANIT MERKEZİ", "V3.0‑E / PROJECT EVIDENCE CENTRE", "V3.0‑E / LAYİHƏ SÜBUT MƏRKƏZİ", "V3.0‑E / ЦЕНТР ДОКАЗАТЕЛЬСТВ ПРОЕКТА", "V3.0‑E / CENTRO EVIDENZE DI PROGETTO", "V3.0‑E / PROJEKTNACHWEISZENTRUM", "V3.0‑E / CENTRE DE PREUVES DU PROJET"],
] as const satisfies readonly V3ETranslationRow[];

const languages = ["en", "az", "ru", "it", "de", "fr"] as const satisfies readonly V3ELanguage[];

export const v3eTranslations = Object.fromEntries(languages.map((language, languageIndex) => [
  language,
  Object.fromEntries(rows.map((row) => [row[0], row[languageIndex + 1]])),
])) as Record<V3ELanguage, Record<string, string>>;

export const v3eTranslationSources = Object.freeze(rows.map((row) => row[0]));
