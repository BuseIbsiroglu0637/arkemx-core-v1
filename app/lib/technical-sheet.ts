import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { createDocumentIdentity } from "./document-identity.ts";

export type TechnicalSheetPoint = { x: number; y: number; label?: string };
export type TechnicalSheetPolyline = { points: TechnicalSheetPoint[]; role?: "primary" | "secondary" | "grid" | "warning"; closed?: boolean };
export type TechnicalSheetInput = {
  projectName: string; projectCode: string; module: string; drawingTitle: string;
  drawingSubtitle?: string; revision?: string; status?: string; sheetNo?: string;
  detailsNote?: string;
  scale?: string; coordinateSystem?: string; preparedBy?: string; checkedBy?: string;
  /** Degrees clockwise from page-up. Omit when north has not been established. */
  northAngleDegrees?: number;
  polylines: TechnicalSheetPolyline[]; metrics?: Array<[string, string]>; notes?: string[];
  legend?: Array<[string, "primary" | "secondary" | "grid" | "warning"]>;
  coordinates?: Array<[string, string, string]>;
  labels?: {x:number;y:number;width:number;lines:string[]}[];
};
export type TechnicalSheetAssets = { regularFont: Uint8Array; boldFont: Uint8Array; logo: Uint8Array };
const C = { navy: rgb(.035, .13, .18), copper: rgb(.65, .32, .16), slate: rgb(.29, .37, .41), line: rgb(.76, .81, .81), pale: rgb(.94, .96, .95), white: rgb(1, 1, 1), grid: rgb(.70, .78, .79), warning: rgb(.70, .21, .18) };
const ROLES = { primary: C.copper, secondary: C.navy, grid: C.grid, warning: C.warning };
const DISCLAIMER = "Ön değerlendirme / kavramsal çalışma. Ruhsat, aplikasyon, statik uygunluk veya uygulama projesi değildir.";
let browserAssetPromise: Promise<TechnicalSheetAssets> | null = null;
const clean = (v: unknown, fallback = "Belirtilmedi") => String(v ?? "").replace(/\s+/g, " ").trim() || fallback;
async function fetchBytes(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Teknik pafta varlığı yüklenemedi: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}
async function resolveAssets(assets?: TechnicalSheetAssets) {
  if (assets) return assets;
  browserAssetPromise ??= Promise.all([fetchBytes("/fonts/ArkemSans-Regular.ttf"), fetchBytes("/fonts/ArkemSans-Bold.ttf"), fetchBytes("/brand/arkem-a-mark.png")])
    .then(([regularFont, boldFont, logo]) => ({ regularFont, boldFont, logo }))
    .catch(error => { browserAssetPromise = null; throw error; });
  return browserAssetPromise;
}
function wrap(value: string, font: PDFFont, size: number, width: number) {
  const words: string[] = [];
  for (const word of clean(value).split(" ")) {
    let part = "";
    for (const char of word) {
      if (part && font.widthOfTextAtSize(part + char, size) > width) { words.push(part); part = ""; }
      part += char;
    }
    if (part) words.push(part);
  }
  const lines: string[] = []; let line = "";
  for (const word of words) {
    if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
function bounded(value: string, font: PDFFont, size: number, width: number, limit: number) {
  const lines = wrap(value, font, size, width);
  if (lines.length <= limit) return lines;
  const output = lines.slice(0, limit); let last = output[limit - 1];
  while (last && font.widthOfTextAtSize(last + "…", size) > width) last = last.slice(0, -1);
  output[limit - 1] = last + "…";
  return output;
}
function text(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size = 9, color = C.navy, width = 500, limit = 1) {
  const lines = bounded(clean(value), font, size, width, limit);
  lines.forEach((line, i) => page.drawText(line, { x, y: y - i * size * 1.35, font, size, color }));
  return lines.length * size * 1.35;
}
function rule(page: PDFPage, x: number, y: number, width: number, color = C.line, thickness = .6) {
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, color, thickness });
}
function logoLockup(page: PDFPage, logo: PDFImage, bold: PDFFont, regular: PDFFont, x: number, y: number) {
  page.drawImage(logo, { x, y, width: 32, height: 32 * logo.height / logo.width });
  text(page, "ARKEM", x + 42, y + 15, bold, 19);
  text(page, "YAPI SİSTEMLERİ", x + 43, y + 2, regular, 8, C.copper);
}
async function setup(input: TechnicalSheetInput, assets?: TechnicalSheetAssets) {
  const data = await resolveAssets(assets); const document = await PDFDocument.create(); document.registerFontkit(fontkit);
  const [regular, bold, logo] = await Promise.all([document.embedFont(data.regularFont, { subset: true }), document.embedFont(data.boldFont, { subset: true }), document.embedPng(data.logo)]);
  document.setAuthor("Arkem Yapı Sistemleri"); document.setCreator("ARKEMX Teknik Çıktı Motoru");
  document.setProducer("ARKEMX / Kurumsal Pafta Standardı 4.0"); document.setSubject(clean(input.module));
  document.setTitle(`${clean(input.projectCode)} - ${clean(input.drawingTitle)}`);
  return { document, regular, bold, logo, identity: createDocumentIdentity(input) };
}
type Box = { x: number; y: number; width: number; height: number };
function geometryPlot(page: PDFPage, input: TechnicalSheetInput, box: Box, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ ...box, color: C.pale, borderColor: C.line, borderWidth: .7 });
  const lines = input.polylines.filter(p => p.points.length >= 2 && p.points.every(v => Number.isFinite(v.x) && Number.isFinite(v.y)));
  const points = lines.flatMap(p => p.points);
  if (!points.length) { text(page, "Geometri henüz eklenmedi", box.x + 20, box.y + box.height / 2, bold, 12); return "Ölçeksiz"; }
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const w = Math.max(maxX - minX, .01), h = Math.max(maxY - minY, .01);
  const available = { width: box.width - 90, height: box.height - 115 };
  const needed = Math.max(w * 2834.645669 / available.width, h * 2834.645669 / available.height);
  const scales = [10, 20, 25, 50, 75, 100, 125, 200, 250, 500, 750, 1000, 1500, 2000, 5000, 10000];
  const denominator = scales.find(s => s >= needed) ?? Math.ceil(needed / 10000) * 10000;
  const factor = 2834.645669 / denominator; // input metres -> PDF points at the stated physical print scale
  const x0 = box.x + (box.width - w * factor) / 2, y0 = box.y + 63 + (available.height - h * factor) / 2;
  const map = (p: TechnicalSheetPoint) => ({ x: x0 + (p.x - minX) * factor, y: y0 + (p.y - minY) * factor });
  text(page, "TEKNİK GÖRÜNÜŞ", box.x + 16, box.y + box.height - 23, bold, 8.5, C.copper);
  text(page, `1:${denominator}  ·  %100 baskı`, box.x + box.width - 170, box.y + box.height - 23, regular, 8.5, C.slate, 154);
  lines.sort((a, b) => (a.role === "grid" ? -1 : 0) - (b.role === "grid" ? -1 : 0)).forEach(p => {
    const mapped = p.points.map(map); const color = ROLES[p.role ?? "secondary"];
    const thickness = p.role === "primary" ? 1.7 : p.role === "grid" ? .45 : 1.05;
    const draw = (a: TechnicalSheetPoint, b: TechnicalSheetPoint) => page.drawLine({ start: a, end: b, color, thickness });
    mapped.slice(1).forEach((point, i) => draw(mapped[i], point));
    if (p.closed !== false && mapped.length > 2) draw(mapped[mapped.length - 1], mapped[0]);
    p.points.forEach((point, i) => {
      if (!point.label) return;
      const q = mapped[i]; page.drawCircle({ x: q.x, y: q.y, size: 2.3, color: C.white, borderColor: color, borderWidth: .8 });
      text(page, point.label, q.x + 5, q.y + 5, bold, 8, C.navy, 80);
    });
  });
  (input.labels ?? []).forEach(label=>{
    const q=map(label),maxWidth=Math.max(10,label.width*factor-4);
    label.lines.forEach((line,i)=>{
      const font=i===0?bold:regular,size=i===0?7:Math.min(6,maxWidth*.98/Math.max(1,font.widthOfTextAtSize(line,1)));
      const fitted=bounded(line,font,size,maxWidth,1)[0]??"";
      page.drawText(fitted,{x:q.x-font.widthOfTextAtSize(fitted,size)/2,y:q.y+8-i*9,font,size,color:C.navy});
    });
  });
  // Never invent a north direction for non-georeferenced module drawings.
  if (Number.isFinite(input.northAngleDegrees)) {
    const angle = input.northAngleDegrees! * Math.PI / 180;
    const base = { x: box.x + box.width - 28, y: box.y + box.height - 72 };
    const tip = { x: base.x + Math.sin(angle) * 25, y: base.y + Math.cos(angle) * 25 };
    page.drawLine({ start: base, end: tip, color: C.navy, thickness: 1.5 });
    text(page, "K", tip.x - 3, tip.y + 6, bold, 9);
  }
  const barMetres = denominator / 50, barLength = barMetres * factor;
  const barX = box.x + 20, barY = box.y + 30;
  rule(page, barX, barY, barLength, C.navy, 2);
  [0, .5, 1].forEach(f => {
    page.drawLine({ start: { x: barX + barLength * f, y: barY - 3 }, end: { x: barX + barLength * f, y: barY + 3 }, color: C.navy, thickness: .8 });
    text(page, `${barMetres * f}${f === 1 ? " m" : ""}`, barX + barLength * f - 2, barY + 8, regular, 8);
  });
  text(page, "Çizim birimi: metre · Kaynak hassasiyeti ile sınırlıdır", barX, box.y + 10, regular, 8, C.slate, box.width - 35);
  return `1:${denominator}`;
}

/** One A3 landscape sheet: intentionally concise; the A4 report retains the complete record. */
export async function createCorporateTechnicalPdf(input: TechnicalSheetInput, suppliedAssets?: TechnicalSheetAssets) {
  const { document, regular, bold, logo, identity } = await setup(input, suppliedAssets);
  const page = document.addPage([1190.55, 841.89]); const right = 1158.55;
  page.drawRectangle({ x: 20, y: 20, width: 1150.55, height: 801.89, borderColor: C.navy, borderWidth: 1 });
  logoLockup(page, logo, bold, regular, 38, 766);
  text(page, clean(input.module), 280, 789, bold, 9, C.copper, 590);
  text(page, input.drawingTitle, 280, 765, bold, 18, C.navy, 675, 2);
  text(page, `A3 / ${clean(input.sheetNo, "A-001")}`, 1000, 789, bold, 12, C.navy, 150);
  text(page, `Rev. ${clean(input.revision, "P01")}`, 1000, 768, regular, 9, C.slate, 150);
  rule(page, 32, 737, right - 32, C.navy, 1.1);
  const scale = geometryPlot(page, input, { x: 32, y: 182, width: 765, height: 538 }, regular, bold);
  const sx = 818, sw = 325; let sy = 703;
  const heading = (label: string) => { text(page, label, sx, sy, bold, 10, C.copper, sw); sy -= 10; rule(page, sx, sy, sw); sy -= 19; };
  const field = (label: string, value: string, lines = 2) => { text(page, label, sx, sy, regular, 8, C.slate, sw); sy -= 14; sy -= text(page, value, sx, sy, bold, 10, C.navy, sw, lines) + 8; };
  heading("01 / PROJE KİMLİĞİ");
  field("Proje / parsel", input.projectName);
  field("Proje kodu", input.projectCode, 1);
  field("Veri durumu", clean(input.status, "Kavramsal / doğrulama bekliyor"));
  heading("02 / TEKNİK ÖZET");
  const metrics = (input.metrics ?? []).slice(0, 7);
  metrics.forEach(([label, value]) => {
    text(page, label, sx, sy, regular, 9, C.slate, 165, 2);
    text(page, value, sx + 173, sy, bold, 10, C.navy, sw - 173, 2);
    sy -= 31;
  });
  if (sy > 239) {
    heading("03 / ÇİZİM LEJANTI");
    (input.legend ?? [["Ön yapı", "primary"], ["Kaynak sınırı", "secondary"]]).slice(0, Math.max(0, Math.floor((sy - 212) / 19))).forEach(([label, role]) => {
      rule(page, sx, sy + 3, 23, ROLES[role as keyof typeof ROLES], role === "primary" ? 1.7 : .8);
      text(page, label, sx + 33, sy, regular, 9, C.slate, sw - 33); sy -= 19;
    });
  }
  text(page, input.detailsNote ?? "Tam veri, kaynak ve notlar: A4 özet rapor", sx, 192, regular, 8, C.slate, sw);
  page.drawRectangle({ x: 32, y: 65, width: right - 32, height: 99, color: C.pale, borderColor: C.line, borderWidth: .7 });
  text(page, "KAPSAM VE KAYNAK", 46, 144, bold, 8.5, C.copper);
  text(page, clean(input.drawingSubtitle, DISCLAIMER), 46, 126, regular, 9, C.navy, 625, 2);
  text(page, clean(input.notes?.[0], DISCLAIMER), 46, 94, regular, 8.5, C.slate, 625, 2);
  const meta = [["Ölçek / birim", `${scale} / metre`], ["Koordinat", clean(input.coordinateSystem, "Yerel model / yön doğrulanmadı")], ["Hazırlayan / kontrol", `${clean(input.preparedBy, "ARKEMX")} / ${clean(input.checkedBy, "Uzman kontrolü bekliyor")}`], ["Oluşturma tarihi", new Date().toLocaleDateString("tr-TR")]];
  meta.forEach(([label, value], i) => {
    text(page, label, 705, 145 - i * 21, regular, 8, C.slate, 126);
    text(page, value, 838, 145 - i * 21, bold, 8.5, C.navy, 304);
  });
  text(page, DISCLAIMER, 32, 47, regular, 8.2, C.slate, right - 32);
  text(page, identity.reference, 32, 31, regular, 8, C.slate, 945);
  text(page, "ARKEM-TS / 3.0 · A3", 1000, 31, bold, 8, C.copper, 150);
  return document.save({ useObjectStreams: false });
}

/** Complete A4 report. Rows and paragraphs continue onto new pages, never shrink or silently disappear. */
export async function createCorporateSummaryPdf(input: TechnicalSheetInput, suppliedAssets?: TechnicalSheetAssets) {
  const { document, regular, bold, logo, identity } = await setup(input, suppliedAssets);
  document.setTitle(`${clean(input.projectCode)} - A4 Proje Özet Raporu`);
  const width = 595.28, height = 841.89, left = 38, contentWidth = width - 76;
  let page: PDFPage; let y = 0;
  const newPage = () => {
    page = document.addPage([width, height]); logoLockup(page, logo, bold, regular, left, height - 72);
    text(page, "PROJE ÖZET RAPORU", 312, height - 52, bold, 11, C.navy, 245);
    text(page, `${clean(input.sheetNo, "GEO-001")} / Rev. ${clean(input.revision, "P01")}`, 312, height - 69, regular, 9, C.slate, 245);
    rule(page, left, height - 88, contentWidth, C.navy); y = height - 113;
  };
  const ensure = (space: number) => { if (y - space < 84) newPage(); };
  const paragraph = (value: string, size = 10, color = C.navy) => {
    const lines = wrap(value, regular, size, contentWidth - 16);
    for (const line of lines) { ensure(size * 1.45); text(page, line, left + 8, y, regular, size, color, contentWidth - 16); y -= size * 1.45; }
    y -= 9;
  };
  const heading = (value: string) => { ensure(62); y -= 5; text(page, value, left, y, bold, 11, C.copper, contentWidth); y -= 10; rule(page, left, y, contentWidth); y -= 23; };
  const row = (label: string, value: string) => {
    const labelLines = wrap(label, regular, 9.5, 170), valueLines = wrap(value, bold, 10, contentWidth - 198);
    const count = Math.max(labelLines.length, valueLines.length);
    for (let i = 0; i < count; i++) {
      ensure(17);
      if (labelLines[i]) text(page, labelLines[i], left + 8, y, regular, 9.5, C.slate, 170);
      if (valueLines[i]) text(page, valueLines[i], left + 192, y, bold, 10, C.navy, contentWidth - 198);
      y -= 15;
    }
    rule(page, left, y + 3, contentWidth, C.line, .35); y -= 10;
  };
  newPage();
  text(page!, input.projectName, left, y, bold, 17, C.navy, contentWidth, 2); y -= 49;
  paragraph(clean(input.status, "Kavramsal / doğrulama bekliyor"), 10, C.copper);
  paragraph(DISCLAIMER, 9, C.slate);
  heading("01 / Çalışma kaydı");
  row("Proje / parsel", clean(input.projectName)); row("Proje kodu", clean(input.projectCode)); row("Modül", clean(input.module));
  row("Pafta", clean(input.drawingTitle)); row("Koordinat referansı", clean(input.coordinateSystem, "Yerel model"));
  row("Oluşturma tarihi", new Date().toLocaleDateString("tr-TR"));
  row("Hazırlayan / kontrol", `${clean(input.preparedBy, "ARKEMX")} / ${clean(input.checkedBy, "Uzman kontrolü bekliyor")}`);
  if (input.metrics?.length) { heading("02 / Hesap ve karar özeti"); input.metrics.forEach(([label, value]) => row(label, value)); }
  if (input.polylines.length) {
    ensure(249); y -= 217;
    geometryPlot(page!, input, { x: left, y, width: contentWidth, height: 229 }, regular, bold); y -= 27;
  }
  heading("03 / Kaynak, varsayım ve değerlendirme notları");
  if (input.drawingSubtitle) paragraph(input.drawingSubtitle);
  (input.notes?.length ? input.notes : ["Bu çalışma için kaynak ve hesap kabulleri henüz eklenmedi. Yetkili uzman incelemesi gereklidir."]).forEach((note, i) => paragraph(`${String(i + 1).padStart(2, "0")} · ${note}`));
  if (input.coordinates?.length) {
    heading("04 / Kaynak koordinatları");
    paragraph(`Referans: ${clean(input.coordinateSystem, "Belirtilmedi")}. Yerel model geometrisi ile kaynak koordinatları farklı referanslarda olabilir; aplikasyon ölçüsü değildir.`, 9, C.slate);
    input.coordinates.forEach(([name, first, second]) => row(name, `${first}  /  ${second}`));
  }
  heading("SONRAKİ ADIM / Aynı proje ile devam edin");
  paragraph("Pafta ve bu raporu birlikte saklayın. Kaynakları doğruladıktan sonra sistem seçimi, ön maliyet ve iş programı modüllerine aynı proje kaydıyla devam edin. İmar bulunamadıysa çalışma kavramsal senaryo olarak sürdürülür; izin verilen yapılaşma hakkı anlamına gelmez.", 10);
  document.getPages().forEach((p, i, pages) => {
    rule(p, left, 65, contentWidth);
    text(p, "Ön değerlendirme · Resmî onay veya uygulama projesi değildir.", left, 50, regular, 8, C.slate, contentWidth);
    text(p, identity.reference, left, 35, regular, 8, C.slate, contentWidth - 52);
    text(p, `${i + 1} / ${pages.length}`, width - 72, 35, bold, 9, C.navy, 40);
  });
  return document.save({ useObjectStreams: false });
}
