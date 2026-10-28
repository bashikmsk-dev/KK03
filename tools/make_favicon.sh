#!/usr/bin/env bash
#
# Иконки сайта «Кибер Кино» из логотипа — киноплёнки, свёрнутой в петлю.
#
# Кадр обрезан вплотную к самой петле: в исходнике вокруг неё много пустого
# чёрного поля, и без обрезки знак в иконке получился бы вдвое мельче, чем
# может. Фон у логотипа уже чёрный и совпадает с темой сайта, поэтому
# подкладывать ничего не нужно.
#
# Запуск:  bash tools/make_favicon.sh
# Нужен ImageMagick (команда convert).

set -euo pipefail
cd "$(dirname "$0")/.."

SRC=assets/img/logo-loop.jpg
OUT=public
CROP=1070x1070+99+58

icon() { # icon <размер> <файл> [доп. параметры]
  convert "$SRC" -crop "$CROP" +repage \
    -filter Lanczos -resize "$1x$1" -strip "${@:3}" "$2"
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# favicon.ico — вкладка браузера и выдача поисковиков. Три размера в одном
# файле: систему и браузер мы не выбираем, пусть берут подходящий.
#
# Яркость и резкость поднимаем только здесь. Плёнка в петле — тонкая лента,
# при уменьшении до пары десятков пикселей она расплывается и темнеет;
# крупным иконкам эта правка не нужна и только портила бы их.
for size in 16 32 48; do
  icon "$size" "$tmp/$size.png" -modulate 110 -unsharp 0x0.7+1.0+0.02
done
convert "$tmp/16.png" "$tmp/32.png" "$tmp/48.png" "$OUT/favicon.ico"

icon 180 "$OUT/apple-touch-icon.png" # «на экран Домой» в iOS
icon 192 "$OUT/icon-192.png"         # Android и панели вебмастеров

echo "Готово:"
ls -la "$OUT/favicon.ico" "$OUT/apple-touch-icon.png" "$OUT/icon-192.png"
