/* ============================================================
   T. AVINESHWAR — DATA ANALYST PORTFOLIO ENGINE
   Light theme · Intro sequence (every visit, skippable)
   PDF / image lightbox · Workflow tracking
   GSAP scroll reveals · Mobile nav
   ============================================================ */
(function () {
  'use strict';

/* ============ GATES ============ */
const hasGsap = typeof window.gsap !== 'undefined';
const hasST   = hasGsap && typeof window.ScrollTrigger !== 'undefined';
const $  = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

/* ============ INTRO STORAGE ============ */
const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ PDF.JS (MOBILE TOUCH PREVIEWS) ============ */
/* On touch/narrow devices the native iframe PDF viewer can't be scrolled
   reliably with touch (and iOS Safari doesn't render PDFs in iframes at all).
   So we render the PDF with PDF.js into a plain vertically-scrolling box.
   Desktop keeps the interactive native iframe preview. */
const usePdfJsUI = () =>
  window.matchMedia('(hover: none), (pointer: coarse)').matches ||
  window.innerWidth <= 768;
const pdfjsReady = () => typeof window.pdfjsLib !== 'undefined';

function configurePdfWorker() {
  if (!pdfjsReady()) return false;
  if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdfjs/pdf.worker.min.js';
  }
  return true;
}

function pdfPageToCanvas(container, page, dpr, cssWidth) {
  const vp1 = page.getViewport({ scale: 1 });
  const scale = (cssWidth || 320) / vp1.width;
  const vp = page.getViewport({ scale: scale * dpr });
  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-page';
  canvas.width = Math.max(1, Math.floor(vp.width));
  canvas.height = Math.max(1, Math.floor(vp.height));
  canvas.style.width = (canvas.width / dpr) + 'px';
  canvas.style.height = (canvas.height / dpr) + 'px';
  container.appendChild(canvas);
  return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
}

function renderPdfRange(src, container, maxPages, onDone) {
  const done = typeof onDone === 'function' ? onDone : function () {};
  /* Render token: if a newer render starts while this one is still awaiting
     pages, this (stale) render stops appending so boxes never end up with
     duplicated PDF pages. */
  const token = (container._renderToken || 0) + 1;
  container._renderToken = token;
  const isCurrent = () => container._renderToken === token;

  if (!configurePdfWorker()) {
    if (isCurrent()) container.innerHTML = '<p class="pdf-fallback">Preview unavailable — use "Open Report" to view the document.</p>';
    if (isCurrent()) done();
    return;
  }
  container.innerHTML = '';
  container._pdfW = 0;
  if (isCurrent()) container.classList.add('is-loading');

  window.pdfjsLib.getDocument(src).promise
    .then(function (pdf) {
      if (!isCurrent()) return;
      container.classList.remove('is-loading');
      const total = pdf.numPages;
      const to = maxPages > 0 ? Math.min(total, maxPages) : total;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = Math.max(160, Math.floor(container.clientWidth) || 320);
      container._pdfW = cssWidth;
      let i = 1;
      const next = function () {
        if (i > to) { if (isCurrent()) done(); return; }
        const n = i++;
        pdf.getPage(n)
          .then(function (page) {
            if (isCurrent()) {
              return pdfPageToCanvas(container, page, dpr, cssWidth)
                .catch(function () {})
                .then(next);
            }
            return Promise.resolve();
          })
          .catch(function () { if (isCurrent()) next(); });
      };
      next();
    })
    .catch(function () {
      if (!isCurrent()) return;
      container.classList.remove('is-loading');
      container.innerHTML = '<p class="pdf-fallback">Preview load failed — use "Open Report" to view the document.</p>';
      done();
    });
}

function initPdfPreviews() {
  if (!usePdfJsUI() || !pdfjsReady()) return;
  let refreshPending = false;
  const refreshScroll = function () {
    if (refreshPending || typeof ScrollTrigger === 'undefined' || !hasST) return;
    refreshPending = true;
    requestAnimationFrame(function () {
      refreshPending = false;
      ScrollTrigger.refresh();
    });
  };
  const lazy = [];
  const renderBox = function (box, src) {
    if (box._rendered) return;
    box._rendered = true;
    renderPdfRange(src, box, 1, refreshScroll);
  };
  const checkLazyVisible = function () {
    lazy.forEach(function (o) {
      if (o.box._rendered) return;
      const r = o.box.getBoundingClientRect();
      if (r.top < window.innerHeight + 240 && r.bottom > -240) renderBox(o.box, o.src);
    });
  };
  /* Scroll fallback for lazy-rendering: IntersectionObserver always fires on
     gradual scroll, but instant jumps (anchor links / reduced-motion "auto"
     scroll-behavior) can skip its crossing detection. This rAF-throttled
     passive check guarantees previews still appear and stops doing any work
     once every box has rendered. */
  let pendingLazy = false;
  const onScrollLazy = function () {
    const remaining = lazy.some(function (o) { return !o.box._rendered; });
    if (!remaining || pendingLazy) return;
    pendingLazy = true;
    requestAnimationFrame(function () {
      pendingLazy = false;
      checkLazyVisible();
    });
  };
  window.addEventListener('scroll', onScrollLazy, { passive: true });

  $$('.pdf-cover-viewer').forEach(function (viewer) {
    const iframe = viewer.querySelector('iframe');
    if (!iframe || iframe.getAttribute('data-pdfjs')) return;
    const src = iframe.getAttribute('src');
    if (!src || !/\.pdf(\?[^#]*)?(#.*)?$/i.test(src)) return;
    iframe.setAttribute('data-pdfjs', '1');
    const box = document.createElement('div');
    box.className = 'pdf-cover-viewer-touch is-loading';
    box.setAttribute('aria-label', 'PDF preview — first page shown. Use Open Report to view the full document.');
    viewer.replaceChild(box, iframe);
    box._src = src;
    lazy.push({ box, src });

    /* Lazy-render pages the first time the card enters the viewport so we
       never rasterize heavy canvases for cards the user hasn't reached yet. */
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !en.target._rendered) {
            if (io) io.disconnect();
            renderBox(en.target, en.target._src);
          }
        });
      }, { rootMargin: '240px 0px' });
      io.observe(box);
    } else {
      renderBox(box, src);
    }

    /* Re-render pages at the correct size whenever the card width changes
       (rotation / resize / font-load) so the preview always fills the card.
       The render token discards any in-flight stale pass, so no duplicates. */
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(function (entries) {
        if (!box._rendered) return;
        const w = entries.length ? Math.floor(entries[0].contentRect.width) : 0;
        if (w > 0 && Math.abs(w - (box._pdfW || 0)) > 8) {
          renderPdfRange(src, box, 1, refreshScroll);
        }
      });
      ro.observe(box);
    }
  });
}

function revealHero() {
  $$('[data-hero]').forEach(el => {
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.classList.add('visible');
  });
}

function revealAllStatic() {
  $$('[data-reveal]').forEach(el => {
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.transform = 'none';
  });
  revealHero();
}
if (!hasGsap) revealAllStatic();
if (hasGsap && hasST) gsap.registerPlugin(window.ScrollTrigger);

/* ============ INTRO SEQUENCE ============ */
function runIntro() {
  const intro = $('#intro');
  if (!intro) return;
  let introDone = false;

  function detachSkipHandlers() {
    document.removeEventListener('click', onSkip);
    document.removeEventListener('touchstart', onSkip);
    document.removeEventListener('keydown', onSkip);
  }
  /* Function declaration: hoisted, so finishIntro->detachSkipHandlers can
     reference it even on the reduced-motion path where the intro is skipped
     before the listeners are ever attached. */
  function onSkip() { skipIntro(); }
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    intro.classList.add('is-hidden', 'is-completed');
    intro.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    revealHero();
    detachSkipHandlers();
  }
  function skipIntro() { finishIntro(); }

  /* Reduced motion: show the site immediately, no animation */
  if (isReduced) {
    finishIntro();
    return;
  }

  const introHelloEl  = $('#introHello');
  const introNameEl   = $('#introName');
  const introRoleEl   = $('#introRole');
  const introTaglineEl= $('#introTagline');
  const introLineEl   = $('#introLine');

  if (!introHelloEl || !introNameEl || !introRoleEl) {
    finishIntro();
    return;
  }

  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const dur  = 0.55;

  /* Slightly slower pacing on small screens so the reveal feels deliberate */
  const pace = window.innerWidth <= 768 ? 1.2 : 1;

  /* Background grid + orbs gently fade in */
  const grid = intro.querySelector('.intro-grid');
  if (grid) {
    grid.style.opacity = '1';
    grid.style.transition = 'opacity 1.1s ease';
  }
  const orbs = intro.querySelector('.intro-orbs');
  if (orbs) {
    orbs.style.opacity = '1';
    orbs.style.transition = 'opacity 1.3s ease';
  }

  document.body.style.overflow = 'hidden'; /* lock scroll during intro */

  /* Split a line into word-by-word spans, revealed one after another */
  function splitWords(el, delayBase, step, cls) {
    if (!el) return;
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = w;
      s.style.transitionDelay = (delayBase + i * step) + 'ms';
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode('\u00A0'));
    });
    void el.offsetWidth; /* reflow so the reveal transition runs */
    el.classList.add('iv-in');
  }

  /* Split a line into letter-by-letter spans, black text */
  function splitLetters(el, delayBase, step, cls) {
    if (!el) return;
    const txt = el.textContent.trim();
    el.textContent = '';
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = ch.replace(' ', '\u00A0');
      s.style.transitionDelay = (delayBase + i * step) + 'ms';
      el.appendChild(s);
    });
    void el.offsetWidth;
    el.classList.add('iv-in');
  }

  /* Soft fade for the closing tagline */
  function fadeIn(el, delay) {
    if (!el) return;
    setTimeout(() => {
      el.style.transition = `opacity ${dur}s ${ease}, transform ${dur}s ${ease}`;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delay);
  }

  /* 1) "HI, I'M" word-by-word → 2) AVINESHWAR letter-by-letter → 3) DATA ANALYST → 4) line + tagline */
  splitWords(introHelloEl, 150 * pace, 240 * pace, 'iv-word');
  splitLetters(introNameEl, 450 * pace, 70 * pace, 'iv-letter');
  splitLetters(introRoleEl, 1250 * pace, 85 * pace, 'iv-letter iv-letter-role');
  if (introLineEl) {
    setTimeout(() => {
      introLineEl.style.transition = `transform ${dur}s ${ease}`;
      introLineEl.style.transform = 'scaleX(1)';
    }, 2000 * pace);
  }
  fadeIn(introTaglineEl, 2320 * pace);

  /* Hand over to the hero */
  setTimeout(finishIntro, 3300 * pace);

  /* Skippable: tap / click / any key finishes the intro early */
  document.addEventListener('click', onSkip, { once: true });
  document.addEventListener('touchstart', onSkip, { once: true, passive: true });
  document.addEventListener('keydown', onSkip, { once: true });
}

/* ============ SMOOTH ANCHOR SCROLL ============ */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    if (a.closest('.nav-links')) closeMobileMenu();
    e.preventDefault();
    const offset = window.innerWidth <= 768 ? -56 : -72;
    const y = target.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top: y, behavior: isReduced ? 'auto' : 'smooth' });
  });
});

/* ============ MOBILE NAV ============ */
const burger    = $('#burger');
const navList   = $('#navLinks');
const bottomNav = $('#bottomNav');
const bnItems   = $$('.bn-item');

function closeMobileMenu() {
  if (!navList || !burger) return;
  navList.classList.remove('open');
  burger.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  if (bottomNav) bottomNav.style.display = '';
}
function openMobileMenu() {
  if (!navList || !burger) return;
  navList.classList.add('open');
  burger.classList.add('open');
  burger.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  if (bottomNav) bottomNav.style.display = 'none';
}
if (burger) burger.addEventListener('click', () => {
  if (navList.classList.contains('open')) closeMobileMenu();
  else openMobileMenu();
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 768 && navList.classList.contains('open')) closeMobileMenu();
});

/* ============ LIGHTBOX (PDF / IMAGE) ============ */
const lightbox      = $('#lightbox');
const lightboxTitle = $('#lightboxTitle');
const lightboxFrame = $('#lightboxFrame');
const lightboxImage = $('#lightboxImage');
const lightboxScroll = $('.lightbox-scroll');
const lightboxClose = $('#lightboxClose');
let lastFocused = null;
const IMG_RE = /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i;

function clearLightboxPdfPages() {
  if (lightboxScroll) {
    $$('.lb-pdf-pages', lightboxScroll).forEach(n => n.remove());
  }
}

function openLightbox(src, title) {
  if (!lightbox) return;
  lastFocused = document.activeElement;
  lightboxTitle.textContent = title || 'Case Study';
  const isImg = IMG_RE.test(src);
  clearLightboxPdfPages();
  if (isImg) {
    lightboxFrame.style.display = 'none';
    lightboxImage.src = src;
    lightboxImage.style.display = 'block';
  } else if (usePdfJsUI() && pdfjsReady()) {
    /* Mobile/touch: render the whole document as pages so it always opens */
    lightboxFrame.style.display = 'none';
    lightboxImage.style.display = 'none';
    const scroller = document.createElement('div');
    scroller.className = 'lb-pdf-pages';
    lightboxScroll.appendChild(scroller);
    renderPdfRange(src, scroller, 0);
  } else {
    lightboxImage.style.display = 'none';
    lightboxFrame.src = src;
    lightboxFrame.style.display = 'block';
  }
  lightbox.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  if (lightboxClose) lightboxClose.focus();
}
function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('is-open');
  lightboxFrame.src = '';
  lightboxImage.src = '';
  clearLightboxPdfPages();
  document.body.style.overflow = '';
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}
if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightbox) lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && lightbox && lightbox.classList.contains('is-open')) closeLightbox();
});

$$('[data-open]').forEach(btn => {
  btn.addEventListener('click', () => openLightbox(btn.dataset.open, btn.dataset.title));
});

/* ============ WORKFLOW SCROLL TRACKING ============ */
function initWorkflow() {
  const progress = $('#workflowProgress');
  const list = $('#workflowList');
  if (!progress || !list) return;
  const steps = list.querySelectorAll('.wf-step');
  if (!steps.length) return;
  const section = progress.parentElement;
  if (!section) return;
  const total = steps.length;
  let sectionTop = 0;
  let sectionH = 0;
  const measure = () => {
    const r = section.getBoundingClientRect();
    sectionTop = r.top + (window.scrollY || 0);
    sectionH = r.height;
  };
  measure();
  window.addEventListener('resize', measure, { passive: true });

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || window.pageYOffset;
    const viewportH = window.innerHeight;
    const top = sectionTop - viewportH * 0.45;
    const bottom = sectionTop + sectionH - viewportH * 0.3;
    let p = 0;
    if (scrollTop >= top && scrollTop <= bottom) {
      p = (scrollTop - top) / Math.max(1, bottom - top);
    } else if (scrollTop > bottom) {
      p = 1;
    }
    progress.style.width = (p * 100) + '%';
    const active = Math.min(total - 1, Math.floor(p * total));
    steps.forEach((s, i) => s.classList.toggle('is-active', i <= active));
  }, { passive: true });
}

/* ============ SCROLL REVEALS ============ */
function initReveals() {
  if (!hasGsap || !hasST) return;
  const dur = isReduced ? 0.01 : 0.7;

  $$('[data-reveal="up"]').forEach(el => {
    if (el.closest('.hero') || el.closest('.intro')) return;
    /* These have dedicated group animations below — animating them here too
       would start two tweens on the same element (double transform/opacity). */
    if (el.matches('.tool-card, .skill-card, .contact-card, .project')) return;
    gsap.fromTo(el,
      { y: 25, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: dur, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      }
    );
  });

  const skillCards = $$('.skill-card');
  if (skillCards.length) {
    gsap.fromTo(skillCards,
      { y: 20, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: '#skills', start: 'top 75%', once: true }
      }
    );
  }

  const toolCards = $$('.tool-card');
  if (toolCards.length) {
    gsap.fromTo(toolCards,
      { y: 22, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: '#tools', start: 'top 75%', once: true }
      }
    );
  }

  const trainingTools = $$('.training-tool');
  if (trainingTools.length) {
    gsap.fromTo(trainingTools,
      { y: 18, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power3.out',
        scrollTrigger: { trigger: '#training', start: 'top 80%', once: true }
      }
    );
  }

  $$('.project').forEach(proj => {
    const headRow = proj.querySelector('.project-head-row');
    const desc   = proj.querySelector('.project-desc');
    const cover  = proj.querySelector('.project-cover') || proj.querySelector('.pdf-cover');
    const facts  = proj.querySelector('.project-facts');
    const tags   = proj.querySelector('.project-toolpills');
    const actions = proj.querySelector('.project-actions');
    const items = [headRow, desc, cover, facts, tags, actions].filter(Boolean);
    const tl = gsap.timeline({ scrollTrigger: { trigger: proj, start: 'top 78%', once: true } });
    if (items.length) tl.from(items, { y: 20, autoAlpha: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' });
  });

  const tlItems = $$('.tl-item');
  if (tlItems.length) {
    gsap.fromTo(tlItems,
      { x: -20, autoAlpha: 0 },
      {
        x: 0, autoAlpha: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: '.timeline', start: 'top 80%', once: true }
      }
    );
  }

  const contactCards = $$('.contact-card');
  if (contactCards.length) {
    gsap.fromTo(contactCards,
      { y: 20, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: '#contact', start: 'top 78%', once: true }
      }
    );
  }
}

/* ============ NAV SCROLL ============ */
const nav = $('#nav');
const navLinks = $$('.nav-link');
const backToTop = $('#backToTop');
const sections = $$('section[id]');

function onScroll() {
  const y = window.scrollY || 0;
  if (nav) nav.classList.toggle('is-scrolled', y > 40);

  let current = '';
  sections.forEach(s => {
    if (y >= (s.offsetTop || 0) - 130) current = s.id;
  });
  navLinks.forEach(l => {
    l.classList.toggle('active', l.getAttribute('href') === '#' + current);
  });
  bnItems.forEach(b => {
    b.classList.toggle('active', b.getAttribute('href') === '#' + current);
  });
  if (backToTop) backToTop.classList.toggle('is-visible', y > 400);
}
window.addEventListener('scroll', onScroll, { passive: true });

if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: isReduced ? 'auto' : 'smooth' });
  });
}

/* ============ FOOTER YEAR ============ */
function initFooter() {
  const el = $('.footer-copy');
  if (el) el.textContent = `© ${new Date().getFullYear()} T. Avineshwar`;
}

/* ============ WEB COVER SCALE/CROP ============ */
function initWebCover() {
  $$('.project-cover-web iframe').forEach(iframe => {
    const cover = iframe.closest('.project-cover-web');
    if (!cover) return;
    const BASE_W = 1280;
    function fit() {
      const w = cover.clientWidth;
      const scale = w / BASE_W;
      iframe.style.transform = 'translateX(-50%) scale(' + scale + ')';
    }
    fit();
    window.addEventListener('resize', fit, { passive: true });
  });
}

/* ============ BOOT ============ */
function boot() {
  runIntro();
  initPdfPreviews();
  initReveals();
  initWorkflow();
  initFooter();
  initWebCover();
  onScroll();

  if (hasST) {
    window.addEventListener('load', () => ScrollTrigger.refresh());
    setTimeout(() => ScrollTrigger.refresh(), 800);
  }

  /* Failsafe: guarantee nothing is left hidden if a tween/trigger misbehaves */
  const forceRevealAll = function () {
    $$('[data-reveal]').forEach(el => {
      el.style.opacity = '1';
      el.style.visibility = 'visible';
      el.style.transform = 'none';
    });
    if (hasST) ScrollTrigger.refresh();
  };
  setTimeout(forceRevealAll, 5000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
})();