from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#061A2B")
NAVY_2 = colors.HexColor("#102E44")
COPPER = colors.HexColor("#B96636")
PAPER = colors.HexColor("#F7F3EC")
MUTED = colors.HexColor("#61717D")
LINE = colors.HexColor("#D8D0C6")

pdfmetrics.registerFont(TTFont("ArkemSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("ArkemSansBold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="ArkemTitle", fontName="ArkemSansBold", fontSize=24, leading=28, textColor=NAVY, spaceAfter=6))
styles.add(ParagraphStyle(name="ArkemSub", fontName="ArkemSans", fontSize=9.5, leading=14, textColor=MUTED, spaceAfter=12))
styles.add(ParagraphStyle(name="ArkemSection", fontName="ArkemSansBold", fontSize=12, leading=15, textColor=COPPER, spaceBefore=11, spaceAfter=7, uppercase=True))
styles.add(ParagraphStyle(name="ArkemBody", fontName="ArkemSans", fontSize=9.2, leading=13, textColor=NAVY))
styles.add(ParagraphStyle(name="ArkemSmall", fontName="ArkemSans", fontSize=7.4, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="ArkemCell", fontName="ArkemSans", fontSize=7.6, leading=10, textColor=NAVY))
styles.add(ParagraphStyle(name="ArkemCellBold", fontName="ArkemSansBold", fontSize=7.6, leading=10, textColor=NAVY))
styles.add(ParagraphStyle(name="ArkemHeader", fontName="ArkemSansBold", fontSize=7.6, leading=10, textColor=colors.white))


def decorate(canvas, doc):
    canvas.saveState()
    width, height = canvas._pagesize
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 14 * mm, width, 14 * mm, stroke=0, fill=1)
    canvas.setFont("ArkemSansBold", 10)
    canvas.setFillColor(colors.white)
    canvas.drawString(18 * mm, height - 9 * mm, "ARKEM YAPI SİSTEMLERİ")
    canvas.setFont("ArkemSans", 7.2)
    canvas.setFillColor(colors.HexColor("#C8D2D8"))
    canvas.drawRightString(width - 18 * mm, height - 9 * mm, "PROJE · YAPIM · DANIŞMANLIK")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("ArkemSans", 7)
    canvas.drawString(18 * mm, 8.5 * mm, "arkemyapisistemleri.com · Serdivan / Sakarya · +90 533 575 54 37")
    canvas.drawRightString(width - 18 * mm, 8.5 * mm, f"Sayfa {doc.page}")
    canvas.restoreState()


def make_doc(path, page_size=A4, left=18 * mm, right=18 * mm):
    return SimpleDocTemplate(str(path), pagesize=page_size, leftMargin=left, rightMargin=right, topMargin=25 * mm, bottomMargin=19 * mm, title=path.stem, author="Arkem Yapı Sistemleri")


def blank_table(rows, widths=None):
    data = [[Paragraph(label, styles["ArkemCellBold"]), ""] for label in rows]
    table = Table(data, colWidths=widths or [55 * mm, 117 * mm], rowHeights=[12 * mm] * len(rows))
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (0, -1), PAPER),
        ("GRID", (0, 0), (-1, -1), .45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def build_assessment_form():
    doc = make_doc(OUT / "proje-on-degerlendirme-formu.pdf")
    story = [Spacer(1, 5 * mm), Paragraph("Proje Ön Değerlendirme Formu", styles["ArkemTitle"]), Paragraph("İlk teknik görüşmede ihtiyaç, kapsam ve öncelikleri aynı çerçevede değerlendirmek için hazırlanmıştır. Bildiğiniz alanları doldurun; kesinleşmemiş bilgileri boş bırakabilirsiniz.", styles["ArkemSub"])]
    sections = [
        ("1 · İletişim", ["Ad / firma", "Telefon", "E-posta", "Karar verici / yetkili"]),
        ("2 · Proje ve arsa", ["Proje ili / ilçesi", "Ada / parsel (varsa)", "Arsa alanı", "Hedef yapı alanı", "Yapı kullanım amacı"]),
        ("3 · Mevcut durum", ["Arsa / yapı mevcut durumu", "Mimari çalışma durumu", "Zemin etüdü durumu", "Ruhsat / kurum süreci"]),
    ]
    for heading, rows in sections:
        story.extend([Paragraph(heading, styles["ArkemSection"]), blank_table(rows), Spacer(1, 2 * mm)])
    story.append(PageBreak())
    story.extend([Spacer(1, 5 * mm), Paragraph("Teknik hedefler ve öncelikler", styles["ArkemTitle"]), Paragraph("Bu bölüm, ilk görüşmede karşılaştırılacak taşıyıcı sistem ve teslim modelini belirlemeye yardımcı olur.", styles["ArkemSub"])])
    story.extend([Paragraph("4 · Yapı beklentisi", styles["ArkemSection"]), blank_table(["Kat adedi / yapı yüksekliği", "Yaklaşık açıklıklar", "Özel yük / ekipman bilgisi", "Cephe ve çatı beklentisi", "Enerji / akustik hedefi"]), Paragraph("5 · Ticari çerçeve", styles["ArkemSection"]), blank_table(["Hedef başlangıç tarihi", "Hedef teslim tarihi", "Bütçe aralığı (varsa)", "Talep edilen hizmet kapsamı"]), Paragraph("6 · Notlar", styles["ArkemSection"]), Table([[""]], colWidths=[172 * mm], rowHeights=[33 * mm], style=TableStyle([("BOX", (0, 0), (-1, -1), .45, LINE)])), Spacer(1, 4 * mm), Paragraph("Bu form ön bilgi toplamak içindir; saha incelemesi, zemin verisi, hesap raporu veya uygulama projesi yerine geçmez. Nihai kapsam ve teknik kararlar yetkili uzmanların incelemesiyle belirlenir.", styles["ArkemSmall"])])
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)


def build_offer_comparison():
    doc = make_doc(OUT / "yapi-teklif-karsilastirma-listesi.pdf", landscape(A4), left=14 * mm, right=14 * mm)
    story = [Spacer(1, 4 * mm), Paragraph("Yapı Teklifi Karşılaştırma Listesi", styles["ArkemTitle"]), Paragraph("Teklifleri yalnızca toplam fiyat üzerinden değil; kapsam, teknik eşdeğerlik, teslim ve risk maddeleri üzerinden karşılaştırmak için çalışma tablosu.", styles["ArkemSub"])]
    headers = [Paragraph("Karşılaştırma ölçütü", styles["ArkemHeader"]), Paragraph("Teklif A", styles["ArkemHeader"]), Paragraph("Teklif B", styles["ArkemHeader"]), Paragraph("Teklif C", styles["ArkemHeader"]), Paragraph("Not / karar", styles["ArkemHeader"])]
    criteria = [
        ("Teklif tarihi ve geçerlilik süresi", "Ticari"),
        ("KDV / vergi durumu", "Ticari"),
        ("Toplam bedel ve ödeme planı", "Ticari"),
        ("Proje ve mühendislik dahil mi?", "Kapsam"),
        ("Zemin / temel işleri dahil mi?", "Kapsam"),
        ("Taşıyıcı sistem ve malzeme sınıfı", "Teknik"),
        ("Kaplama, yalıtım ve katmanlar", "Teknik"),
        ("İmalat / montaj kapsamı", "Kapsam"),
        ("Nakliye, vinç ve lojistik", "Kapsam"),
        ("Şantiye elektrik, su ve güvenlik", "Saha"),
        ("İş programı ve teslim süresi", "Teslim"),
        ("Kalite kontrol / raporlama", "Kalite"),
        ("Garanti ve eksik iş prosedürü", "Risk"),
        ("Hariç tutulan işler", "Risk"),
    ]
    data = [headers] + [[Paragraph(f"<b>{name}</b><br/><font color='#61717D'>{group}</font>", styles["ArkemCell"]), "", "", "", ""] for name, group in criteria]
    table = Table(data, colWidths=[57 * mm, 42 * mm, 42 * mm, 42 * mm, 71 * mm], rowHeights=[9 * mm] + [8.5 * mm] * len(criteria), repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY_2),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), .4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 1), (0, -1), PAPER),
    ]))
    story.extend([table, Spacer(1, 4 * mm), Paragraph("Karar notu: Bir teklifin daha düşük bedelli olması, aynı teknik kapsamı içerdiği anlamına gelmez. Karşılaştırma öncesinde pafta, şartname, metraj ve hariçlerin aynı referansa bağlanması önerilir.", styles["ArkemSmall"])])
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)


def build_light_steel_checklist():
    doc = make_doc(OUT / "hafif-celik-on-kontrol-listesi.pdf")
    story = [Spacer(1, 5 * mm), Paragraph("Hafif Çelik Yapı Ön Kontrol Listesi", styles["ArkemTitle"]), Paragraph("Yatırımcıların proje ve teklif görüşmesinde doğru soruları sormasına yardımcı olan genel kontrol listesi.", styles["ArkemSub"])]
    groups = [
        ("Proje", ["Mimari ve statik proje kapsamı açık mı?", "Yükler, zemin verisi ve kullanım amacı tanımlı mı?", "Üretim ve montaj paftaları teslim edilecek mi?", "Revizyon ve kurum onayı sorumlulukları belirli mi?"]),
        ("Taşıyıcı sistem", ["Profil sınıfı, kaplama ve kesitler projeye bağlı mı?", "Bağlantı elemanları ve ankraj sistemi tanımlı mı?", "Korozyon, yoğuşma ve su yönetimi detaylandırılmış mı?", "Deprem ve rüzgâr yükleri hesap raporunda yer alıyor mu?"]),
        ("Yapı fiziği", ["Duvar, çatı ve döşeme katmanları açıkça listeli mi?", "Isı, su, buhar ve ses performansı birlikte değerlendirildi mi?", "Yangın dayanımı hedefi ve malzeme belgeleri tanımlı mı?", "Kapı, pencere ve tesisat geçiş detayları çözülmüş mü?"]),
        ("Uygulama ve teslim", ["Temel toleransları ve saha hazırlığı bildirildi mi?", "Nakliye, vinç, montaj ve iskele kapsamı belirli mi?", "Kalite kontrol kayıtları ve teslim belgeleri sunulacak mı?", "Garanti, bakım ve eksik iş süreci yazılı mı?"]),
    ]
    for index, (heading, items) in enumerate(groups):
        if index == 2:
            story.extend([PageBreak(), Spacer(1, 5 * mm), Paragraph("Hafif Çelik Yapı Ön Kontrol Listesi", styles["ArkemTitle"]), Paragraph("Yapı fiziği, uygulama ve teslim kontrolleri", styles["ArkemSub"])])
        rows = [["□", Paragraph(item, styles["ArkemBody"]), "Not:"] for item in items]
        table = Table(rows, colWidths=[9 * mm, 118 * mm, 45 * mm], rowHeights=[12 * mm] * len(rows))
        table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .4, LINE), ("BACKGROUND", (0, 0), (0, -1), PAPER), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (0, -1), "CENTER"), ("FONTNAME", (0, 0), (-1, -1), "ArkemSans")]))
        story.extend([Paragraph(heading, styles["ArkemSection"]), KeepTogether(table)])
    story.extend([Spacer(1, 5 * mm), Paragraph("Uyarı: Bu liste genel farkındalık içindir. Taşıyıcı sistem boyutlandırması, deprem güvenliği, yangın, enerji ve uygulama detayları yalnızca proje özelinde yetkili uzmanlarca belirlenebilir.", styles["ArkemSmall"])])
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)


if __name__ == "__main__":
    build_assessment_form()
    build_offer_comparison()
    build_light_steel_checklist()
    print("\n".join(str(path) for path in sorted(OUT.glob("*.pdf"))))
