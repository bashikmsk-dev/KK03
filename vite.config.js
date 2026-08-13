import { defineConfig } from 'vite';
import { cp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// package.json объявляет "type": "module", поэтому rootDir нужно получить вручную
const rootDir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = 'dist';

/**
 * Скрипты сайта подключены как обычные (не module) — благодаря этому
 * index.html работает даже при открытии файла с диска, без сервера:
 * ES-модули браузер по протоколу file:// не грузит.
 *
 * Такие теги Vite не бандлит, поэтому переносим папку скриптов в сборку как есть.
 */
function copyClassicScripts() {
  return {
    name: 'cyber-kino:copy-classic-scripts',
    apply: 'build',
    async closeBundle() {
      await cp(resolve(rootDir, 'assets/js'), resolve(rootDir, OUT_DIR, 'assets/js'), {
        recursive: true,
      });
    },
  };
}

/**
 * При сборке Vite считает ассетом любой href у <link> — включая rel="canonical"
 * и hreflang-альтернаты. Из-за этого страницы дублировались в dist/assets/ под
 * хешированными именами, а canonical начинал указывать на копию.
 *
 * Прячем такие теги в комментарий до обработки и возвращаем после неё:
 * SEO-ссылки должны вести на человекочитаемые адреса страниц.
 */
function keepPageLinks() {
  const PAGE_LINK = /<link\b[^>]*\brel="(?:canonical|alternate)"[^>]*>/gi;
  const stash = new Map();

  return [
    {
      name: 'cyber-kino:page-links-hide',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          const tags = [];
          const out = html.replace(PAGE_LINK, (tag) => `<!--ck-link:${tags.push(tag) - 1}-->`);
          stash.set(ctx.path, tags);
          return out;
        },
      },
    },
    {
      name: 'cyber-kino:page-links-restore',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          const tags = stash.get(ctx.path) || [];
          return html.replace(/<!--ck-link:(\d+)-->/g, (match, i) => tags[Number(i)] ?? match);
        },
      },
    },
  ];
}

/**
 * Сайт остаётся обычной статикой: файлы в репозитории самодостаточны и
 * открываются напрямую. Vite нужен только как удобный дев-сервер
 * (`npm run dev`) и как сборщик минифицированной версии (`npm run build`).
 *
 * base: './' — все пути в собранной версии относительные, поэтому dist
 * работает и в корне домена, и в подпапке (GitHub Pages вида /kk03/).
 */
export default defineConfig({
  root: rootDir,
  base: './',
  publicDir: 'public',
  plugins: [keepPageLinks(), copyClassicScripts()],
  server: {
    port: 5173,
    open: false,
    host: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    assetsInlineLimit: 0, // шрифты и картинки всегда отдельными файлами
    rollupOptions: {
      // Четыре самостоятельные страницы: русская и английская версии
      input: {
        ru: resolve(rootDir, 'index.html'),
        ruRules: resolve(rootDir, 'rules.html'),
        en: resolve(rootDir, 'en/index.html'),
        enRules: resolve(rootDir, 'en/rules.html'),
      },
    },
  },
});
