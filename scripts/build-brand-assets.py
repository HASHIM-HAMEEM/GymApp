#!/usr/bin/env python3
"""Build platform-safe Apex icon assets from the approved generated master."""

from pathlib import Path
import sys

from PIL import Image, ImageChops, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BACKGROUND = (5, 7, 8)


def contain(image: Image.Image, size: int, scale: float = 1.0) -> Image.Image:
    target = max(1, round(size * scale))
    resized = image.resize((target, target), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (size - target) // 2
    canvas.alpha_composite(resized, (offset, offset))
    return canvas


def extract_mark(master: Image.Image) -> Image.Image:
    rgb = master.convert("RGB")
    luminance = rgb.convert("L")
    background = Image.new("L", luminance.size, 7)
    alpha = ImageChops.subtract(luminance, background)
    alpha = ImageEnhance.Contrast(alpha).enhance(2.8)
    alpha = alpha.point(lambda value: 0 if value < 7 else min(255, value * 4))
    mark = rgb.convert("RGBA")
    mark.putalpha(alpha)
    return mark


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: build-brand-assets.py /path/to/generated-master.png")

    source = Path(sys.argv[1]).expanduser().resolve()
    master = Image.open(source).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    ASSETS.mkdir(parents=True, exist_ok=True)

    master.save(ASSETS / "apex-app-icon-master.png", optimize=True)
    master.save(ASSETS / "icon.png", optimize=True)
    master.resize((64, 64), Image.Resampling.LANCZOS).save(ASSETS / "favicon.png", optimize=True)

    transparent_mark = extract_mark(master)
    contain(transparent_mark, 1024, 0.72).save(ASSETS / "splash-icon.png", optimize=True)
    foreground = contain(transparent_mark, 512, 0.86)
    foreground.save(ASSETS / "android-icon-foreground.png", optimize=True)

    Image.new("RGB", (512, 512), BACKGROUND).save(
        ASSETS / "android-icon-background.png", optimize=True
    )

    monochrome_alpha = foreground.getchannel("A").resize((432, 432), Image.Resampling.LANCZOS)
    monochrome = Image.new("RGBA", (432, 432), (255, 255, 255, 0))
    monochrome.putalpha(monochrome_alpha)
    monochrome.save(ASSETS / "android-icon-monochrome.png", optimize=True)


if __name__ == "__main__":
    main()
