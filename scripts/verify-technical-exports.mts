import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createLayeredDxf } from "../app/lib/engineering.ts";
import { createCorporateTechnicalPdf, createCorporateSummaryPdf, type TechnicalSheetInput } from "../app/lib/technical-sheet.ts";

mkdirSync("tmp/pdfs", { recursive: true });

const footprint = [
  { x: 0, y: 0 },
  { x: 42, y: 0 },
  { x: 42, y: 28 },
  { x: 0, y: 28 },
];
const building = [
  { x: 8, y: 6 },
  { x: 34, y: 6 },
  { x: 34, y: 22 },
  { x: 8, y: 22 },
];

const input: TechnicalSheetInput = {
  projectName: "Arkem X Örnek Sanayi Yapısı",
  projectCode: "ARK-26-DEMO",
  module: "ARKEM X / GEO PARSEL STÜDYOSU",
  drawingTitle: "Parsel ve Ön Yapı Yerleşim Paftası",
  drawingSubtitle: "Sakarya / Yapısal Çelik / Kavramsal",
  revision: "P02",
  status: "Kavramsal / doğrulama bekliyor",
  sheetNo: "GEO-001",
  scale: "OTOMATİK / METRE",
  coordinateSystem: "WGS84 / EPSG:4326",
  northAngleDegrees: 0,
  polylines: [
    { role: "secondary", points: footprint.map((point, index) => ({ ...point, label: `P${index + 1}` })) },
    { role: "primary", points: building },
  ],
  metrics: [
    ["Parsel alanı", "1.176,0 m²"],
    ["Parsel çevresi", "140,0 m"],
    ["Yapı tabanı", "416,0 m²"],
    ["Ön brüt alan", "832,0 m²"],
    ["Kat / yükseklik", "2 / 9,0 m"],
    ["TAKS / KAKS", "%35,4 / 0,71"],
    ["Sınır mesafesi", "6,0 m"],
  ],
  coordinates: [
    ["P01", "40.7607000", "30.3675000"],
    ["P02", "40.7607000", "30.3680000"],
    ["P03", "40.7610000", "30.3680000"],
    ["P04", "40.7610000", "30.3675000"],
  ],
  notes: [
    "Kullanıcı girdileri ve kavramsal geometri üzerinden oluşturulmuştur.",
    "İmar, aplikasyon ve zemin verileri yetkili uzmanlarca doğrulanmalıdır.",
    "Kütle yerleşimi erken karar ve disiplin koordinasyonu içindir.",
  ],
  legend: [["Ön yapı kütlesi", "primary"], ["Parsel sınırı", "secondary"]],
};
const assets = {
  regularFont: readFileSync("public/fonts/ArkemSans-Regular.ttf"),
  boldFont: readFileSync("public/fonts/ArkemSans-Bold.ttf"),
  logo: readFileSync("public/brand/arkem-a-mark.png"),
};
const pdf = await createCorporateTechnicalPdf(input, assets);
writeFileSync("tmp/pdfs/arkem-kurumsal-pafta-ornek.pdf", pdf);
writeFileSync("tmp/pdfs/arkem-a4-ozet-rapor.pdf", await createCorporateSummaryPdf(input, assets));
writeFileSync("tmp/pdfs/arkem-a4-overflow-test.pdf", await createCorporateSummaryPdf({
  ...input,
  notes: Array.from({ length: 45 }, (_, i) => `Kaynak ${i + 1}: İmar bilgisi doğrulanmamıştır. ${"Uzun kaynak URL'si ve varsayımlar satır kaybetmeden raporda korunur. ".repeat(4)}`),
  metrics: [...input.metrics!, ["İmar durumu", "Bulunamadı — yalnız kavramsal senaryo"]],
}, assets));

const dxf = createLayeredDxf({
  title: "ARKEM PARSEL VE ON YAPI",
  width: 42,
  depth: 28,
  polylines: [
    { layer: "PARSEL", points: footprint },
    { layer: "ON_YAPI", points: building },
  ],
  notes: ["PARSEL ALANI: 1176.0 M2", "ON YAPI: 26.0 x 16.0 M / 2 KAT"],
  sheet: {
    projectName: "ARKEM X ORNEK SANAYI YAPISI",
    projectCode: "ARK-26-DEMO",
    module: "GEO / PARSEL VE ARAZI",
    drawingTitle: "PARSEL VE ON YAPI YERLESIM PLANI",
    drawingNo: "GEO-001",
    revision: "P02",
    status: "KAVRAMSAL",
    coordinateSystem: "WGS84 / EPSG:4326",
    scale: "MODEL 1:1",
    northAngleDegrees: 0,
  },
});
writeFileSync("tmp/pdfs/arkem-kurumsal-pafta-ornek.dxf", dxf, "utf8");
console.log("A3 PDF + A4 summary + overflow report + layered DXF generated in tmp/pdfs");
