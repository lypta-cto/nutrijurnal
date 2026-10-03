"""Draw the Nutrijurnal mark once and write every file that carries it.

The mark is the day's ring — the same ring Today fills as food is written
down — three quarters closed, with a leaf growing where the day starts. Read
small, it is simply a fruit with a leaf.

The geometry lives only here. It is written out as SVG (public/logo.svg,
public/favicon.svg) and rasterised into the PWA and home-screen icons under
public/icons/, so the vector and the bitmaps cannot drift apart.
components/shell/LogoMark.vue carries the same paths for use inside the app.

Pillow is the only dependency, and the API's virtualenv already has it:

    ../nutrijurnal-back/.venv/bin/python scripts/make-icons.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parent.parent / "public"

# The accent from app/assets/css/main.css (basil): one colour, no gradient
BASIL_500 = "#2fb463"
BASIL_600 = "#1d7f43"
WHITE = "#ffffff"

# Drawn on a 48-unit grid and scaled to each target size
GRID = 48
CENTRE = (24.0, 25.5)
RADIUS = 13.0
STROKE = 6.5
# The day so far: from the top, clockwise, three quarters of the way round
ARC_FROM = -90.0
ARC_SWEEP = 270.0
# The rest of the ring is still there, only quieter: white on the green tile
# needs more of it than green on white does
TRACK_OPACITY = 0.32
TRACK_OPACITY_ON_LIGHT = 0.2
LEAF_BASE = (25.0, 11.5)
LEAF_TIP = (37.5, 5.0)
# How far each side of the leaf swells from its midrib — one side fuller
LEAF_BULGE = (4.8, 3.8)

# Rasterised this many times larger, then scaled down, for clean edges
SUPERSAMPLE = 8


def polar(angle: float, radius: float) -> tuple[float, float]:
    rad = math.radians(angle)
    return CENTRE[0] + radius * math.cos(rad), CENTRE[1] + radius * math.sin(rad)


def cubic(p0, p1, p2, p3, steps=64):
    points = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        points.append(
            (
                u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
            )
        )
    return points


def leaf_controls():
    """The control points of the leaf's two cubic sides, base to tip and back"""
    bx, by = LEAF_BASE
    tx, ty = LEAF_TIP
    dx, dy = tx - bx, ty - by
    length = math.hypot(dx, dy)
    nx, ny = -dy / length, dx / length
    upper, lower = LEAF_BULGE

    def along(share, offset):
        return bx + dx * share + nx * offset, by + dy * share + ny * offset

    return (along(0.2, -upper), along(0.75, -upper)), (along(0.75, lower), along(0.2, lower))


def placed(points, scale, offset):
    return [(offset[0] + x * scale, offset[1] + y * scale) for x, y in points]


def track_polygons(scale, offset):
    """The full ring as an outer and an inner circle (filled, then cut out)"""
    steps = 360
    half = STROKE / 2
    outer = [polar(360 * i / steps, RADIUS + half) for i in range(steps)]
    inner = [polar(360 * i / steps, RADIUS - half) for i in range(steps)]
    return placed(outer, scale, offset), placed(inner, scale, offset)


def arc_polygon(scale, offset):
    """The progress arc as one closed outline, round caps included"""
    half = STROKE / 2
    steps = 240
    arc_to = ARC_FROM + ARC_SWEEP
    points = [polar(ARC_FROM + ARC_SWEEP * i / steps, RADIUS + half) for i in range(steps + 1)]
    end = polar(arc_to, RADIUS)
    points += [
        (
            end[0] + half * math.cos(math.radians(arc_to + 180 * i / 32)),
            end[1] + half * math.sin(math.radians(arc_to + 180 * i / 32)),
        )
        for i in range(1, 32)
    ]
    points += [polar(arc_to - ARC_SWEEP * i / steps, RADIUS - half) for i in range(steps + 1)]
    start = polar(ARC_FROM, RADIUS)
    points += [
        (
            start[0] + half * math.cos(math.radians(ARC_FROM + 180 + 180 * i / 32)),
            start[1] + half * math.sin(math.radians(ARC_FROM + 180 + 180 * i / 32)),
        )
        for i in range(1, 32)
    ]
    return placed(points, scale, offset)


def leaf_polygon(scale, offset):
    (a1, a2), (b1, b2) = leaf_controls()
    outline = cubic(LEAF_BASE, a1, a2, LEAF_TIP) + cubic(LEAF_TIP, b1, b2, LEAF_BASE)[1:]
    return placed(outline, scale, offset)


def svg_paths() -> dict[str, str]:
    """The arc and the leaf as SVG path data on the 48-unit grid"""

    def pt(p):
        return f"{p[0]:.2f} {p[1]:.2f}"

    start = polar(ARC_FROM, RADIUS)
    end = polar(ARC_FROM + ARC_SWEEP, RADIUS)
    large = 1 if ARC_SWEEP > 180 else 0
    (a1, a2), (b1, b2) = leaf_controls()
    return {
        "arc": f"M{pt(start)}A{RADIUS:g} {RADIUS:g} 0 {large} 1 {pt(end)}",
        "leaf": f"M{pt(LEAF_BASE)}C{pt(a1)} {pt(a2)} {pt(LEAF_TIP)}C{pt(b1)} {pt(b2)} {pt(LEAF_BASE)}Z",
    }


def mark_svg(ring: str, leaf: str, track_opacity: float) -> str:
    paths = svg_paths()
    return (
        f'<circle cx="{CENTRE[0]:g}" cy="{CENTRE[1]:g}" r="{RADIUS:g}" fill="none" stroke="{ring}" '
        f'stroke-width="{STROKE:g}" stroke-opacity="{track_opacity:g}"/>'
        f'<path d="{paths["arc"]}" fill="none" stroke="{ring}" stroke-width="{STROKE:g}" stroke-linecap="round"/>'
        f'<path d="{paths["leaf"]}" fill="{leaf}"/>'
    )


def write_svgs():
    # The mark alone, in the accent, for light backgrounds
    mark = mark_svg(BASIL_600, BASIL_600, TRACK_OPACITY_ON_LIGHT)
    (PUBLIC / "logo.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {GRID} {GRID}">{mark}</svg>\n'
    )

    # The browser tab: the app icon's tile, so it holds up at 16 px on any tab colour
    (PUBLIC / "favicon.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {GRID} {GRID}">'
        f'<rect width="{GRID}" height="{GRID}" rx="11" fill="{BASIL_500}"/>'
        f'<g transform="translate(4.8 4.8) scale(0.8)">{mark_svg(WHITE, WHITE, TRACK_OPACITY)}</g>'
        "</svg>\n"
    )


def hex_rgb(value: str) -> tuple[int, int, int]:
    return tuple(int(value[i : i + 2], 16) for i in (1, 3, 5))


def flat_tile(size: int) -> Image.Image:
    """The flat accent every icon sits on"""
    return Image.new("RGB", (size, size), hex_rgb(BASIL_500))


def icon(size: int, mark_share: float, rounded: bool) -> Image.Image:
    """A tile with the mark centred; `mark_share` is the grid's width over the tile's"""
    big = size * SUPERSAMPLE
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    tile = flat_tile(big).convert("RGBA")
    if rounded:
        mask = Image.new("L", (big, big), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=round(big * 0.225), fill=255)
        canvas.paste(tile, (0, 0), mask)
    else:
        canvas.paste(tile, (0, 0))

    scale = big * mark_share / GRID
    offset = ((big - GRID * scale) / 2, (big - GRID * scale) / 2)

    # The quiet quarter of the ring is blended on its own layer, then laid over
    track = Image.new("L", (big, big), 0)
    outer, inner = track_polygons(scale, offset)
    track_draw = ImageDraw.Draw(track)
    track_draw.polygon(outer, fill=round(255 * TRACK_OPACITY))
    track_draw.polygon(inner, fill=0)
    white = Image.new("RGBA", (big, big), hex_rgb(WHITE) + (255,))
    canvas.paste(white, (0, 0), track)

    draw = ImageDraw.Draw(canvas)
    draw.polygon(arc_polygon(scale, offset), fill=WHITE)
    draw.polygon(leaf_polygon(scale, offset), fill=WHITE)
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    write_svgs()
    icons = PUBLIC / "icons"
    icons.mkdir(exist_ok=True)
    # Installed-app icons: a rounded tile with transparent corners
    icon(192, 0.76, rounded=True).save(icons / "icon-192.png", optimize=True)
    icon(512, 0.76, rounded=True).save(icons / "icon-512.png", optimize=True)
    # Maskable: full bleed, the mark well inside the central 80 % safe circle
    icon(512, 0.66, rounded=False).convert("RGB").save(icons / "maskable-512.png", optimize=True)
    # iOS rounds the corners itself and shows transparency as black, so: opaque
    icon(180, 0.76, rounded=False).convert("RGB").save(icons / "apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    main()
