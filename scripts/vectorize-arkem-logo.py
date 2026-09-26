#!/usr/bin/env python3
"""Create the single, two-view ARKEM master SVG from the approved PNG geometry."""

from pathlib import Path

import contourpy
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "arkem-logo-light.png"
TARGET = ROOT / "public" / "brand" / "arkem-logo-master.svg"


def remove_collinear(points: np.ndarray) -> np.ndarray:
    if len(points) < 4:
        return points
    kept = []
    count = len(points) - 1 if np.array_equal(points[0], points[-1]) else len(points)
    ring = points[:count]
    for index, point in enumerate(ring):
        previous = ring[index - 1]
        following = ring[(index + 1) % count]
        before = point - previous
        after = following - point
        if abs(float(before[0] * after[1] - before[1] * after[0])) > 1e-9:
            kept.append(point)
    if not kept:
        kept = ring.tolist()
    result = np.asarray(kept, dtype=float)
    return np.vstack([result, result[0]])


def path_for(mask: np.ndarray) -> str:
    generator = contourpy.contour_generator(z=mask.astype(float), fill_type="OuterOffset")
    polygons, offsets = generator.filled(0.5, 1.5)
    commands: list[str] = []
    for polygon, polygon_offsets in zip(polygons, offsets):
        for start, end in zip(polygon_offsets[:-1], polygon_offsets[1:]):
            ring = remove_collinear(polygon[start:end])
            if len(ring) < 4:
                continue
            first = ring[0]
            commands.append(f"M{first[0]:g},{first[1]:g}")
            commands.extend(f"L{point[0]:g},{point[1]:g}" for point in ring[1:-1])
            commands.append("Z")
    return "".join(commands)


def main() -> None:
    image = np.asarray(Image.open(SOURCE).convert("RGBA"))
    rgb = image[:, :, :3].astype(int)
    alpha = image[:, :, 3]

    visible = alpha >= 72
    copper = visible & (rgb[:, :, 0] >= 70) & (rgb[:, :, 0] >= rgb[:, :, 2] * 1.35)
    # The approved logo uses the primary colour as the base, including the
    # narrow keyline around the Copper mark. Copper is painted over that base.
    ink = visible

    ink_path = path_for(ink)
    copper_path = path_for(copper)
    width, height = image.shape[1], image.shape[0]

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <title>ARKEM Yapı Sistemleri</title>
  <desc>Onaylı ARKEM logo geometrisinin açık ve koyu zemin görünümleri.</desc>
  <defs>
    <linearGradient id="arkem-copper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e09a31"/>
      <stop offset="1" stop-color="#b96636"/>
    </linearGradient>
    <path id="arkem-ink" fill-rule="evenodd" d="{ink_path}"/>
    <path id="arkem-copper-shape" fill-rule="evenodd" d="{copper_path}"/>
    <view id="on-light" viewBox="0 0 {width} {height}"/>
    <view id="on-dark" viewBox="0 {height} {width} {height}"/>
  </defs>
  <g id="arkem-logo-on-light">
    <use href="#arkem-ink" xlink:href="#arkem-ink" fill="#061a2b"/>
    <use href="#arkem-copper-shape" xlink:href="#arkem-copper-shape" fill="url(#arkem-copper)" stroke="#061a2b" stroke-width="5" stroke-linejoin="round" paint-order="stroke fill"/>
  </g>
  <g id="arkem-logo-on-dark" transform="translate(0 {height})">
    <use href="#arkem-ink" xlink:href="#arkem-ink" fill="#f7f3eb"/>
    <use href="#arkem-copper-shape" xlink:href="#arkem-copper-shape" fill="url(#arkem-copper)" stroke="#061a2b" stroke-width="5" stroke-linejoin="round" paint-order="stroke fill"/>
  </g>
</svg>
'''
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
