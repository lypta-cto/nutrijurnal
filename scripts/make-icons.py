"""Write every file that carries the Nutrijurnal mark, from Luka's logo.

The mark is an apple whose top-right corner folds over like a page — food and
a journal in one shape. Its source is scripts/logo-source.png, the logo as it
was drawn: black on cream. This traces that drawing once into a vector and
writes:

  public/logo.svg       the mark alone, in currentColor
  public/favicon.svg    the cream tile with the green mark (dark tile in dark mode)
  public/icons/         icon-192/512 (tile), maskable-512 (mark inside the 80 %
                        safe circle), apple-touch-icon 180 × 180 (opaque)

and prints the path for components/shell/LogoMark.vue, which carries the same
shape inside the app. The bitmaps are rendered from the drawing's own
anti-aliased edge, so they are as smooth as the original.

Needs Pillow, numpy and potracer (a pure-Python potrace):

    python3 -m venv /tmp/icons && /tmp/icons/bin/pip install pillow numpy potracer
    /tmp/icons/bin/python scripts/make-icons.py
"""

from pathlib import Path

import numpy as np
import potrace
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts" / "logo-source.png"
PUBLIC = ROOT / "public"

CREAM, GREEN = (249, 249, 244), (65, 157, 92)
DARK, GREEN_ON_DARK = "#111111", "#4BC16D"
# How tall the mark stands on its tile; lower on the maskable icon, whose
# corners the launcher may cut away
SHARE, MASKABLE_SHARE, TOUCH_SHARE = 0.60, 0.48, 0.58


def ink_and_alpha() -> tuple[np.ndarray, np.ndarray]:
    grey = np.asarray(Image.open(SOURCE).convert("L"), dtype=np.float32)
    ink = grey < 128
    ys, xs = np.where(ink)
    window = (slice(ys.min() - 4, ys.max() + 5), slice(xs.min() - 4, xs.max() + 5))
    paper, black = 248.0, 23.0
    alpha = np.clip((paper - grey) / (paper - black), 0, 1)
    return ink[window], alpha[window]


def svg_path(ink: np.ndarray) -> str:
    # potracer reads low values as ink, so the mark goes in as False
    traced = potrace.Bitmap(~ink).trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.2)
    parts = []
    for curve in traced:
        start = curve.start_point
        parts.append(f"M{start.x:.1f},{start.y:.1f}")
        for segment in curve.segments:
            end = segment.end_point
            if segment.is_corner:
                parts.append(f"L{segment.c.x:.1f},{segment.c.y:.1f}L{end.x:.1f},{end.y:.1f}")
            else:
                parts.append(
                    f"C{segment.c1.x:.1f},{segment.c1.y:.1f} "
                    f"{segment.c2.x:.1f},{segment.c2.y:.1f} {end.x:.1f},{end.y:.1f}"
                )
        parts.append("Z")
    return "".join(parts)


def tile(mark: Image.Image, size: int, share: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), CREAM + (255,))
    height = round(size * share)
    width = round(mark.width * height / mark.height)
    mask = mark.resize((width, height), Image.LANCZOS)
    # The leaf makes the mark top-heavy; a hair lower sits in the optical centre
    canvas.paste(GREEN + (255,), ((size - width) // 2, (size - height) // 2 + round(size * 0.01)), mask)
    return canvas


def main() -> None:
    ink, alpha = ink_and_alpha()
    path = svg_path(ink)
    height, width = ink.shape

    (PUBLIC / "logo.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" fill="currentColor">'
        f'<path fill-rule="evenodd" d="{path}"/></svg>\n'
    )
    side = height / SHARE
    left, top = (side - width) / 2, (side - height) / 2 + side * 0.01
    (PUBLIC / "favicon.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side:.0f} {side:.0f}">\n'
        f"<style>.t{{fill:#F9F9F4}}.g{{fill:#419D5C}}"
        f"@media (prefers-color-scheme: dark){{.t{{fill:{DARK}}}.g{{fill:{GREEN_ON_DARK}}}}}</style>\n"
        f'<rect class="t" width="{side:.0f}" height="{side:.0f}" rx="{side * 0.225:.0f}"/>\n'
        f'<path class="g" fill-rule="evenodd" transform="translate({left:.1f} {top:.1f})" d="{path}"/>\n'
        "</svg>\n"
    )

    mark = Image.fromarray((alpha * 255).astype(np.uint8), "L")
    icons = PUBLIC / "icons"
    tile(mark, 512, SHARE).save(icons / "icon-512.png")
    tile(mark, 192, SHARE).save(icons / "icon-192.png")
    tile(mark, 512, MASKABLE_SHARE).save(icons / "maskable-512.png")
    tile(mark, 180, TOUCH_SHARE).convert("RGB").save(icons / "apple-touch-icon.png")

    print(f'LogoMark.vue: viewBox="0 0 {width} {height}"')
    print(f'd="{path}"')


if __name__ == "__main__":
    main()
