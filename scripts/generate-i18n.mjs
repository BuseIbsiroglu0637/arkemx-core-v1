import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = process.cwd();
const outputPath = path.join(root, "app/data/i18n-auto.json");
const files = execFileSync("rg", ["--files", "app"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((file) => /\.(tsx|ts)$/.test(file))
  .filter((file) => !file.includes("/api/") && !file.includes("/lib/") && !file.endsWith("i18n.ts"));

const candidates = new Set();
const looksLikePublicCopy = (value) => {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > 900 || text.startsWith("/") || text.startsWith("http")) return false;
  if (/^(?:[.#:]|rgba?\(|linear-gradient|radial-gradient|ARKEM-[A-Z0-9/.-]+$)/.test(text)) return false;
  if (/^[a-z0-9_-]+$/.test(text) && !/[ÇĞİÖŞÜçğıöşü]/.test(text)) return false;
  return /[ÇĞİÖŞÜçğıöşü]|\b(?:ve|veya|bir|için|ile|değil|proje|yapı|mühendislik|teknik|sistem|alan|kat|veri|kontrol|tasarım|arsa|parsel|karar|saha|teslim|maliyet|süre|doküman|yıkım|hizmet|kurumsal|iletişim|görün|açın|başlat)\b/i.test(text);
};

for (const file of files) {
  const sourceFile = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    let value = "";
    if (ts.isJsxText(node)) value = node.text;
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) value = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) value = node.text;
    value = value.replace(/\s+/g, " ").trim();
    if (looksLikePublicCopy(value)) candidates.add(value);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const sourceTexts = [...candidates].sort((a, b) => a.localeCompare(b, "tr"));
const batches = [];
let current = [];
let currentLength = 0;
for (const source of sourceTexts) {
  if (current.length >= 16 || currentLength + source.length > 3200) {
    batches.push(current);
    current = [];
    currentLength = 0;
  }
  current.push(source);
  currentLength += source.length;
}
if (current.length) batches.push(current);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateBatch(batch, batchIndex) {
  const markers = batch.slice(1).map((_, index) => `<<<ARKEM_${batchIndex}_${index + 1}>>>`);
  const joined = batch.map((value, index) => index === 0 ? value : `${markers[index - 1]}\n${value}`).join("\n");
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "tr");
  url.searchParams.set("tl", "en");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", joined);
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Arkem-Public-I18n/1.0" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const translated = payload[0].map((segment) => segment[0]).join("").trim();
      const parts = [];
      let remainder = translated;
      for (const marker of markers) {
        const markerIndex = remainder.indexOf(marker);
        if (markerIndex < 0) throw new Error(`Translation marker lost: ${marker}`);
        parts.push(remainder.slice(0, markerIndex).trim());
        remainder = remainder.slice(markerIndex + marker.length).trim();
      }
      parts.push(remainder.trim());
      return parts;
    } catch (error) {
      lastError = error;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

const translations = {};
let completed = 0;
const workers = Array.from({ length: 3 }, async (_, workerIndex) => {
  for (let batchIndex = workerIndex; batchIndex < batches.length; batchIndex += 3) {
    const batch = batches[batchIndex];
    const translated = await translateBatch(batch, batchIndex);
    batch.forEach((source, index) => {
      translations[source] = translated[index]
        .replaceAll("4B", "4D")
        .replaceAll("5B", "5D")
        .replaceAll("3B", "3D");
    });
    completed += batch.length;
    if (completed % 160 < batch.length) process.stdout.write(`translated ${completed}/${sourceTexts.length}\n`);
  }
});

await Promise.all(workers);
const ordered = Object.fromEntries(Object.entries(translations).sort(([a], [b]) => a.localeCompare(b, "tr")));
fs.writeFileSync(outputPath, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`generated ${Object.keys(ordered).length} public-copy translations`);

