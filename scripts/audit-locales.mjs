import fs from "node:fs";
import { v3CriticalPhrases, v3Translations } from "../app/data/i18n-v3.ts";

const localeFiles = {
  az: "i18n-az.json",
  ru: "i18n-ru.json",
  it: "i18n-it.json",
  de: "i18n-de.json",
  fr: "i18n-fr.json",
};

const terminology = {
  az: {
    "Taşıyıcı sistem": /daşıyıcı sistem/i,
    "Betonarme prefabrik": /yığma dəmir-beton/i,
    "Uygulama projesi": /[İi]şçi layihə/,
  },
  ru: {
    "Taşıyıcı sistem": /несущ/i,
    "Betonarme prefabrik": /сборн.*железобетон/i,
    "Uygulama projesi": /рабоч/i,
  },
  it: {
    "Taşıyıcı sistem": /sistema strutturale|struttura portante/i,
    "Betonarme prefabrik": /calcestruzzo armato prefabbricato/i,
    "Uygulama projesi": /progett.*esecutiv/i,
  },
  de: {
    "Taşıyıcı sistem": /Tragwerk|Tragsystem/i,
    "Betonarme prefabrik": /Stahlbetonfertig|Betonfertigteil/i,
    "Uygulama projesi": /Ausführungsplanung/i,
  },
  fr: {
    "Taşıyıcı sistem": /système porteur|structure porteuse/i,
    "Betonarme prefabrik": /béton armé préfabriqué/i,
    "Uygulama projesi": /études d.exécution|plans d.exécution|conception d.exécution/i,
  },
};

let failed = false;

for (const [locale, catalogue] of Object.entries(v3Translations)) {
  const missing = v3CriticalPhrases.filter((source) => !catalogue[source] || catalogue[source] === source);
  if (missing.length) {
    console.error(`${locale}: ${missing.length} Web V3.0 critical translations missing`);
    for (const source of missing) console.error(`  - ${source}`);
    failed = true;
  }
  console.log(`${locale}: ${v3CriticalPhrases.length} Web V3.0 critical translations`);
}

for (const [locale, filename] of Object.entries(localeFiles)) {
  const path = new URL(`../app/data/${filename}`, import.meta.url);
  const catalogue = JSON.parse(fs.readFileSync(path, "utf8"));
  const keys = Object.keys(catalogue);
  if (keys.length < 4_000) {
    console.error(`${locale}: only ${keys.length} entries`);
    failed = true;
  }
  for (const [source, expected] of Object.entries(terminology[locale])) {
    const translated = catalogue[source] ?? "";
    if (!expected.test(translated)) {
      console.error(`${locale}: ${source} -> ${translated || "(missing)"}`);
      failed = true;
    }
  }
  const suspicious = keys.filter((key) => catalogue[key] === key && /[ÇĞİÖŞÜçğıöşü]/.test(key));
  // Azerbaijani legitimately shares many words and letters with Turkish;
  // the threshold catches catalogue failure without rejecting valid cognates.
  const unchangedLimit = locale === "az" ? 40 : 20;
  if (suspicious.length > unchangedLimit) {
    console.error(`${locale}: ${suspicious.length} Turkish strings remained unchanged`);
    failed = true;
  }
  console.log(`${locale}: ${keys.length} entries, ${suspicious.length} Turkish-character matches`);
}

if (failed) process.exitCode = 1;
