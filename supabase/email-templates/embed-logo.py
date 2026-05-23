#!/usr/bin/env python3
"""Embed roommates-logo.png into email HTML templates."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOGO = ROOT.parent.parent / "assets" / "roommates-logo.png"
TEMPLATES = ["confirm-signup.html", "reset-password.html"]
B64 = ROOT / "logo-base64.txt"

LOGO_BLOCK_START = "          <!-- Logo mark -->"
LOGO_BLOCK_END = "          <!-- Card -->"


def embed_logo(html_path: Path, b64: str) -> None:
    html = html_path.read_text(encoding="utf-8")
    start = html.index(LOGO_BLOCK_START)
    end = html.index(LOGO_BLOCK_END)
    block = f"""{LOGO_BLOCK_START}
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="data:image/png;base64,{b64}" width="72" height="72" alt="Rumi" style="display:block;width:72px;height:72px;margin:0 auto;border:0;border-radius:12px;" />
              <p style="margin:14px 0 0;font-size:13px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#A1A1AA;">Rumi</p>
            </td>
          </tr>
"""
    html_path.write_text(html[:start] + block + html[end:], encoding="utf-8")
    print(f"Updated {html_path.name}")


def main() -> None:
    from PIL import Image
    import base64
    from io import BytesIO

    img = Image.open(LOGO).convert("RGBA").resize((128, 128), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    B64.write_text(b64, encoding="utf-8")

    for name in TEMPLATES:
        embed_logo(ROOT / name, b64)

    print(f"Done ({len(b64)} base64 chars per template)")


if __name__ == "__main__":
    main()
