#!/usr/bin/env python3
"""Готовит облегчённые версии картинок для сайта «Кибер Кино».

Исходники (PNG по несколько мегабайт) остаются в репозитории как мастер-копии,
а страницы подключают WebP нужного размера через srcset — на телефоне
загружается вариант шириной 640, а не полтора мегабайта.

Запуск:  python3 tools/optimize_images.py
Нужен Pillow:  pip install pillow
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "img"

# файл → ширины вариантов
TARGETS = {
    "enshtane-01.png": (640, 960, 1440, 1920),
    "enshtane-02.png": (640, 960, 1440, 1920),
    "logo.png": (480, 720, 1200),
    "logo-mini-white.png": (140, 280),
}
JURY_WIDTHS = (250, 500)  # исходники — квадраты 500×500
QUALITY = 78


def variants(src: Path, widths: tuple[int, ...]) -> None:
    if not src.exists():
        print("  пропуск, нет файла:", src.relative_to(ROOT))
        return
    im = Image.open(src)
    im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
    for w in widths:
        if w > im.width:
            continue
        h = round(im.height * w / im.width)
        out = src.with_name(f"{src.stem}-{w}.webp")
        im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=QUALITY, method=6)
        print(f"  → {out.relative_to(ROOT)}  {w}×{h}  {out.stat().st_size // 1024} КБ")


def og_cover(src: Path, out: Path) -> None:
    """Картинка для соцсетей: 1200×630, JPEG — его понимают все агрегаторы."""
    if not src.exists():
        return
    im = Image.open(src).convert("RGB")
    target = 1200 / 630
    w, h = im.size
    if w / h > target:  # обрезаем по центру до нужной пропорции
        new_w = round(h * target)
        im = im.crop(((w - new_w) // 2, 0, (w + new_w) // 2, h))
    else:
        new_h = round(w / target)
        im = im.crop((0, (h - new_h) // 2, w, (h + new_h) // 2))
    im.resize((1200, 630), Image.LANCZOS).save(out, "JPEG", quality=82, optimize=True)
    print(f"  → {out.relative_to(ROOT)}  1200×630  {out.stat().st_size // 1024} КБ")


def main() -> None:
    print("Варианты для srcset:")
    for name, widths in TARGETS.items():
        variants(IMG / name, widths)
    for path in sorted((IMG / "jury").glob("*.png")):
        variants(path, JURY_WIDTHS)

    print("Обложка для соцсетей:")
    og_cover(IMG / "enshtane-01.png", IMG / "og-cover.jpg")


if __name__ == "__main__":
    main()
