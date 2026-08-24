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

  /* --- Фоновая картинка следует за курсором --------------------------------
     Логика как в исходном компоненте: чем дальше курсор от центра, тем сильнее
     картинка уходит в противоположную сторону. Диапазон симметричный (±k/2 %),
     потому что элемент отцентрован, а не прижат к углу. */
  function initPointerParallax() {
    const items = $$('[data-parallax-mouse]');
    if (!items.length || reduced || coarse) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let raf = 0;

    const loop = () => {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      items.forEach((el) => {
        const k = parseFloat(el.dataset.parallaxMouse) || 6;
        el.style.setProperty('--mx', `${(current.x * k).toFixed(2)}%`);
        el.style.setProperty('--my', `${(current.y * k).toFixed(2)}%`);
      });
      const rest = Math.abs(target.x - current.x) < 0.0005 && Math.abs(target.y - current.y) < 0.0005;
      raf = rest ? 0 : requestAnimationFrame(loop);
    };

    window.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse') return;
        target.x = 0.5 - event.clientX / window.innerWidth;
        target.y = 0.5 - event.clientY / window.innerHeight;
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { passive: true }
    );
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

  /* --- Фон из «плывущих» кривых -------------------------------------------
     Порт эффекта Background Paths: два зеркальных набора по 36 кривых,
     по каждой бесконечно бежит светящийся штрих. Разметка генерируется здесь,
     чтобы не тащить в HTML 72 длинных атрибута d. */
  function initFloatingPaths() {
    const hosts = $$('[data-paths]');
    if (!hosts.length) return;

    const VB = { w: 696, h: 316 };      // система координат из исходного компонента
    const PER_SET = 36;                 // столько же кривых, сколько в оригинале
    const DPR_CAP = 2;

    /* Две контрольные точки кривой смещаются по x в одну сторону, остальные —
       в другую, поэтому веер именно расходится, а не едет целиком. */
    const curve = (i, position) => {
      const s = i * 5 * position;
      const y = i * 6;
      return [
        [-(380 - s), -(189 + y)],
        [-(380 - s), -(189 + y)],
        [-(312 - s), 216 - y],
        [152 - s, 343 - y],
        [616 - s, 470 - y],
        [684 - s, 875 - y],
        [684 - s, 875 - y],
      ];
    };

    /* Длину каждой кривой замеряем один раз через SVG: в canvas такого API нет,
       а штрих задаётся долями длины. */
    const measure = (pts) => {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
      const path = document.createElementNS(NS, 'path');
      path.setAttribute(
        'd',
        `M${pts[0]} C${pts[1]} ${pts[2]} ${pts[3]} C${pts[4]} ${pts[5]} ${pts[6]}`
      );
      svg.appendChild(path);
      document.body.appendChild(svg);
      const len = path.getTotalLength();
      svg.remove();
      return len;
    };

    hosts.forEach((host) => {
      if (host.dataset.paths === 'done') return;
      host.dataset.paths = 'done';

      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      host.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const lines = [];
      [1, -1].forEach((position) => {
        for (let i = 0; i < PER_SET; i += 1) {
          const pts = curve(i, position);
          lines.push({
            pts,
            len: measure(pts),
            width: 0.5 + i * 0.03,
            alpha: Math.min(1, 0.1 + i * 0.03),
            speed: 1 / (20 + Math.random() * 10),   // полный проход штриха за 20–30 с
            phase: Math.random(),
          });
        }
      });

      let dpr = 1;
      let scale = 1;
      let offset = { x: 0, y: 0 };
      let color = '#08080a';

      const resize = () => {
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        /* Та же вписка, что делал SVG с preserveAspectRatio="xMidYMid meet". */
        scale = Math.min(rect.width / VB.w, rect.height / VB.h);
        offset = {
          x: (rect.width - VB.w * scale) / 2,
          y: (rect.height - VB.h * scale) / 2,
        };
        color = getComputedStyle(host).color || color;
        return true;
      };

      const draw = (time) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';

        lines.forEach((line) => {
          const [p0, c1, c2, p1, c3, c4, p2] = line.pts;
          ctx.beginPath();
          ctx.moveTo(p0[0], p0[1]);
          ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]);
          ctx.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], p2[0], p2[1]);
          ctx.lineWidth = line.width;
          const t = (time * line.speed + line.phase) % 1;
          ctx.globalAlpha = line.alpha * (0.55 + 0.45 * Math.sin(t * Math.PI * 2));
          ctx.setLineDash([line.len * 0.62, line.len * 0.38]);
          ctx.lineDashOffset = -line.len * t;
          ctx.stroke();
        });

        ctx.restore();
        ctx.globalAlpha = 1;
      };

      let raf = 0;
      let running = false;
      const tick = (now) => {
        draw(now / 1000);
        raf = running ? requestAnimationFrame(tick) : 0;
      };
      const start = () => {
        if (running || reduced) return;
        running = true;
        raf = requestAnimationFrame(tick);
      };
      const stop = () => {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      };

      if (!resize()) return;
      draw(0);

      /* Высота секции меняется после загрузки шрифтов и при переносах строк,
         поэтому размер холста отслеживаем у самого блока, а не у окна. */
      const refresh = () => {
        if (resize()) draw(performance.now() / 1000);
      };
      if ('ResizeObserver' in window) {
        let pending = 0;
        new ResizeObserver(() => {
          if (pending) return;
          pending = requestAnimationFrame(() => {
            pending = 0;
            refresh();
          });
        }).observe(host);
      } else {
        let resizeTimer = 0;
        window.addEventListener(
          'resize',
          () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(refresh, 150);
          },
          { passive: true }
        );
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);

      /* Кадры считаются только пока секция на экране. */
      if (reduced) return;
      if (!('IntersectionObserver' in window)) {
        start();
        return;
      }
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
        },
        { rootMargin: '200px 0px' }
      ).observe(host);
    });
  }

  /* --- Частицы на фоне ------------------------------------------------------
     Порт компонента Particles: точки медленно плывут, тянутся к курсору
     и гаснут у краёв блока. Количество считается от площади, чтобы на
     широком экране плотность не проваливалась, а на телефоне не росла зря. */
  function initParticles() {
    const hosts = $$('[data-particles]');
    if (!hosts.length) return;

    const DPR_CAP = 2;
    const STATICITY = 50; // насколько слабо точки реагируют на курсор
    const EASE = 50; // инерция притяжения
    const BASE_SIZE = 0.4;
    const REF_AREA = 1440 * 800; // площадь, для которой задано количество в разметке

    const pointer = { x: 0, y: 0 };
    window.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse') return;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      },
      { passive: true }
    );

    hosts.forEach((host) => {
      if (host.dataset.particlesReady === 'done') return;
      host.dataset.particlesReady = 'done';

      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      host.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const base = parseInt(host.dataset.particles, 10) || 120;
      let circles = [];
      let size = { w: 0, h: 0 };
      let dpr = 1;
      let rgb = '8, 8, 10';
      const mouse = { x: 0, y: 0 };

      const spawn = () => ({
        x: Math.floor(Math.random() * size.w),
        y: Math.floor(Math.random() * size.h),
        translateX: 0,
        translateY: 0,
        size: Math.floor(Math.random() * 2) + BASE_SIZE,
        alpha: 0,
        targetAlpha: parseFloat((Math.random() * 0.6 + 0.1).toFixed(1)),
        dx: (Math.random() - 0.5) * 0.1,
        dy: (Math.random() - 0.5) * 0.1,
        magnetism: 0.1 + Math.random() * 4,
      });

      const resize = () => {
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        size = { w: rect.width, h: rect.height };
        canvas.width = Math.round(size.w * dpr);
        canvas.height = Math.round(size.h * dpr);
        canvas.style.width = `${size.w}px`;
        canvas.style.height = `${size.h}px`;

        const color = getComputedStyle(host).color.match(/\d+/g);
        if (color && color.length >= 3) rgb = color.slice(0, 3).join(', ');

        const quantity = Math.max(
          30,
          Math.round((base * size.w * size.h) / REF_AREA)
        );
        circles = Array.from({ length: quantity }, spawn);
        return true;
      };

      const draw = () => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.w, size.h);
        circles.forEach((c) => {
          ctx.translate(c.translateX, c.translateY);
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${c.alpha})`;
          ctx.fill();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        });
      };

      /* Плавное затухание у границ блока: точка гаснет, не доходя до края. */
      const edgeFade = (c) => {
        const edges = [
          c.x + c.translateX - c.size,
          size.w - c.x - c.translateX - c.size,
          c.y + c.translateY - c.size,
          size.h - c.y - c.translateY - c.size,
        ];
        const closest = Math.min.apply(null, edges);
        const k = Math.max(0, closest / 20);
        if (k > 1) {
          c.alpha = Math.min(c.targetAlpha, c.alpha + 0.02);
        } else {
          c.alpha = c.targetAlpha * k;
        }
      };

      const step = () => {
        const rect = canvas.getBoundingClientRect();
        const mx = pointer.x - rect.left - size.w / 2;
        const my = pointer.y - rect.top - size.h / 2;
        if (Math.abs(mx) < size.w / 2 && Math.abs(my) < size.h / 2) {
          mouse.x = mx;
          mouse.y = my;
        }

        circles.forEach((c, i) => {
          edgeFade(c);
          c.x += c.dx;
          c.y += c.dy;
          c.translateX += (mouse.x / (STATICITY / c.magnetism) - c.translateX) / EASE;
          c.translateY += (mouse.y / (STATICITY / c.magnetism) - c.translateY) / EASE;

          const out =
            c.x < -c.size || c.x > size.w + c.size || c.y < -c.size || c.y > size.h + c.size;
          if (out) circles[i] = spawn();
        });

        draw();
        raf = running ? requestAnimationFrame(step) : 0;
      };

      let raf = 0;
      let running = false;
      const start = () => {
        if (running || reduced) return;
        running = true;
        raf = requestAnimationFrame(step);
      };
      const stop = () => {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      };

      if (!resize()) return;
      circles.forEach((c) => {
        c.alpha = c.targetAlpha;
      });
      draw();

      const refresh = () => {
        if (!resize()) return;
        if (reduced) circles.forEach((c) => (c.alpha = c.targetAlpha));
        draw();
      };
      if ('ResizeObserver' in window) {
        let pending = 0;
        new ResizeObserver(() => {
          if (pending) return;
          pending = requestAnimationFrame(() => {
            pending = 0;
            refresh();
          });
        }).observe(host);
      } else {
        window.addEventListener('resize', refresh, { passive: true });
      }

      if (reduced) return;
      if (!('IntersectionObserver' in window)) {
        start();
        return;
      }
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
        },
        { rootMargin: '200px 0px' }
      ).observe(host);
    });
  }

  /* --- «Читать далее» в разделе о фестивале -------------------------------
     Кнопка видна только на узких экранах — на широких текст показан целиком,
     поэтому состояние сбрасывается при возврате к десктопной раскладке. */
  function initAboutToggle() {
    const toggle = $('.about__toggle');
    const text = toggle && toggle.closest('.about__text');
    if (!toggle || !text) return;

    const label = $('span', toggle);
    const opened = label ? label.textContent.trim() : '';
    const closed = opened === 'Read more' ? 'Show less' : 'Свернуть';

    toggle.addEventListener('click', () => {
      const open = text.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? closed : opened;
    });
  }

  /* --- Карточки жюри -------------------------------------------------------
     На мыши регалии показывает :hover, с клавиатуры — :focus-within. Пальцем
     наведения нет, поэтому на тач-экранах карточку открывает касание: тап по
     портрету показывает её, повторный тап или касание мимо — прячет. */
  function initJury() {
    const jurors = $$('.juror');
    if (!jurors.length) return;

    const close = (except) => {
      jurors.forEach((j) => {
        if (j !== except) j.classList.remove('is-open');
      });
    };

    jurors.forEach((juror) => {
      juror.addEventListener('click', () => {
        if (!coarse) return;
        const open = !juror.classList.contains('is-open');
        close(juror);
        juror.classList.toggle('is-open', open);
      });
      // тап по карточке считаем тапом по портрету — она лежит поверх фото
      juror.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        juror.classList.remove('is-open');
        juror.blur();
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.juror')) close(null);
    });
  }

  /* --- Согласие на cookie и обработку персональных данных ------------------ */
  function initConsent() {
    const box = $('.consent');
    if (!box) return;

    const KEY = 'ck-consent';
    let saved = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch (e) {
      /* приватный режим: покажем плашку, но запомнить согласие не сможем */
    }
    if (saved === 'accepted') return;

    box.hidden = false;
    // отдельный кадр, иначе браузер не увидит смены transform и не анимирует
    requestAnimationFrame(() => box.classList.add('is-visible'));

    const accept = $('[data-consent-accept]', box);
    if (!accept) return;

    accept.addEventListener('click', () => {
      try {
        localStorage.setItem(KEY, 'accepted');
      } catch (e) {
        /* не удалось сохранить — плашка просто вернётся при следующем заходе */
      }
      box.classList.remove('is-visible');
      let done = false;
      const hide = () => {
        if (done) return;
        done = true;
        box.hidden = true;
      };
      box.addEventListener('transitionend', hide, { once: true });
      setTimeout(hide, 700); // подстраховка, если перехода не было
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
    initPointerParallax();
    initFloatingPaths();
    initParticles();
    initAboutToggle();
    initJury();
    initCursor();
    initScramble();
    initLang();
    initConsent();
    initRulesPage();
    initYear();
    if (window.CyberKino && window.CyberKino.initHero) {
      window.CyberKino.initHero($('.hero__stage'));
    }
  });
})();
