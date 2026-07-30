from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

ICON_SIZES = (16, 20, 24, 32, 48, 64, 128, 256)
BLUEPRINT = "#2f5bff"
BLUEPRINT_GRID = "#6f88ff"
PAPER = "#ffffff"
GRAPHITE = "#171a18"
MARKER = "#ffd84d"


def _scaled(value: int, scale: int) -> int:
    return value * scale


def _rounded_line(
    draw: ImageDraw.ImageDraw,
    points: tuple[tuple[int, int], ...],
    *,
    fill: str,
    width: int,
) -> None:
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in points:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def render_icon() -> Image.Image:
    scale = 4
    canvas_size = _scaled(256, scale)
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle(
        (
            _scaled(10, scale),
            _scaled(14, scale),
            _scaled(246, scale),
            _scaled(250, scale),
        ),
        radius=_scaled(48, scale),
        fill=GRAPHITE,
    )
    draw.rounded_rectangle(
        (
            _scaled(6, scale),
            _scaled(6, scale),
            _scaled(242, scale),
            _scaled(242, scale),
        ),
        radius=_scaled(48, scale),
        fill=BLUEPRINT,
    )

    for coordinate in (64, 128, 192):
        draw.line(
            (
                _scaled(coordinate, scale),
                _scaled(28, scale),
                _scaled(coordinate, scale),
                _scaled(218, scale),
            ),
            fill=BLUEPRINT_GRID,
            width=_scaled(2, scale),
        )
        draw.line(
            (
                _scaled(28, scale),
                _scaled(coordinate, scale),
                _scaled(218, scale),
                _scaled(coordinate, scale),
            ),
            fill=BLUEPRINT_GRID,
            width=_scaled(2, scale),
        )

    _rounded_line(
        draw,
        (
            (_scaled(62, scale), _scaled(62, scale)),
            (_scaled(62, scale), _scaled(190, scale)),
            (_scaled(194, scale), _scaled(190, scale)),
        ),
        fill=PAPER,
        width=_scaled(20, scale),
    )
    _rounded_line(
        draw,
        (
            (_scaled(104, scale), _scaled(94, scale)),
            (_scaled(104, scale), _scaled(150, scale)),
            (_scaled(164, scale), _scaled(150, scale)),
        ),
        fill=PAPER,
        width=_scaled(16, scale),
    )

    marker_center = (_scaled(190, scale), _scaled(64, scale))
    marker_outline_radius = _scaled(18, scale)
    marker_radius = _scaled(12, scale)
    draw.ellipse(
        (
            marker_center[0] - marker_outline_radius,
            marker_center[1] - marker_outline_radius,
            marker_center[0] + marker_outline_radius,
            marker_center[1] + marker_outline_radius,
        ),
        fill=GRAPHITE,
    )
    draw.ellipse(
        (
            marker_center[0] - marker_radius,
            marker_center[1] - marker_radius,
            marker_center[0] + marker_radius,
            marker_center[1] + marker_radius,
        ),
        fill=MARKER,
    )

    return image.resize((256, 256), Image.Resampling.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the ArchResearch Windows icon")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preview", type=Path)
    arguments = parser.parse_args()

    icon = render_icon()
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    icon.save(
        arguments.output,
        format="ICO",
        sizes=[(size, size) for size in ICON_SIZES],
    )
    if arguments.preview is not None:
        arguments.preview.parent.mkdir(parents=True, exist_ok=True)
        icon.save(arguments.preview, format="PNG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
