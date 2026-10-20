import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createCorporateTechnicalPdf, createCorporateSummaryPdf } from "../app/lib/technical-sheet.ts";
import { createLayeredDxf } from "../app/lib/engineering.ts";

const assets = {
  regularFont: readFileSync(new URL("../public/fonts/ArkemSans-Regular.ttf", import.meta.url)),
  boldFont: readFileSync(new URL("../public/fonts/ArkemSans-Bold.ttf", import.meta.url)),
  logo: readFileSync(new URL("../public/brand/arkem-a-mark.png", import.meta.url)),
};
const input = { projectName: "Kastamonu / Budamış / 210 / 15", projectCode: "ARK-QA", module: "GEO", drawingTitle: "Parsel ve ön yerleşim", status: "İmar bulunamadı / kavramsal", polylines: [{ role: "secondary", points: [{ x: -5, y: -8, label: "P1" }, { x: 64, y: 4 }, { x: 40, y: 48 }, { x: 0, y: 22 }] }], metrics: [["Kaynak alanı", "1.597,8 m²"], ["İzin verilen toplam alan", "Doğrulanmadı"]], notes: ["Kaynak: test fikstürü. Gerçek imar belgesi değildir."] };
test("A3 remains a single landscape sheet with embedded Unicode fonts", async () => {
  const bytes = await createCorporateTechnicalPdf(input, assets); const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1); assert.ok(Math.abs(pdf.getPage(0).getWidth() - 1190.55) < .1);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 841.89) < .1); assert.equal(pdf.getAuthor(), "Arkem Yapı Sistemleri");
});
test("A4 report paginates long sources and metrics instead of shrinking text", async () => {
  const bytes = await createCorporateSummaryPdf({ ...input, notes: Array.from({ length: 80 }, (_, i) => `${i + 1}: ${"Kaynak ve uzun açıklama ".repeat(25)}`), metrics: Array.from({ length: 35 }, (_, i) => [`Hesap ${i + 1}`, "Doğrulanmamış varsayım"]), coordinates: Array.from({ length: 50 }, (_, i) => [`P${i}`, "41.345854", "33.764014"]) }, assets);
  const pdf = await PDFDocument.load(bytes); assert.ok(pdf.getPageCount() > 8);
  for (const page of pdf.getPages()) { assert.ok(Math.abs(page.getWidth() - 595.28) < .1); assert.ok(Math.abs(page.getHeight() - 841.89) < .1); }
});
function records(dxf) {
  const lines = dxf.trim().split(/\r?\n/); const result = []; let entity;
  for (let i = 0; i < lines.length; i += 2) { const code = Number(lines[i]); const value = lines[i + 1]; if (code === 0) { entity = { type: value }; result.push(entity); } else if (entity) entity[code] = value; }
  return result;
}
test("Room labels use bounded local annotations without adding geometry vertices",()=>{
  const dxf=createLayeredDxf({title:"Measured room",width:30,depth:20,polylines:[{layer:"MAHAL",points:[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}]}],
    labels:[{x:2,y:2,width:4,lines:["Yatak odası","4.00×4.00 m","16.0 m²"]}]});
  const r=records(dxf),labels=r.filter(e=>e.type==="TEXT"&&e[8]==="NOKTA_YAZI");
  assert.equal(labels.length,3);assert.ok(labels.every(e=>Number(e[10])>0&&Number(e[10])<4));
  assert.equal(r.filter(e=>e.type==="VERTEX"&&e[8]==="MAHAL").length,4);
});
test("DXF preserves signed metre model coordinates and enforces readable paper typography", () => {
  for (const multiplier of [.1, 1, 100]) {
    const poly = input.polylines[0].points.map(p => ({ x: p.x * multiplier, y: p.y * multiplier }));
    const dxf = createLayeredDxf({ title: "CAD QA", width: 69 * multiplier, depth: 56 * multiplier, polylines: [{ layer: "PARSEL", points: poly }], sheet: { projectName: "Çok uzun kaynak açıklaması ".repeat(30) }, notes: ["Not ".repeat(100)] });
    const r = records(dxf); const vertices = r.filter(e => e.type === "VERTEX" && e[8] === "PARSEL");
    assert.deepEqual(vertices.map(v => [Number(v[10]), Number(v[20])]), poly.map(p => [Number(p.x.toFixed(4)), Number(p.y.toFixed(4))]));
    const scaleLine = r.find(e => e.type === "TEXT" && e[1]?.includes("A3 YATAY"))[1];
    const denominator = Number(scaleLine.match(/1:(\d+)/)[1]);
    for (const entity of r.filter(e => e.type === "TEXT")) { assert.ok(Number(entity[40]) / denominator * 1000 >= 2.49, `Small text: ${entity[1]}`); assert.equal(Number(entity[41]), 1); }
    assert.match(dxf, /\$INSUNITS\r\n70\r\n6/); assert.doesNotMatch(dxf, /NaN|Infinity/);
  }
});
