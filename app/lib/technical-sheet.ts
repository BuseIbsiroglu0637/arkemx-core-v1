import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { createDocumentIdentity } from "./document-identity.ts";

export type TechnicalSheetPoint = {
  x: number;
  y: number;
  label?: string;
};

export type TechnicalSheetPolyline = {
  points: TechnicalSheetPoint[];
  role?: "primary" | "secondary" | "grid" | "warning";
  closed?: boolean;
};

export type TechnicalSheetInput = {
  projectName: string;
  projectCode: string;
  module: string;
  drawingTitle: string;
  drawingSubtitle?: string;
  revision?: string;
  status?: string;
  sheetNo?: string;
  scale?: string;
  coordinateSystem?: string;
  sourceRevision?: string;
  elementIds?: string[];
  calculationIds?: string[];
  preparedBy?: string;
  checkedBy?: string;
  reviewBanner?: string;
  polylines: TechnicalSheetPolyline[];
  metrics?: Array<[string, string]>;
  notes?: string[];
  legend?: Array<[string, "primary" | "secondary" | "grid" | "warning"]>;
  coordinates?: Array<[string, string, string]>;
};

export type TechnicalSheetAssets = {
  regularFont: Uint8Array;
  boldFont: Uint8Array;
  logo: Uint8Array;
};

const PAGE = { width: 1190.55, height: 841.89 };
const COLORS = {
  navy: rgb(7 / 255, 27 / 255, 40 / 255),
  deep: rgb(4 / 255, 17 / 255, 27 / 255),
  copper: rgb(185 / 255, 102 / 255, 55 / 255),
  blue: rgb(66 / 255, 113 / 255, 133 / 255),
  slate: rgb(78 / 255, 96 / 255, 105 / 255),
  pale: rgb(235 / 255, 239 / 255, 237 / 255),
  paper: rgb(249 / 255, 250 / 255, 248 / 255),
  line: rgb(190 / 255, 201 / 255, 202 / 255),
  faint: rgb(224 / 255, 230 / 255, 229 / 255),
  white: rgb(1, 1, 1),
  warning: rgb(180 / 255, 68 / 255, 59 / 255),
};

let browserAssetPromise: Promise<TechnicalSheetAssets> | null = null;

function clean(value: unknown, fallback = "-") {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

async function fetchBytes(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Teknik pafta varlığı yüklenemedi: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function resolveAssets(assets?: TechnicalSheetAssets) {
  if (assets) return assets;
  browserAssetPromise ??= Promise.all([
    fetchBytes("/fonts/ArkemSans-Regular.ttf"),
    fetchBytes("/fonts/ArkemSans-Bold.ttf"),
    fetchBytes("/brand/arkem-a-mark.png"),
  ]).then(([regularFont, boldFont, logo]) => ({ regularFont, boldFont, logo }));
  return browserAssetPromise;
}

function fitSize(font: PDFFont, value: string, preferred: number, maxWidth: number, minimum = 5.2) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(value, size) > maxWidth) size -= .25;
  return Math.max(minimum, size);
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  const chunks: string[] = [];
  let current = "";
  for (const character of word) {
    const next = `${current}${character}`;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      chunks.push(current);
      current = character;
    } else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number, maxLines: number) {
  const sourceWords = clean(value).split(" ");
  const words = sourceWords.flatMap((word) => font.widthOfTextAtSize(word, size) > maxWidth
    ? splitLongWord(word, font, size, maxWidth)
    : [word]);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  let last = clipped[maxLines - 1];
  while (last.length > 1 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) last = last.slice(0, -1);
  clipped[maxLines - 1] = `${last.trimEnd()}…`;
  return clipped;
}

function drawMultiline(
  page: PDFPage,
  value: string,
  options: {
    x: number;
    y: number;
    width: number;
    font: PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    maxLines?: number;
    leading?: number;
  },
) {
  const lines = wrapText(value, options.font, options.size, options.width, options.maxLines ?? 2);
  const leading = options.leading ?? options.size * 1.35;
  lines.forEach((line, index) => page.drawText(line, {
    x: options.x,
    y: options.y - index * leading,
    size: options.size,
    font: options.font,
    color: options.color,
  }));
  return lines.length;
}

function drawLogoLockup(
  page: PDFPage,
  logo: PDFImage,
  regular: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  options: { compact?: boolean; dark?: boolean } = {},
) {
  const compact = options.compact ?? false;
  const dark = options.dark ?? false;
  const markWidth = compact ? 34 : 45;
  const markHeight = markWidth * logo.height / logo.width;
  const cardHeight = compact ? 34 : 46;
  page.drawRectangle({
    x,
    y,
    width: compact ? 44 : 58,
    height: cardHeight,
    color: COLORS.white,
    borderColor: dark ? COLORS.faint : COLORS.line,
    borderWidth: .5,
  });
  page.drawImage(logo, {
    x: x + (compact ? 5 : 6.5),
    y: y + (cardHeight - markHeight) / 2,
    width: markWidth,
    height: markHeight,
  });
  const wordX = x + (compact ? 52 : 70);
  const titleColor = dark ? COLORS.navy : COLORS.white;
  page.drawText("ARKEM", { x: wordX, y: y + (compact ? 18 : 25), size: compact ? 14 : 20, font: bold, color: titleColor });
  page.drawText("YAPI SİSTEMLERİ", { x: wordX, y: y + (compact ? 6 : 8), size: compact ? 5.8 : 7.2, font: regular, color: COLORS.copper });
}

function drawLabel(page: PDFPage, value: string, x: number, y: number, font: PDFFont, color = COLORS.slate) {
  page.drawText(value.toLocaleUpperCase("tr-TR"), { x, y, size: 5.4, font, color });
}

export async function createCorporateTechnicalPdf(input: TechnicalSheetInput, suppliedAssets?: TechnicalSheetAssets) {
  const assets = await resolveAssets(suppliedAssets);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regular, bold, logo] = await Promise.all([
    document.embedFont(assets.regularFont, { subset: true }),
    document.embedFont(assets.boldFont, { subset: true }),
    document.embedPng(assets.logo),
  ]);
  const page = document.addPage([PAGE.width, PAGE.height]);
  const identity = createDocumentIdentity(input);
  document.setTitle(`${clean(input.projectCode)} - ${clean(input.drawingTitle)}`);
  document.setAuthor("Arkem Yapı Sistemleri");
  document.setCreator("ARKEMX Teknik Çıktı Motoru");
  document.setProducer("ARKEMX / Kurumsal Pafta Standardı 2.0");
  document.setSubject(clean(input.module));
  document.setKeywords(["Arkem", "ARKEMX", "teknik pafta", clean(input.projectCode), clean(input.sheetNo)]);

  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: COLORS.pale });
  page.drawRectangle({ x: 18, y: 18, width: PAGE.width - 36, height: PAGE.height - 36, color: COLORS.white, borderColor: COLORS.navy, borderWidth: 1.25 });

  const header = { x: 18, y: 728, width: PAGE.width - 36, height: 96 };
  page.drawRectangle({ ...header, color: COLORS.navy });
  page.drawRectangle({ x: header.x, y: header.y, width: 8, height: header.height, color: COLORS.copper });
  drawLogoLockup(page, logo, regular, bold, 42, 750);
  page.drawLine({ start: { x: 357, y: 746 }, end: { x: 357, y: 806 }, color: COLORS.blue, thickness: .6 });
  drawLabel(page, "ARKEMX teknik çıktı standardı", 382, 789, bold, COLORS.copper);
  page.drawText("İzlenebilir mühendislik verisi", { x: 382, y: 767, size: 12, font: regular, color: COLORS.white });
  page.drawText("MİMARİ  •  MÜHENDİSLİK  •  YAPIM", { x: 382, y: 749, size: 6.5, font: regular, color: COLORS.blue });

  drawLabel(page, clean(input.module), 806, 798, bold, COLORS.copper);
  const headerTitle = clean(input.drawingTitle).toLocaleUpperCase("tr-TR");
  const headerTitleSize = fitSize(bold, headerTitle, 14.5, 320, 10);
  drawMultiline(page, headerTitle, { x: 806, y: 775, width: 320, font: bold, size: headerTitleSize, color: COLORS.white, maxLines: 2, leading: headerTitleSize * 1.2 });
  page.drawText(`PAFTA ${clean(input.sheetNo, "A-001")}`, {
    x: 1088,
    y: 742,
    size: 6.5,
    font: bold,
    color: COLORS.pale,
  });

  if (input.reviewBanner) {
    page.drawRectangle({ x: 42, y: 705, width: 1107, height: 19, color: COLORS.warning });
    const warningText = clean(input.reviewBanner);
    page.drawText(warningText, {
      x: 52, y: 710.7,
      size: fitSize(bold, warningText, 9.3, 1085, 6.8),
      font: bold, color: COLORS.white,
    });
  }

  const drawing = { x: 42, y: 172, width: 750, height: 530 };
  const sidebar = { x: 808, y: 172, width: 341, height: 530 };
  page.drawRectangle({ ...drawing, color: COLORS.paper, borderColor: COLORS.line, borderWidth: .7 });
  page.drawRectangle({ ...sidebar, color: COLORS.white, borderColor: COLORS.line, borderWidth: .7 });
  drawLabel(page, "Teknik görünüş / model uzayı", drawing.x + 14, drawing.y + drawing.height - 24, bold, COLORS.copper);
  const scaleLabel = clean(input.scale, "Ölçek: otomatik");
  page.drawText(scaleLabel, {
    x: drawing.x + drawing.width - 16 - bold.widthOfTextAtSize(scaleLabel, 6.2),
    y: drawing.y + drawing.height - 24,
    size: 6.2,
    font: bold,
    color: COLORS.slate,
  });
  page.drawLine({
    start: { x: drawing.x + 14, y: drawing.y + drawing.height - 35 },
    end: { x: drawing.x + drawing.width - 14, y: drawing.y + drawing.height - 35 },
    color: COLORS.line,
    thickness: .55,
  });

  const allPoints = input.polylines.flatMap((polyline) => polyline.points).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const minX = allPoints.length ? Math.min(...allPoints.map((point) => point.x)) : 0;
  const maxX = allPoints.length ? Math.max(...allPoints.map((point) => point.x)) : 1;
  const minY = allPoints.length ? Math.min(...allPoints.map((point) => point.y)) : 0;
  const maxY = allPoints.length ? Math.max(...allPoints.map((point) => point.y)) : 1;
  const inner = { x: drawing.x + 42, y: drawing.y + 56, width: drawing.width - 84, height: drawing.height - 110 };
  const plotScale = Math.min(inner.width / Math.max(1, maxX - minX), inner.height / Math.max(1, maxY - minY));
  const usedWidth = (maxX - minX) * plotScale;
  const usedHeight = (maxY - minY) * plotScale;
  const offsetX = inner.x + (inner.width - usedWidth) / 2;
  const offsetY = inner.y + (inner.height - usedHeight) / 2;
  const mapPoint = (point: TechnicalSheetPoint) => ({
    x: offsetX + (point.x - minX) * plotScale,
    y: offsetY + (point.y - minY) * plotScale,
  });
  const roleColor = {
    primary: COLORS.copper,
    secondary: COLORS.navy,
    grid: COLORS.blue,
    warning: COLORS.warning,
  };

  for (let index = 0; index <= 10; index += 1) {
    const gx = inner.x + inner.width * index / 10;
    const gy = inner.y + inner.height * index / 10;
    page.drawLine({ start: { x: gx, y: inner.y }, end: { x: gx, y: inner.y + inner.height }, color: COLORS.faint, thickness: .3 });
    page.drawLine({ start: { x: inner.x, y: gy }, end: { x: inner.x + inner.width, y: gy }, color: COLORS.faint, thickness: .3 });
  }

  input.polylines.forEach((polyline) => {
    if (polyline.points.length < 2) return;
    const mapped = polyline.points.map(mapPoint);
    const color = roleColor[polyline.role ?? "secondary"];
    const thickness = polyline.role === "primary" ? 2.2 : polyline.role === "warning" ? 1.6 : 1.05;
    mapped.slice(1).forEach((point, index) => page.drawLine({ start: mapped[index], end: point, color, thickness }));
    if (polyline.closed !== false && mapped.length > 2) page.drawLine({ start: mapped[mapped.length - 1], end: mapped[0], color, thickness });
    polyline.points.forEach((point, index) => {
      if (!point.label) return;
      const mappedPoint = mapped[index];
      page.drawRectangle({ x: mappedPoint.x - 2.3, y: mappedPoint.y - 2.3, width: 4.6, height: 4.6, color: COLORS.white, borderColor: color, borderWidth: .65 });
      page.drawText(point.label, { x: mappedPoint.x + 5, y: mappedPoint.y + 3.2, size: 5.2, font: bold, color: COLORS.slate });
    });
  });

  page.drawText("N", { x: drawing.x + drawing.width - 39, y: drawing.y + drawing.height - 61, size: 8, font: bold, color: COLORS.navy });
  page.drawLine({ start: { x: drawing.x + drawing.width - 36, y: drawing.y + drawing.height - 99 }, end: { x: drawing.x + drawing.width - 36, y: drawing.y + drawing.height - 68 }, color: COLORS.copper, thickness: 1.7 });
  page.drawSvgPath("M 0 0 L 5 12 L 10 0 Z", { x: drawing.x + drawing.width - 41, y: drawing.y + drawing.height - 69, color: COLORS.copper });

  page.drawLine({ start: { x: drawing.x + 30, y: drawing.y + 30 }, end: { x: drawing.x + 150, y: drawing.y + 30 }, color: COLORS.navy, thickness: 2 });
  [30, 90, 150].forEach((offset) => page.drawLine({ start: { x: drawing.x + offset, y: drawing.y + 25 }, end: { x: drawing.x + offset, y: drawing.y + 35 }, color: COLORS.navy, thickness: .8 }));
  page.drawText("GRAFİK ÖLÇEK  /  ÇİZİM BİRİMİ: METRE", { x: drawing.x + 30, y: drawing.y + 14, size: 5.4, font: bold, color: COLORS.slate });

  let sideY = sidebar.y + sidebar.height - 25;
  const sideLeft = sidebar.x + 16;
  const sideRight = sidebar.x + sidebar.width - 16;
  const sideHeading = (label: string) => {
    drawLabel(page, label, sideLeft, sideY, bold, COLORS.copper);
    sideY -= 10;
    page.drawLine({ start: { x: sideLeft, y: sideY }, end: { x: sideRight, y: sideY }, color: COLORS.line, thickness: .5 });
    sideY -= 15;
  };
  const sideField = (label: string, value: string) => {
    drawLabel(page, label, sideLeft, sideY, bold);
    const cleaned = clean(value);
    const valueSize = fitSize(bold, cleaned, 6.4, 205, 5.2);
    page.drawText(cleaned, { x: sideLeft + 102, y: sideY, size: valueSize, font: bold, color: COLORS.navy });
    sideY -= 17;
  };

  sideHeading("Proje kimliği");
  sideField("Proje", input.projectName);
  sideField("Proje kodu", input.projectCode);
  sideField("Modül", input.module);
  sideField("Veri statüsü", input.status ?? "Kavramsal / ön değerlendirme");
  sideField("Koordinat", input.coordinateSystem ?? "Yerel / proje bazlı");

  sideHeading("Teknik özet");
  (input.metrics ?? []).slice(0, 7).forEach(([label, value]) => {
    drawLabel(page, label, sideLeft, sideY, bold);
    const cleaned = clean(value);
    const size = fitSize(bold, cleaned, 6.8, 122, 5.4);
    page.drawText(cleaned, { x: sideRight - bold.widthOfTextAtSize(cleaned, size), y: sideY, size, font: bold, color: COLORS.navy });
    sideY -= 15;
  });

  if (input.coordinates?.length) {
    sideHeading("Koordinat özeti");
    input.coordinates.slice(0, 5).forEach(([point, first, second]) => {
      page.drawText(point, { x: sideLeft, y: sideY, size: 5.8, font: bold, color: COLORS.copper });
      page.drawText(first, { x: sideLeft + 43, y: sideY, size: 5.6, font: regular, color: COLORS.navy });
      page.drawText(second, { x: sideLeft + 180, y: sideY, size: 5.6, font: regular, color: COLORS.navy });
      sideY -= 12;
    });
    sideY -= 3;
  }

  if (input.legend?.length) {
    sideHeading("Çizim lejantı");
    input.legend.slice(0, 3).forEach(([label, role]) => {
      page.drawLine({ start: { x: sideLeft, y: sideY + 2 }, end: { x: sideLeft + 30, y: sideY + 2 }, color: roleColor[role], thickness: role === "primary" ? 2.1 : 1.1 });
      page.drawText(label, { x: sideLeft + 42, y: sideY, size: 5.9, font: regular, color: COLORS.slate });
      sideY -= 12;
    });
    sideY -= 2;
  }

  sideHeading("Açıklama ve kapsam");
  (input.notes ?? []).slice(0, 3).forEach((note, index) => {
    page.drawText(String(index + 1).padStart(2, "0"), { x: sideLeft, y: sideY, size: 5.7, font: bold, color: COLORS.copper });
    const lineCount = drawMultiline(page, note, { x: sideLeft + 27, y: sideY, width: sideRight - sideLeft - 27, font: regular, size: 5.5, color: COLORS.slate, maxLines: 2, leading: 7 });
    sideY -= lineCount * 7 + 8;
  });

  const title = { x: 42, y: 42, width: 1107, height: 105 };
  page.drawRectangle({ ...title, color: COLORS.white, borderColor: COLORS.navy, borderWidth: .8 });
  page.drawRectangle({ x: title.x, y: title.y, width: 228, height: title.height, color: COLORS.navy });
  page.drawRectangle({ x: title.x, y: title.y, width: 7, height: title.height, color: COLORS.copper });
  drawLogoLockup(page, logo, regular, bold, title.x + 20, title.y + 42, { compact: true });
  page.drawText("MİMARİ  •  MÜHENDİSLİK  •  YAPIM", { x: title.x + 20, y: title.y + 18, size: 5.2, font: regular, color: COLORS.pale });

  const titleInfoX = title.x + 248;
  const titleMetaX = title.x + 862;
  page.drawLine({ start: { x: titleInfoX, y: title.y + 35 }, end: { x: titleMetaX, y: title.y + 35 }, color: COLORS.line, thickness: .55 });
  drawLabel(page, "Pafta adı", titleInfoX, title.y + 82, bold);
  const drawingTitle = clean(input.drawingTitle);
  const drawingTitleSize = fitSize(bold, drawingTitle, 13.5, titleMetaX - titleInfoX - 18, 9.5);
  drawMultiline(page, drawingTitle, { x: titleInfoX, y: title.y + 57, width: titleMetaX - titleInfoX - 18, font: bold, size: drawingTitleSize, color: COLORS.navy, maxLines: 2, leading: drawingTitleSize * 1.18 });
  const subtitle = clean(input.drawingSubtitle, "ARKEMX teknik çalışma çıktısı");
  const subtitleSize = fitSize(regular, subtitle, 6.5, titleMetaX - titleInfoX - 18, 5.2);
  page.drawText(subtitle, { x: titleInfoX, y: title.y + 16, size: subtitleSize, font: regular, color: COLORS.slate });

  page.drawLine({ start: { x: titleMetaX, y: title.y }, end: { x: titleMetaX, y: title.y + title.height }, color: COLORS.line, thickness: .65 });
  page.drawLine({ start: { x: titleMetaX + 113, y: title.y }, end: { x: titleMetaX + 113, y: title.y + title.height }, color: COLORS.line, thickness: .65 });
  [title.y + 35, title.y + 70].forEach((y) => page.drawLine({ start: { x: titleMetaX, y }, end: { x: title.x + title.width, y }, color: COLORS.line, thickness: .65 }));

  const metaCell = (label: string, value: string, x: number, y: number, width: number, accent = false) => {
    drawLabel(page, label, x + 12, y + 22, bold);
    const cleaned = clean(value);
    const size = fitSize(bold, cleaned, 7.2, width - 24, 5.4);
    page.drawText(cleaned, { x: x + 12, y: y + 8, size, font: bold, color: accent ? COLORS.copper : COLORS.navy });
  };
  metaCell("Revizyon", input.revision ?? "Bekleniyor", titleMetaX, title.y + 70, 113, true);
  metaCell("Pafta no", input.sheetNo ?? "A-001", titleMetaX + 113, title.y + 70, 132);
  metaCell("Tarih", new Date().toLocaleDateString("tr-TR"), titleMetaX, title.y + 35, 113);
  metaCell("Ölçek", input.scale ?? "Otomatik", titleMetaX + 113, title.y + 35, 132);
  metaCell("Hazırlayan", input.preparedBy ?? "ARKEMX", titleMetaX, title.y, 113);
  metaCell("Kontrol", input.checkedBy ?? "Projeye özel", titleMetaX + 113, title.y, 132);

  page.drawText("Bu pafta kavramsal karar, veri hazırlığı ve koordinasyon içindir; ruhsat, aplikasyon veya uygulama projesi yerine geçmez.", {
    x: 42,
    y: 27,
    size: 5.3,
    font: regular,
    color: COLORS.slate,
  });
  page.drawText(identity.reference, { x: 790, y: 27, size: fitSize(bold, identity.reference, 5.5, 260, 4.5), font: bold, color: COLORS.slate });
  page.drawText(identity.references.status === "unsupported" ? "Hesap / eleman kaynak baglari eksik: izlenebilir teknik teslim desteklenmiyor." : "Beyan edilen hesap / eleman baglari ayrica dogrulanmalidir.", { x: 42, y: 17, size: 5.3, font: regular, color: COLORS.copper });
  page.drawText("ARKEM-TS / 3.0", { x: 1060, y: 27, size: 5.5, font: bold, color: COLORS.copper });

  return document.save({ useObjectStreams: false });
}
