/* =============================================================================
   Общая механика сайта «Кибер Кино»: меню, появление секций, аккордеон
   номинаций, кастомный курсор, параллакс, оглавление правил.
   Все декоративные эффекты отключаются при prefers-reduced-motion.
   ============================================================================= */

(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* --- Шапка: фон при скролле + мобильное меню ---------------------------- */
  function initHeader() {
    const header = $('.header');
    const burger = $('.burger');
    if (!header) return;

    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (burger) {
      const toggle = (force) => {
        const open = force !== undefined ? force : !document.body.classList.contains('menu-open');
        document.body.classList.toggle('menu-open', open);
        burger.setAttribute('aria-expanded', String(open));
      };
      burger.addEventListener('click', () => toggle());
      $$('.nav a').forEach((link) => link.addEventListener('click', () => toggle(false)));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') toggle(false);
      });
    }
  }

  /* --- Появление блоков при скролле --------------------------------------- */
  function initReveal() {
    const items = $$('.reveal');
    if (!items.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
  }

  /* --- Разбивка заголовка героя на буквы ---------------------------------- */
  function initSplitTitle() {
    const title = $('.hero__title');
    if (!title || title.dataset.split === 'done') return;
    const words = (title.textContent || '').trim().split(/\s+/);
    title.textContent = '';
    let index = 0;
    words.forEach((word) => {
      const wrap = document.createElement('span');
      wrap.className = 'word';
      Array.from(word).forEach((char) => {
        const span = document.createElement('span');
        span.className = 'char';
        span.style.setProperty('--i', String(index));
        span.textContent = char;
        wrap.appendChild(span);
        index += 1;
      });
      title.appendChild(wrap);
    });
    title.dataset.split = 'done';
  }

  /* --- Аккордеон номинаций ------------------------------------------------ */
  function initNominations() {
    $$('.nom').forEach((item) => {
      const head = $('.nom__head', item);
      const body = $('.nom__body', item);
      if (!head || !body) return;
      head.addEventListener('click', () => {
        const open = item.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* --- Кастомный курсор + «магнитные» кнопки ------------------------------ */
  function initCursor() {
    if (reduced || coarse) return;
    const dot = document.createElement('div');
    dot.className = 'cursor';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const target = { ...pos };
    let raf = 0;

    const loop = () => {
      pos.x += (target.x - pos.x) * 0.2;
      pos.y += (target.y - pos.y) * 0.2;
      dot.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        target.x = e.clientX;
        target.y = e.clientY;
        dot.classList.add('is-visible');
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { passive: true }
    );
    document.addEventListener('pointerleave', () => dot.classList.remove('is-visible'));

    const hot = 'a, button, .nom__head, .juror, .biz__cell';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest && e.target.closest(hot)) dot.classList.add('is-active');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest && e.target.closest(hot)) dot.classList.remove('is-active');
    });

    /* Магнит: кнопка слегка тянется к курсору. */
    $$('.btn').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.32;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* --- Параллакс: только transform, без пересчёта раскладки ---------------- */
  function initParallax() {
    const items = $$('[data-parallax]');
    if (!items.length || reduced) return;
    let ticking = false;

    const update = () => {
      const vh = window.innerHeight;
      items.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) return;
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        const offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  /* --- Скремблер букв в меню и на подписях --------------------------------- */
  function initScramble() {
    if (reduced || coarse) return;
    const glyphs = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ01#/\\<>*';
    $$('[data-scramble]').forEach((el) => {
      const original = el.textContent;
      let timer = 0;
      el.addEventListener('pointerenter', () => {
        let frame = 0;
        clearInterval(timer);
        timer = setInterval(() => {
          frame += 1;
          el.textContent = original
            .split('')
            .map((ch, i) =>
              ch === ' ' || i < frame ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]
            )
            .join('');
          if (frame > original.length) {
            clearInterval(timer);
            el.textContent = original;
          }
        }, 28);
      });
      el.addEventListener('pointerleave', () => {
        clearInterval(timer);
        el.textContent = original;
      });
    });
  }

  /* --- Бегущая строка: дублируем содержимое для бесшовного цикла ----------- */
  function initMarquee() {
    $$('.marquee__track').forEach((track) => {
      if (track.dataset.cloned === 'done') return;
      track.innerHTML += track.innerHTML;
      track.dataset.cloned = 'done';
    });
  }

  /* --- Язык: запоминаем выбор пользователя -------------------------------- */
  function initLang() {
    $$('.lang a').forEach((link) => {
      link.addEventListener('click', () => {
        try {
          localStorage.setItem('ck-lang', link.dataset.lang || '');
        } catch (e) {
          /* приватный режим — просто ничего не запоминаем */
        }
      });
    });
  }

  /* --- Страница правил: прогресс чтения и активный пункт оглавления -------- */
  function initRulesPage() {
    const doc = $('.doc');
    if (!doc) return;

    const bar = $('.progress');
    if (bar) {
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.setProperty('--p', max > 0 ? String(Math.min(1, window.scrollY / max)) : '0');
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    const links = $$('.toc a');
    const sections = links
      .map((link) => document.getElementById((link.getAttribute('href') || '').slice(1)))
      .filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) =>
            link.classList.toggle(
              'is-current',
              (link.getAttribute('href') || '').slice(1) === entry.target.id
            )
          );
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sections.forEach((section) => io.observe(section));
  }

  /* --- Год в подвале ------------------------------------------------------- */
  function initYear() {
    $$('[data-year]').forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initSplitTitle();
    initReveal();
    initNominations();
    initMarquee();
    initParallax();
    initCursor();
    initScramble();
    initLang();
    initRulesPage();
    initYear();
    if (window.CyberKino && window.CyberKino.initHero) {
      window.CyberKino.initHero($('.hero__stage'));
    }
  });
})();
