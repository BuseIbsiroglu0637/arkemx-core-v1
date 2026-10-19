import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { digitalBriefText, type DigitalBrief } from "./digital-brief.ts";

type Assets = { regular: Uint8Array; bold: Uint8Array; logo: Uint8Array };
async function assets(): Promise<Assets> {
  const bytes = await Promise.all(["/fonts/ArkemSans-Regular.ttf", "/fonts/ArkemSans-Bold.ttf", "/brand/arkem-a-mark.png"].map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Dosya varlıkları yüklenemedi.");
    return new Uint8Array(await response.arrayBuffer());
  }));
  return { regular: bytes[0], bold: bytes[1], logo: bytes[2] };
}
function lines(text: string, font: PDFFont, size: number, width: number, onMissing: () => void): string[] {
  const result: string[] = []; let line = "";
  const supported = new Set(font.getCharacterSet());
  text = Array.from(text).map(character => {
    const code = character.codePointAt(0)!;
    if (code < 32 || supported.has(code)) return character;
    onMissing(); return `[U+${code.toString(16).toUpperCase().padStart(4, "0")}]`;
  }).join("");
  // Split even unbroken names/notes; long customer input must never leave the page.
  for (const word of text.replace(/[\u0000-\u001f\u007f]/g, " ").split(/\s+/)) {
    const combined = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(combined, size) <= width) { line = combined; continue; }
    if (line) result.push(line);
    line = "";
    for (const character of word) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) { result.push(line); line = ""; }
      line += character;
    }
  }
  if (line) result.push(line);
  return result;
}
export async function createDigitalBriefPdf(brief: DigitalBrief, generatedAt: string, suppliedAssets?: Assets): Promise<Uint8Array> {
  const content = digitalBriefText(brief, generatedAt);
  const a = suppliedAssets ?? await assets();
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(a.regular, { subset: true });
  const bold = await pdf.embedFont(a.bold, { subset: true });
  const logo = await pdf.embedPng(a.logo);
  const navy = rgb(.04, .14, .20), copper = rgb(.60, .28, .13), muted = rgb(.30, .39, .44);
  pdf.setTitle(`${brief.name.trim()} · ARKEM Ön Görüşme Dosyası`);
  pdf.setAuthor("ARKEM Yapı Sistemleri");
  pdf.setSubject("Müşteri beyanları ve kurallı ön yönlendirme; mühendislik onayı değildir.");
  let page: PDFPage; let y = 0;
  let notationUsed = false;
  function nextPage() {
    page = pdf.addPage([595.28, 841.89]); y = 748;
    page.drawRectangle({ x: 36, y: 774, width: 523, height: 2, color: copper });
    page.drawImage(logo, { x: 38, y: 788, width: 30, height: 30 });
    page.drawText("ARKEM YAPI SİSTEMLERİ", { x: 80, y: 805, font: bold, size: 12, color: navy });
    page.drawText("ÖN GÖRÜŞME DOSYASI", { x: 80, y: 789, font: regular, size: 9, color: muted });
  }
  nextPage();
  for (const paragraph of content.split("\n").slice(1)) {
    if (!paragraph) { y -= 10; continue; }
    const section = /^\d\. /.test(paragraph);
    const font = section ? bold : regular, size = section ? 11 : 10;
    const wrapped = lines(paragraph, font, size, 523, () => { notationUsed = true; });
    if (section && y < 106) nextPage();
    if (section) y -= 8;
    for (const line of wrapped) {
      if (y < 72) nextPage();
      page!.drawText(line, { x: 36, y, font, size, color: section ? copper : navy }); y -= 15;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: 36, y: 53 }, end: { x: 559, y: 53 }, thickness: .5, color: muted });
    p.drawText("Müşteri beyanı · Uzman incelemesi yapılmadı · Teknik onay değildir", { x: 36, y: 38, font: regular, size: 8, color: muted });
    p.drawText(`${i + 1} / ${pages.length}`, { x: 530, y: 38, font: regular, size: 8, color: muted });
    if (notationUsed) p.drawText("Fontta bulunmayan karakterler Unicode koduyla [U+…] gösterilir.", { x: 36, y: 24, font: regular, size: 8, color: muted });
  });
  return pdf.save();
}
export async function downloadDigitalBriefPdf(brief: DigitalBrief, generatedAt: string) {
  const bytes = await createDigitalBriefPdf(brief, generatedAt);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "ARKEM-on-gorusme-dosyasi.pdf"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
