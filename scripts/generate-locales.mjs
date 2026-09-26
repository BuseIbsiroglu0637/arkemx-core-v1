import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../app/data/i18n.ts", import.meta.url), "utf8");
const automatic = JSON.parse(await fs.readFile(new URL("../app/data/i18n-auto.json", import.meta.url), "utf8"));
const exactSource = source.split("const exact:")[1]?.split("};")[0] ?? "";
const exactPattern = /^\s*"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)",?\s*$/gm;
const exactKeys = [];
let match;
while ((match = exactPattern.exec(exactSource))) exactKeys.push(JSON.parse(`"${match[1]}"`));

const entries = [...new Set([...Object.keys(automatic), ...exactKeys])]
  .filter((value) => value.trim() && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value));

function createBatches(values, limit = 3_350) {
  const batches = [];
  let batch = [];
  let length = 0;
  for (const value of values) {
    const addition = value.length + 14;
    if (batch.length && length + addition > limit) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(value);
    length += addition;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

const canonicalTerms = {
  az: {
    "Taşıyıcı sistem": "Daşıyıcı sistem",
    "Taşıyıcı Sistem": "Daşıyıcı sistem",
    "Betonarme prefabrik": "Yığma dəmir-beton",
    "Betonarme Prefabrik": "Yığma dəmir-beton",
    "Yerinde dökme betonarme": "Yerində tökmə dəmir-beton",
    "Hafif çelik": "Yüngül polad konstruksiyalar",
    "Yapısal çelik": "Polad daşıyıcı konstruksiyalar",
    "Uygulama projesi": "İşçi layihə",
    "Mühendislik Koordinasyon": "Mühəndislik koordinasiyası",
    "Kontrollü Yıkım": "Nəzarətli söküntü",
    "Patlatmalı Bina Yıkımı": "Partlayışla bina söküntüsü",
  },
  ru: {
    "Taşıyıcı sistem": "Несущая система",
    "Taşıyıcı Sistem": "Несущая система",
    "Betonarme prefabrik": "Сборный железобетон",
    "Betonarme Prefabrik": "Сборный железобетон",
    "Yerinde dökme betonarme": "Монолитный железобетон",
    "Hafif çelik": "Лёгкие стальные тонкостенные конструкции",
    "Yapısal çelik": "Стальные несущие конструкции",
    "Uygulama projesi": "Рабочий проект",
    "Mühendislik Koordinasyon": "Инженерная координация",
    "Kontrollü Yıkım": "Контролируемый снос",
    "Patlatmalı Bina Yıkımı": "Взрывной снос зданий",
  },
  it: {
    "Taşıyıcı sistem": "Sistema strutturale",
    "Taşıyıcı Sistem": "Sistema strutturale",
    "Betonarme prefabrik": "Calcestruzzo armato prefabbricato",
    "Betonarme Prefabrik": "Calcestruzzo armato prefabbricato",
    "Yerinde dökme betonarme": "Calcestruzzo gettato in opera",
    "Hafif çelik": "Strutture in acciaio leggero",
    "Yapısal çelik": "Strutture portanti in acciaio",
    "Uygulama projesi": "Progettazione esecutiva",
    "Mühendislik Koordinasyon": "Coordinamento ingegneristico",
    "Kontrollü Yıkım": "Demolizione controllata",
    "Patlatmalı Bina Yıkımı": "Demolizione di edifici con esplosivi",
  },
  de: {
    "Taşıyıcı sistem": "Tragwerk",
    "Taşıyıcı Sistem": "Tragwerk",
    "Betonarme prefabrik": "Stahlbetonfertigteilbau",
    "Betonarme Prefabrik": "Stahlbetonfertigteilbau",
    "Yerinde dökme betonarme": "Ortbeton",
    "Hafif çelik": "Leichtstahlbau",
    "Yapısal çelik": "Stahltragwerk",
    "Uygulama projesi": "Ausführungsplanung",
    "Mühendislik Koordinasyon": "Ingenieurtechnische Koordination",
    "Kontrollü Yıkım": "Kontrollierter Rückbau",
    "Patlatmalı Bina Yıkımı": "Sprengabbruch von Gebäuden",
  },
  fr: {
    "Taşıyıcı sistem": "Système porteur",
    "Taşıyıcı Sistem": "Système porteur",
    "Betonarme prefabrik": "Béton armé préfabriqué",
    "Betonarme Prefabrik": "Béton armé préfabriqué",
    "Yerinde dökme betonarme": "Béton coulé en place",
    "Hafif çelik": "Structures légères en acier",
    "Yapısal çelik": "Structure porteuse en acier",
    "Uygulama projesi": "Études d’exécution",
    "Mühendislik Koordinasyon": "Coordination des études d’ingénierie",
    "Kontrollü Yıkım": "Démolition contrôlée",
    "Patlatmalı Bina Yıkımı": "Démolition de bâtiments à l’explosif",
  },
};

async function translateBatch(values, target, attempt = 0) {
  const payload = values.map((value, index) => `⟦${String(index).padStart(4, "0")}⟧ ${value}`).join("\n");
  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", "tr");
  endpoint.searchParams.set("tl", target);
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("q", payload);
  try {
    const response = await fetch(endpoint, { headers: { "user-agent": "Arkem-Static-Locale-Builder/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const translated = body[0].map((part) => part[0]).join("");
    const pieces = [...translated.matchAll(/⟦(\d{4})⟧\s*([\s\S]*?)(?=\n?⟦\d{4}⟧|$)/g)];
    if (pieces.length !== values.length) throw new Error(`Expected ${values.length} entries, received ${pieces.length}`);
    return pieces.map((piece) => piece[2].trim());
  } catch (error) {
    if (attempt >= 4) throw error;
    await wait(700 * (attempt + 1));
    return translateBatch(values, target, attempt + 1);
  }
}

async function generate(target) {
  const batches = createBatches(entries);
  const translated = {};
  for (let cursor = 0; cursor < batches.length; cursor += 4) {
    const window = batches.slice(cursor, cursor + 4);
    const results = await Promise.all(window.map((batch) => translateBatch(batch, target)));
    window.forEach((batch, batchIndex) => {
      batch.forEach((sourceValue, itemIndex) => {
        translated[sourceValue] = results[batchIndex][itemIndex];
      });
    });
    process.stdout.write(`${target}: ${Math.min(cursor + window.length, batches.length)}/${batches.length}\r`);
    await wait(90);
  }
  Object.assign(translated, canonicalTerms[target]);
  await fs.writeFile(new URL(`../app/data/i18n-${target}.json`, import.meta.url), `${JSON.stringify(translated, null, 2)}\n`);
  process.stdout.write(`${target}: ${entries.length} entries written\n`);
}

const supportedTargets = new Set(["az", "ru", "it", "de", "fr"]);
const requestedTargets = process.argv.slice(2);
const targets = requestedTargets.length ? requestedTargets : [...supportedTargets];

for (const target of targets) {
  if (!supportedTargets.has(target)) {
    throw new Error(`Unsupported locale "${target}". Use: ${[...supportedTargets].join(", ")}`);
  }
}

for (const target of targets) await generate(target);
