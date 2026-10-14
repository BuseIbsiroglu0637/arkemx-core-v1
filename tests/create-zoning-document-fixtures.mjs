import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const dir='test-artifacts/zoning-documents';
await mkdir(dir,{recursive:true});
const bytes=await readFile('public/fonts/ArkemSans-Regular.ttf');
const variants={matching:['Sakarya','Adapazarı','15 Temmuz Camili','1606','1','0,30'],mismatch:['Sakarya','Adapazarı','15 Temmuz Camili','9999','1','0,30'],conflict:['Sakarya','Adapazarı','15 Temmuz Camili','1606','1','0,40']};
for(const [name,v] of Object.entries(variants)) {
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(bytes,{subset:true});const page=pdf.addPage([595,842]);
 const lines=['YAZILIM TESTİ — RESMÎ BELGE DEĞİLDİR','Tüm yapılaşma değerleri sentetiktir.',`İl: ${v[0]}`,`İlçe: ${v[1]}`,`Mahalle: ${v[2]}`,`Ada: ${v[3]}`,`Parsel: ${v[4]}`,'Ölçek: 1/1000','Belge tarihi: 12.10.2026',`TAKS: ${v[5]}`,'KAKS: 1,20','Hmax: 9,50 m','Ön bahçe: 5 m','Yan bahçe: 3 m','Arka bahçe: 3 m','Yapı nizamı: Ayrık nizam','Kullanım kararı: Konut'];
 lines.forEach((text,i)=>page.drawText(text,{x:42,y:795-i*30,size:12,font}));await writeFile(`${dir}/${name}.pdf`,await pdf.save());
}
const blank=await PDFDocument.create();blank.addPage();await writeFile(`${dir}/no-text.pdf`,await blank.save());
await writeFile(`${dir}/corrupt.pdf`,'%PDF-1.7 not a valid document');
console.log(dir);

