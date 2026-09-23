#!/usr/bin/env python3
"""Генерирует robots.txt и sitemap.xml для сайта «Кибер Кино».

Адрес сайта задан одной константой: при переезде на собственный домен меняем
её здесь и перезапускаем скрипт — больше нигде домен в этих файлах не зашит.

Запуск:  python3 tools/make_seo.py
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

# ↓↓↓ при переезде на свой домен меняем только эту строку ↓↓↓
SITE_URL = "https://kk-03.vercel.app"

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# страница → (приоритет, частота обновления); у каждой есть пара на другом языке
PAGES = [
    ("/", "1.0", "weekly", "/en/"),
    ("/rules.html", "0.8", "monthly", "/en/rules.html"),
    ("/privacy.html", "0.3", "yearly", "/en/privacy.html"),
    ("/en/", "1.0", "weekly", "/"),
    ("/en/rules.html", "0.8", "monthly", "/rules.html"),
    ("/en/privacy.html", "0.3", "yearly", "/privacy.html"),
]


def lang_of(path: str) -> str:
    return "en" if path.startswith("/en") else "ru"


def sitemap() -> str:
    today = date.today().isoformat()
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]
    for path, priority, freq, pair in PAGES:
        out.append("  <url>")
        out.append(f"    <loc>{SITE_URL}{path}</loc>")
        # обе языковые версии каждой страницы указывают друг на друга
        out.append(
            f'    <xhtml:link rel="alternate" hreflang="{lang_of(path)}" href="{SITE_URL}{path}" />'
        )
        out.append(
            f'    <xhtml:link rel="alternate" hreflang="{lang_of(pair)}" href="{SITE_URL}{pair}" />'
        )
        ru = path if lang_of(path) == "ru" else pair
        out.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE_URL}{ru}" />')
        out.append(f"    <lastmod>{today}</lastmod>")
        out.append(f"    <changefreq>{freq}</changefreq>")
        out.append(f"    <priority>{priority}</priority>")
        out.append("  </url>")
    out.append("</urlset>")
    return "\n".join(out) + "\n"


def robots() -> str:
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n"
    )


def main() -> None:
    PUBLIC.mkdir(exist_ok=True)
    (PUBLIC / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    (PUBLIC / "robots.txt").write_text(robots(), encoding="utf-8")
    print("готово:", SITE_URL)
    print("  public/sitemap.xml —", len(PAGES), "страниц")
    print("  public/robots.txt")


if __name__ == "__main__":
    main()
