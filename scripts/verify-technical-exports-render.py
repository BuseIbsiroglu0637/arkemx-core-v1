"""Optional independent PDF / CAD artifact check; no site runtime dependency.

Requires pypdfium2 and ezdxf. To use a temporary install pass its directory.
"""
import json
from pathlib import Path
import sys

if len(sys.argv) > 1:
    sys.path.insert(0, sys.argv[1])
import pypdfium2 as pdfium
import ezdxf
from ezdxf.addons.drawing import Frontend, RenderContext, layout, svg

output = Path("tmp/pdfs")
report = {"pdfs": {}, "dxf": {}}
for filename in ("arkem-kurumsal-pafta-ornek.pdf", "arkem-a4-ozet-rapor.pdf", "arkem-a4-overflow-test.pdf"):
    document = pdfium.PdfDocument(output / filename)
    page_texts = []
    for index, page in enumerate(document):
        page_texts.append(page.get_textpage().get_text_range())
        if index < 3:
            page.render(scale=1.2).to_pil().save(output / f"{Path(filename).stem}-{index + 1}.png")
    full_text = "\n".join(page_texts)
    report["pdfs"][filename] = {"pages": len(document), "sizes": [list(p.get_size()) for p in document], "text_length": len(full_text)}
    if "overflow" in filename:
        assert "Kaynak 45:" in full_text, "Last source paragraph disappeared"
        assert "SONRAKİ ADIM" in full_text, "Final section disappeared"
    (output / f"{Path(filename).stem}-text.txt").write_text(full_text, encoding="utf-8")
document = ezdxf.readfile(output / "arkem-kurumsal-pafta-ornek.dxf")
audit = document.audit()
assert not audit.errors, audit.errors
model = document.modelspace()
texts = list(model.query("TEXT"))
report["dxf"] = {"version": document.dxfversion, "units": document.header.get("$INSUNITS"), "audit_errors": len(audit.errors), "audit_fixes": len(audit.fixes), "text_count": len(texts), "minimum_model_text_height": min(t.dxf.height for t in texts)}
backend = svg.SVGBackend()
Frontend(RenderContext(document), backend).draw_layout(model)
svg_text = backend.get_string(layout.Page(420, 297, layout.Units.mm, margins=layout.Margins.all(10)))
(output / "arkem-dxf-independent-render.svg").write_text(svg_text, encoding="utf-8")
(output / "technical-export-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
