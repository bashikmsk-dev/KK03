/* =============================================================================
   Герой: реверс-эффект Enshtane 01 ↔ Enshtane 02.

   REVEAL_MODE — единственная строка, которую нужно править, чтобы
   переключить логику проявления:

     'outside' — базово виден Enshtane 01; вокруг курсора остаётся «дыра»,
                 а ВСЯ остальная площадь превращается в Enshtane 02
                 («за областью курсора проявляется 02»);
     'lens'    — обратный вариант: Enshtane 02 виден только в круге
                 под курсором, снаружи остаётся 01.
   ============================================================================= */

window.CyberKino = window.CyberKino || {};

const REVEAL_MODE = 'outside';

const REVEAL_RADIUS = 0.28; // радиус маски в долях от меньшей стороны сцены
const RADIUS_MIN = 150;
const RADIUS_MAX = 420;
const EASE = 0.14; // сглаживание движения маски (0 — не двигается, 1 — без инерции)

window.CyberKino.initHero = function initHero(stage) {
  if (!stage) return;

  const reveal = stage.querySelector('.hero__img--reveal');
  const ring = stage.querySelector('.hero__ring');
  const title = document.querySelector('.hero__title');
  if (!reveal) return;

  stage.dataset.revealMode = stage.dataset.revealMode || REVEAL_MODE;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)');

  let w = stage.offsetWidth;
  let h = stage.offsetHeight;
  let radius = 0;
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let active = false;
  let raf = 0;
  let autoStart = 0;

  const measure = () => {
    w = stage.offsetWidth;
    h = stage.offsetHeight;
    radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.min(w, h) * REVEAL_RADIUS));
    stage.style.setProperty('--reveal-r', `${radius}px`);
    if (!active) {
      target.x = current.x = w / 2;
      target.y = current.y = h / 2;
      paint();
    }
  };

  const paint = () => {
    stage.style.setProperty('--reveal-x', `${current.x.toFixed(1)}px`);
    stage.style.setProperty('--reveal-y', `${current.y.toFixed(1)}px`);
    if (ring) ring.style.transform = `translate(${current.x.toFixed(1)}px, ${current.y.toFixed(1)}px)`;
  };

  /* Плавное преследование указателя + микро-глитч на резких движениях. */
  const tick = () => {
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    current.x += dx * EASE;
    current.y += dy * EASE;
    paint();

    if (title) {
      const speed = Math.hypot(dx, dy);
      title.classList.toggle('is-glitching', active && speed > 26);
    }

    raf = Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3 || active ? requestAnimationFrame(tick) : 0;
  };

  const start = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const setActive = (state) => {
    active = state;
    stage.classList.toggle('is-revealing', state);
    if (state) start();
  };

  const onPointerMove = (event) => {
    const rect = stage.getBoundingClientRect();
    target.x = event.clientX - rect.left;
    target.y = event.clientY - rect.top;
    if (!active) setActive(true);
    else start();
  };

  /* Автоматическое «дыхание» маски там, где курсора нет: тач и reduced-motion. */
  const auto = (time) => {
    if (!autoStart) autoStart = time;
    const t = (time - autoStart) / 1000;
    target.x = w / 2 + Math.sin(t * 0.42) * w * 0.22;
    target.y = h / 2 + Math.sin(t * 0.63) * h * 0.16;
    start();
    autoRaf = requestAnimationFrame(auto);
  };
  let autoRaf = 0;

  const stopAuto = () => {
    if (autoRaf) cancelAnimationFrame(autoRaf);
    autoRaf = 0;
  };

  const applyMode = () => {
    stopAuto();
    if (reduced.matches) {
      setActive(false);
      measure();
      return;
    }
    if (coarse.matches) {
      setActive(true);
      autoStart = 0;
      autoRaf = requestAnimationFrame(auto);
    }
  };

  measure();
  applyMode();

  window.addEventListener('resize', measure, { passive: true });
  stage.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse' && !reduced.matches) onPointerMove(event);
  });
  stage.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || reduced.matches) return;
      stopAuto();
      onPointerMove(event);
    },
    { passive: true }
  );
  stage.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    setActive(false);
    if (title) title.classList.remove('is-glitching');
  });

  reduced.addEventListener('change', applyMode);
  coarse.addEventListener('change', applyMode);
};
