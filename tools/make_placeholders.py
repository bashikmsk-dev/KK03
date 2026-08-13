#!/usr/bin/env python3
"""Генератор временных изображений для сайта «Кибер Кино».

Создаёт заглушки в фирменной палитре по тем же путям, куда позже лягут
настоящие файлы. Заменяете PNG своими — код сайта править не нужно.

Запуск:  python3 tools/make_placeholders.py
Нужен Pillow:  pip install pillow
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "img"
JURY = IMG / "jury"

INK = (10, 10, 11)
PAPER = (239, 234, 226)
ACCENT = (255, 58, 18)
BLUE = (75, 50, 255)

FONT_CANDIDATES = [
    ROOT / "assets" / "fonts" / "unbounded-latin.woff2",  # не читается PIL, только для порядка
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
]


def load_font(size: int) -> ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if path.suffix in (".ttf", ".otf") and path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except OSError:
                continue
    return ImageFont.load_default()


def text_center(draw: ImageDraw.ImageDraw, xy, text, font, fill, spacing=0):
    """Рисует текст по центру точки xy, с опциональным трекингом."""
    x, y = xy
    if not spacing:
        box = draw.textbbox((0, 0), text, font=font)
        draw.text((x - (box[2] - box[0]) / 2, y - (box[3] - box[1]) / 2 - box[1]), text, font=font, fill=fill)
        return
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    box = draw.textbbox((0, 0), text, font=font)
    cx = x - total / 2
    for ch, w in zip(text, widths):
        draw.text((cx, y - (box[3] - box[1]) / 2 - box[1]), ch, font=font, fill=fill)
        cx += w + spacing


def grain(img: Image.Image, amount: int = 10) -> Image.Image:
    rnd = random.Random(amount)
    w, h = img.size
    data = bytes(max(0, min(255, int(rnd.gauss(128, amount)))) for _ in range(w * h))
    noise = Image.frombytes("L", (w, h), data)
    return Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.06)


def vertical_grid(draw: ImageDraw.ImageDraw, size, step=14, color=(255, 255, 255), alpha=12):
    w, h = size
    for x in range(0, w, step):
        draw.line([(x, 0), (x, h)], fill=color + (alpha,), width=1)


def head_mass(rnd: random.Random, w: int, h: int) -> list[tuple[int, int, int, int]]:
    """Набор прямоугольников, складывающихся в силуэт головы с плечами."""
    blocks = []
    cx, cy = w / 2, h * 0.42
    rx, ry = w * 0.13, h * 0.28
    for _ in range(2600):
        a = rnd.uniform(0, math.tau)
        r = math.sqrt(rnd.random())
        x = cx + math.cos(a) * rx * r
        y = cy + math.sin(a) * ry * r
        bw = rnd.choice([4, 6, 8, 12, 18, 26])
        bh = rnd.choice([3, 4, 6, 8])
        blocks.append((int(x), int(y), bw, bh))
    sx, sy = w / 2, h * 0.86
    for _ in range(1500):
        a = rnd.uniform(0, math.tau)
        r = math.sqrt(rnd.random())
        x = sx + math.cos(a) * w * 0.22 * r
        y = sy + math.sin(a) * h * 0.16 * r
        bw = rnd.choice([6, 10, 16, 24, 34])
        bh = rnd.choice([3, 4, 6])
        blocks.append((int(x), int(y), bw, bh))
    return blocks


def enshtane(path: Path, seed: int, accent: tuple[int, int, int], bright: int, label: str):
    """Глитч-портрет: временная замена Enshtane 01/02."""
    w, h = 1920, 1080
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h), INK)
    draw = ImageDraw.Draw(img)

    for y in range(h):  # мягкий виньет-градиент
        k = 1 - abs(y - h * 0.45) / h
        v = int(8 + 26 * max(k, 0) ** 2)
        draw.line([(0, y), (w, y)], fill=(v, v, v + 2))

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    vertical_grid(od, (w, h))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    for x, y, bw, bh in head_mass(rnd, w, h):
        t = rnd.random()
        if t < 0.07:
            col = accent
        elif t < 0.12:
            col = BLUE
        else:
            g = int(bright * rnd.uniform(0.45, 1.0))
            col = (g, g, min(255, int(g * 1.04)))
        draw.rectangle([x, y, x + bw, y + bh], fill=col)

    for _ in range(70):  # горизонтальные глитч-полосы
        y = rnd.randint(int(h * 0.12), int(h * 0.92))
        strip_h = rnd.choice([2, 3, 5, 9])
        x0 = rnd.randint(int(w * 0.2), int(w * 0.7))
        strip = img.crop((x0, y, min(w, x0 + rnd.randint(120, 520)), y + strip_h))
        img.paste(strip, (max(0, x0 + rnd.randint(-260, 260)), y))

    img = grain(img.filter(ImageFilter.GaussianBlur(0.4)))
    draw = ImageDraw.Draw(img)
    font = load_font(22)
    text_center(draw, (w / 2, h - 54), label, font, (120, 120, 126), spacing=6)
    img.save(path, optimize=True)
    print("→", path.relative_to(ROOT))


def logo(path: Path, size: int, mini: bool):
    """Лента киноплёнки, уходящая в сетку узлов — временная замена Logo.png."""
    s = size * 3
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    white = (255, 255, 255, 255)
    cx, cy = s / 2, s / 2
    rx, ry = s * 0.34, s * 0.24
    band = s * (0.10 if mini else 0.085)

    outer, inner = [], []
    for i in range(241):
        a = math.tau * i / 240
        wob = 1 + 0.16 * math.sin(a * 2)
        outer.append((cx + math.cos(a) * rx * wob, cy + math.sin(a) * ry * wob - band / 2))
        inner.append((cx + math.cos(a) * rx * wob, cy + math.sin(a) * ry * wob + band / 2))
    d.polygon(outer + inner[::-1], fill=(255, 255, 255, 38))
    d.line(outer, fill=white, width=max(2, s // 340))
    d.line(inner, fill=white, width=max(2, s // 340))

    step = 6 if mini else 4
    for i in range(0, 241, step):  # перфорация
        ox, oy = outer[i]
        ix, iy = inner[i]
        for px, py, k in ((ox, oy, 0.20), (ix, iy, -0.20)):
            r = band * 0.13
            off = band * k
            d.rectangle([px - r, py + off - r, px + r, py + off + r], fill=white)
        if i % (step * 2) == 0:
            d.line([(ox, oy + band * 0.34), (ix, iy - band * 0.34)], fill=(255, 255, 255, 90), width=max(1, s // 700))

    if not mini:  # узловая сетка справа
        rnd = random.Random(7)
        nodes = [(cx + s * 0.18 + rnd.uniform(0, s * 0.22), cy + rnd.uniform(-s * 0.2, s * 0.22)) for _ in range(26)]
        for i, (x, y) in enumerate(nodes):
            for x2, y2 in nodes[i + 1:]:
                if math.dist((x, y), (x2, y2)) < s * 0.09:
                    d.line([(x, y), (x2, y2)], fill=(255, 255, 255, 70), width=max(1, s // 900))
        for x, y in nodes:
            r = s * 0.006
            d.rectangle([x - r, y - r, x + r, y + r], fill=white)

    img.resize((size, size), Image.LANCZOS).save(path)
    print("→", path.relative_to(ROOT))


def jury_card(path: Path, initials: str, seed: int):
    """Duotone-заглушка портрета жюри 800×1000."""
    w, h = 800, 1000
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h), (14, 14, 16))
    d = ImageDraw.Draw(img)
    for y in range(h):
        k = y / h
        d.line([(0, y), (w, y)], fill=(int(14 + 26 * k), int(14 + 24 * k), int(18 + 30 * k)))

    cx, cy = w / 2, h * 0.44
    for _ in range(900):  # силуэт «портрета» точками полутона
        a = rnd.uniform(0, math.tau)
        r = math.sqrt(rnd.random())
        x = cx + math.cos(a) * w * 0.26 * r
        y = cy + math.sin(a) * h * 0.22 * r
        rad = rnd.uniform(1.5, 5.5)
        g = rnd.randint(70, 150)
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(g, g, g + 6))
    for _ in range(700):
        a = rnd.uniform(0, math.tau)
        r = math.sqrt(rnd.random())
        x = cx + math.cos(a) * w * 0.42 * r
        y = h * 0.86 + math.sin(a) * h * 0.16 * r
        rad = rnd.uniform(2, 6)
        g = rnd.randint(45, 105)
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(g, g, g + 8))

    img = grain(img.filter(ImageFilter.GaussianBlur(0.6)), 8)
    d = ImageDraw.Draw(img)
    d.rectangle([0, h - 6, w, h], fill=ACCENT)
    text_center(d, (cx, cy), initials, load_font(150), (236, 232, 226), spacing=10)
    img.save(path, optimize=True)
    print("→", path.relative_to(ROOT))


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    JURY.mkdir(parents=True, exist_ok=True)

    enshtane(IMG / "enshtane-01.png", seed=11, accent=BLUE, bright=205, label="ENSHTANE 01 / PLACEHOLDER")
    enshtane(IMG / "enshtane-02.png", seed=29, accent=ACCENT, bright=150, label="ENSHTANE 02 / PLACEHOLDER")
    logo(IMG / "logo.png", 1400, mini=False)
    logo(IMG / "logo-mini-white.png", 320, mini=True)

    for name, initials, seed in (
        ("bashilov", "АБ", 101),
        ("bluket", "ВБ", 202),
        ("gavrilov", "АГ", 303),
        ("khaletskiy", "КХ", 404),
        ("trifonov", "АТ", 505),
    ):
        jury_card(JURY / f"{name}.png", initials, seed)


if __name__ == "__main__":
    main()
