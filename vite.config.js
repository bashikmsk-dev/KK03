import { defineConfig } from 'vite';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// package.json объявляет "type": "module", поэтому rootDir нужно получить вручную
const rootDir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = 'dist';

// адрес сайта в одном месте — им же пользуется tools/make_seo.py
const SITE_URL = createRequire(import.meta.url)('./site.config.json').siteUrl.replace(/\/$/, '');

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
 * Страница 404 отдаётся хостингом по любому несуществующему адресу, в том числе
 * вложенному вроде /a/b/c. Относительные пути ./assets/… браузер разрешает
 * относительно запрошенного адреса, поэтому на такой странице стили и скрипт
 * не нашлись бы. Здесь и только здесь переводим их в абсолютные.
 */
function absoluteNotFoundLinks() {
  return {
    name: 'cyber-kino:absolute-404-links',
    apply: 'build',
    async closeBundle() {
      for (const name of ['404.html', 'en/404.html']) {
        const file = resolve(rootDir, OUT_DIR, name);
        let html;
        try {
          html = await readFile(file, 'utf8');
        } catch {
          continue; // страницы нет в сборке — нечего править
        }
        // ../ встречается только в английской версии: она лежит на уровень глубже
        const absolute = html
          .replace(/(src|href)="\.{1,2}\//g, '$1="/')
          // srcset — это список адресов через запятую, одной заменой его не взять
          .replace(/srcset="([^"]*)"/g, (match, list) => `srcset="${list.replace(/\.{1,2}\//g, '/')}"`);
        await writeFile(file, absolute, 'utf8');
      }
    },
  };
}

/**
 * Конфиг для Apache и LiteSpeed кладём прямо в сборку: так папка dist/
 * готова к загрузке на обычный хостинг целиком, без ручных шагов.
 * На nginx этот файл просто лежит без дела (раздачу точечных файлов
 * закрывает правило из deploy/nginx.conf.sample).
 */
function copyDeployFiles() {
  return {
    name: 'cyber-kino:copy-deploy-files',
    apply: 'build',
    async closeBundle() {
      await cp(resolve(rootDir, 'deploy/.htaccess'), resolve(rootDir, OUT_DIR, '.htaccess'));
      await cp(resolve(rootDir, 'deploy/en.htaccess'), resolve(rootDir, OUT_DIR, 'en/.htaccess'));
    },
  };
}

/**
 * Относительные canonical, hreflang и og:image годятся для просмотра файлов с
 * диска, но не для поисковиков и соцсетей: Open Graph требует абсолютных
 * адресов, иначе мессенджеры не показывают картинку в превью, а относительный
 * canonical не защищает от дублей, когда на сайт ведёт больше одного домена.
 *
 * Поэтому в собранных страницах переводим их в абсолютные — адрес сайта берём
 * из site.config.json, того же файла, которым пользуется tools/make_seo.py.
 * Заодно дописываем og:url, которого в исходнике нет: осмысленным он тоже
 * становится только с доменом.
 */
function absoluteSeoLinks(siteUrl) {
  const PAGES = [
    ['index.html', '/'],
    ['rules.html', '/rules.html'],
    ['privacy.html', '/privacy.html'],
    ['en/index.html', '/en/'],
    ['en/rules.html', '/en/rules.html'],
    ['en/privacy.html', '/en/privacy.html'],
  ];
  // адрес страницы вида /en/index.html равен /en/ — так же, как в sitemap.xml
  const absolute = (href, pagePath) =>
    new URL(href, siteUrl + pagePath).href.replace(/\/index\.html$/, '/');

  return {
    name: 'cyber-kino:absolute-seo-links',
    apply: 'build',
    async closeBundle() {
      for (const [file, pagePath] of PAGES) {
        const full = resolve(rootDir, OUT_DIR, file);
        let html;
        try {
          html = await readFile(full, 'utf8');
        } catch {
          continue; // страницы нет в сборке
        }

        html = html.replace(
          /(<link\b[^>]*\brel="(?:canonical|alternate)"[^>]*\bhref=")([^"]+)(")/g,
          (match, head, href, tail) => head + absolute(href, pagePath) + tail
        );
        html = html.replace(
          /(<meta\b[^>]*\bproperty="og:image"[^>]*\bcontent=")([^"]+)(")/g,
          (match, head, href, tail) => head + absolute(href, pagePath) + tail
        );
        if (!html.includes('property="og:url"')) {
          html = html.replace(
            /(<meta\s+property="og:type"[^>]*>)/,
            `$1\n    <meta property="og:url" content="${siteUrl + pagePath}" />`
          );
        }

        await writeFile(full, html, 'utf8');
      }
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
  plugins: [
    keepPageLinks(),
    copyClassicScripts(),
    absoluteNotFoundLinks(),
    absoluteSeoLinks(SITE_URL),
    copyDeployFiles(),
  ],
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
        ruPrivacy: resolve(rootDir, 'privacy.html'),
        notFound: resolve(rootDir, '404.html'),
        notFoundEn: resolve(rootDir, 'en/404.html'),
        en: resolve(rootDir, 'en/index.html'),
        enRules: resolve(rootDir, 'en/rules.html'),
        enPrivacy: resolve(rootDir, 'en/privacy.html'),
      },
    },
  },
});
