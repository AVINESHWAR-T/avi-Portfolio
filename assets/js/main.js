/* ============================================================
   T. AVINESHWAR â€” DATA ANALYST PORTFOLIO ENGINE
   Light/Dark theme Â· Intro sequence (every visit, skippable)
   PDF / image lightbox Â· Workflow tracking
   GSAP scroll reveals Â· Mobile nav Â· Role switcher
   Stats counters Â· Custom cursor Â· Project filters
   Parallax photo Â· Card tilt Â· Scroll progress
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
const isCoarse  = window.matchMedia('(pointer: coarse)').matches;

/* ============ PDF.JS (MOBILE TOUCH PREVIEWS) ============ */
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
  const token = (container._renderToken || 0) + 1;
  container._renderToken = token;
  const isCurrent = () => container._renderToken === token;

  if (!configurePdfWorker()) {
    if (isCurrent()) container.innerHTML = '<p class="pdf-fallback">Preview unavailable â€” use "Open Report" to view the document.</p>';
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
      container.innerHTML = '<p class="pdf-fallback">Preview load failed â€” use "Open Report" to view the document.</p>';
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
    box.setAttribute('aria-label', 'PDF preview â€” first page shown. Use Open Report to view the full document.');
    viewer.replaceChild(box, iframe);
    box._src = src;
    lazy.push({ box, src });

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
  function onSkip() { skipIntro(); }
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    intro.classList.add('is-hidden', 'is-completed');
    intro.setAttribute('aria-hidden', 'true');
    intro.style.display = 'none';
    document.body.style.overflow = '';
    document.querySelector('.nav').style.visibility = 'visible';
    document.querySelector('.nav').style.opacity = '1';
    revealHero();
    detachSkipHandlers();
  }
  function skipIntro() { finishIntro(); }

  if (isReduced) { finishIntro(); return; }

  const introHelloEl  = $('#introHello');
  const introNameEl   = $('#introName');
  const introRoleEl   = $('#introRole');
  const introTaglineEl= $('#introTagline');
  const introLineEl   = $('#introLine');

  if (!introHelloEl || !introNameEl || !introRoleEl) { finishIntro(); return; }

  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const dur  = 0.55;
  const pace = window.innerWidth <= 768 ? 1.2 : 1;

  const grid = intro.querySelector('.intro-grid');
  if (grid) { grid.style.opacity = '1'; grid.style.transition = 'opacity 1.1s ease'; }
  const orbs = intro.querySelector('.intro-orbs');
  if (orbs) { orbs.style.opacity = '1'; orbs.style.transition = 'opacity 1.3s ease'; }

  document.body.style.overflow = 'hidden';

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
    void el.offsetWidth;
    el.classList.add('iv-in');
  }

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

  function fadeIn(el, delay) {
    if (!el) return;
    setTimeout(() => {
      el.style.transition = `opacity ${dur}s ${ease}, transform ${dur}s ${ease}`;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delay);
  }

  /* Guard against the last glyph ("R") being clipped on any font/screen combo:
     measure the split letters and scale the whole name down to fit the column. */
  function fitIntroName(el) {
    if (!el) return;
    const letters = el.querySelectorAll('.iv-letter');
    if (!letters.length) return;
    let textW = 0;
    letters.forEach(function (s) { textW += s.offsetWidth; });
    const avail = el.parentElement ? el.parentElement.clientWidth : 0;
    if (!avail || !textW || textW <= avail) return;
    const scale = Math.max(0.55, avail / textW);
    el.style.transform = 'scale(' + scale.toFixed(4) + ')';
  }

  splitWords(introHelloEl, 150 * pace, 240 * pace, 'iv-word');
  splitLetters(introNameEl, 450 * pace, 70 * pace, 'iv-letter');
  splitLetters(introRoleEl, 1250 * pace, 85 * pace, 'iv-letter iv-letter-role');
  fitIntroName(introNameEl);
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(function () { fitIntroName(introNameEl); });
  }
  window.addEventListener('resize', function () { fitIntroName(introNameEl); });
  if (introLineEl) {
    setTimeout(() => {
      introLineEl.style.transition = `transform ${dur}s ${ease}`;
      introLineEl.style.transform = 'scaleX(1)';
    }, 2000 * pace);
  }
  fadeIn(introTaglineEl, 2320 * pace);
  setTimeout(finishIntro, 3300 * pace);

  document.addEventListener('click', onSkip, { once: true });
  document.addEventListener('touchstart', onSkip, { once: true, passive: true });
  document.addEventListener('keydown', onSkip, { once: true });
}

/* ============ DARK MODE ============ */
function initDarkMode() {
  const toggle = $('#themeToggle');
  if (!toggle) return;
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    toggle.setAttribute('aria-pressed', 'true');
  }
  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      toggle.setAttribute('aria-pressed', 'false');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      toggle.setAttribute('aria-pressed', 'true');
    }
  });
}

/* ============ SCROLL PROGRESS BAR ============ */
function initScrollProgress() {
  const bar = $('#scrollProgressBar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? (window.scrollY / h) * 100 : 0;
    bar.style.width = p + '%';
  }, { passive: true });
}

/* ============ ROLE SWITCHER ============ */
function initRoleSwitcher() {
  const el = $('#roleSwitcher');
  if (!el) return;
  const items = $$('.hr-item', el);
  if (items.length < 2) return;

  function sizeCycle() {
    const active = items.find(i => i.classList.contains('active')) || items[0];
    if (!active) return;
    const w = active.getBoundingClientRect().width;
    if (w > 0) el.style.width = Math.ceil(w) + 'px';
  }

  sizeCycle();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeCycle);
  window.addEventListener('resize', sizeCycle, { passive: true });

  let idx = 0;
  setInterval(() => {
    const curr = items[idx];
    idx = (idx + 1) % items.length;
    const next = items[idx];
    curr.classList.add('exit');
    curr.classList.remove('active');
    next.classList.add('active');
    sizeCycle();
    setTimeout(() => curr.classList.remove('exit'), 500);
  }, 2800);
}

/* ============ STATS COUNTER ============ */
function initStatsCounter() {
  const cards = $$('.stat-num[data-count]');
  if (!cards.length) return;
  let animated = false;
  function animate() {
    if (animated) return;
    animated = true;
    cards.forEach(card => {
      const target = parseInt(card.getAttribute('data-count'), 10);
      const dur = 2000;
      const start = performance.now();
      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / dur, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        card.textContent = Math.floor(eased * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
        else card.textContent = target.toLocaleString();
      }
      requestAnimationFrame(tick);
    });
  }
  if (typeof IntersectionObserver !== 'undefined') {
    const statsSection = $('#stats');
    if (statsSection) {
      const io = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { animate(); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(statsSection);
    }
  } else {
    animate();
  }
}

/* ============ CUSTOM CURSOR ============ */
function initCustomCursor() {
  if (isCoarse) return;
  const dot = $('#cursorDot');
  const ring = $('#cursorRing');
  if (!dot || !ring) return;
  let mx = 0, my = 0, dx = 0, dy = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;
  });
  function animateRing() {
    dx += (mx - dx) * 0.15;
    dy += (my - dy) * 0.15;
    ring.style.transform = `translate(${dx - 18}px, ${dy - 18}px)`;
    requestAnimationFrame(animateRing);
  }
  animateRing();
  const interactives = 'a, button, [data-open], .tool-card, .skill-card, .contact-card, .pf-btn, .cert-card';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(interactives)) {
      dot.classList.add('hovering');
      ring.classList.add('hovering');
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(interactives)) {
      dot.classList.remove('hovering');
      ring.classList.remove('hovering');
    }
  });
  document.addEventListener('mousedown', () => { dot.classList.add('clicking'); ring.classList.add('clicking'); });
  document.addEventListener('mouseup', () => { dot.classList.remove('clicking'); ring.classList.remove('clicking'); });
}

/* ============ PROJECT FILTERS ============ */
function initProjectFilters() {
  const filterContainer = $('#projectFilters');
  const projectsList = $('#projectsList');
  if (!filterContainer || !projectsList) return;
  const buttons = $$('.pf-btn', filterContainer);
  const projects = $$('.project', projectsList);
  const parts = '.project-head-row, .project-desc, .project-cover, .pdf-cover, .project-facts, .project-toolpills, .project-actions';

  const matches = (proj, filter) => {
    if (filter === 'all') return true;
    const cats = (proj.getAttribute('data-category') || '').toLowerCase().split(/\s+/);
    return cats.indexOf(filter) !== -1;
  };

  /* The GSAP reveal leaves inline opacity/visibility on the project and its
     children. Clear it, otherwise a project filtered back in stays invisible. */
  const resetInline = el => {
    el.style.opacity = '';
    el.style.visibility = '';
    el.style.transform = '';
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      projects.forEach(proj => {
        if (matches(proj, filter)) {
          proj.classList.remove('hidden');
          resetInline(proj);
          $$(parts, proj).forEach(resetInline);
        } else {
          proj.classList.add('hidden');
        }
      });
      if (hasST) {
        try { ScrollTrigger.refresh(); } catch (e) { /* hidden triggers can fail a refresh */ }
      }
    });
  });
}

/* ============ SMOOTH ANCHOR SCROLL ============ */
const canSmoothScroll = 'scrollBehavior' in document.documentElement.style;
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    if (a.closest('.nav-links')) closeMobileMenu();
    const scroll = () => {
      const nav = $('.nav');
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      const y = target.getBoundingClientRect().top + window.scrollY - navH - 14;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: Math.max(0, y),
        behavior: reduce || !canSmoothScroll ? 'auto' : 'smooth'
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(scroll));
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

/* ============ PROJECT OVERVIEW MODAL ============ */
const ovModal   = $('#ovModal');
const ovTitle   = $('#ovTitle');
const ovContent = $('#ovContent');
const ovTools   = $('#ovTools');
const ovClose   = $('#ovClose');
let ovLastFocused = null;

function openOverview(article) {
  if (!ovModal || !article) return;
  const title = $('.project-title', article);
  const pills = $('.project-toolpills', article);
  const body  = $('.project-overview', article);
  if (!body) return;
  ovLastFocused = document.activeElement;
  ovTitle.textContent = title ? title.textContent : 'Project Overview';
  ovTools.innerHTML = pills ? pills.innerHTML : '';
  ovContent.innerHTML = body.innerHTML;
  ovModal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  if (ovClose) ovClose.focus();
}
function closeOverview() {
  if (!ovModal) return;
  ovModal.classList.remove('is-open');
  if (ovContent) ovContent.innerHTML = '';
  document.body.style.overflow = '';
  if (ovLastFocused && ovLastFocused.focus) ovLastFocused.focus();
}
$$('[data-ov]').forEach(btn => {
  btn.addEventListener('click', () => openOverview(btn.closest('.project')));
});
if (ovClose) ovClose.addEventListener('click', closeOverview);
if (ovModal) ovModal.addEventListener('click', e => { if (e.target === ovModal) closeOverview(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ovModal && ovModal.classList.contains('is-open')) closeOverview();
});

/* ============ WORKFLOW SCROLL TRACKING ============ */
function initWorkflow() {
  const progress = $('#workflowProgress');
  const list = $('#workflowList');
  if (!progress || !list) return;
  const steps = Array.from(list.querySelectorAll('.wf-step'));
  if (!steps.length) return;
  const total = steps.length;
  let listTop = 0;
  let listH = 0;
  let raf = 0;

  const measure = () => {
    const r = list.getBoundingClientRect();
    listTop = r.top + (window.scrollY || window.pageYOffset || 0);
    listH = r.height;
  };

  const update = () => {
    raf = 0;
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const vh = window.innerHeight;
    const start = listTop - vh * 0.72;
    const end = listTop + listH - vh * 0.38;
    let p = (scrollTop - start) / Math.max(1, end - start);
    p = Math.max(0, Math.min(1, p));
    const pct = (p * 100).toFixed(1) + '%';
    progress.style.setProperty('--wf-progress', pct);
    progress.style.width = pct;
    const active = p <= 0 ? -1 : Math.min(total - 1, Math.floor(p * total));
    steps.forEach((step, i) => {
      step.classList.toggle('is-active', i <= active);
      step.classList.toggle('is-current', i === active && p > 0);
    });
    list.classList.toggle('is-complete', p >= 0.995);
  };

  const requestUpdate = () => {
    if (!raf) raf = window.requestAnimationFrame(update);
  };

  measure();
  update();
  window.addEventListener('resize', () => { measure(); requestUpdate(); }, { passive: true });
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('load', () => { measure(); requestUpdate(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { measure(); requestUpdate(); });
  }
}

/* ============ SCROLL REVEALS ============ */
function initReveals() {
  if (!hasGsap || !hasST) return;
  const dur = isReduced ? 0.01 : 0.7;
  const canAnimate = el => !!el && el.getClientRects().length > 0;

  $$('[data-reveal="up"]').forEach(el => {
    if (el.closest('.hero') || el.closest('.intro')) return;
    if (el.matches('.tool-card, .skill-card, .contact-card, .project')) return;
    if (!canAnimate(el)) return;
    gsap.fromTo(el,
      { y: 25, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: dur, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      }
    );
  });

  const skillCards = $$('.skill-card');
  if (skillCards.length && canAnimate($('#skills'))) {
    gsap.fromTo(skillCards,
      { y: 20, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: '#skills', start: 'top 75%', once: true }
      }
    );
  }

  const toolCards = $$('.tool-card');
  if (toolCards.length && canAnimate($('#tools'))) {
    gsap.fromTo(toolCards,
      { y: 22, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: '#tools', start: 'top 75%', once: true }
      }
    );
  }

  const trainingTools = $$('.training-tool');
  if (trainingTools.length && canAnimate($('#training'))) {
    gsap.fromTo(trainingTools,
      { y: 18, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power3.out',
        scrollTrigger: { trigger: '#training', start: 'top 80%', once: true }
      }
    );
  }

  $$('.project').forEach(proj => {
    if (!canAnimate(proj)) return;
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
  if (tlItems.length && canAnimate($('.timeline'))) {
    gsap.fromTo(tlItems,
      { x: -20, autoAlpha: 0 },
      {
        x: 0, autoAlpha: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: '.timeline', start: 'top 80%', once: true }
      }
    );
  }

  const contactCards = $$('.contact-card');
  if (contactCards.length && canAnimate($('#contact'))) {
    gsap.fromTo(contactCards,
      { y: 20, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: '#contact', start: 'top 78%', once: true }
      }
    );
  }

  const statCards = $$('.stat-card');
  if (statCards.length && canAnimate($('#stats'))) {
    gsap.fromTo(statCards,
      { y: 20, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: '#stats', start: 'top 85%', once: true }
      }
    );
  }

  const testimonial = $('.testimonial-card');
  if (canAnimate(testimonial)) {
    gsap.fromTo(testimonial,
      { y: 25, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: '#testimonial', start: 'top 80%', once: true }
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
  if (el) el.textContent = `Â© ${new Date().getFullYear()} T. Avineshwar`;
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

/* ============ CURSOR GLOW ON TOOL CARDS ============ */
function initCursorGlow() {
  $$('.tool-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
}

/* ============ CARD TILT ============ */
function initCardTilt() {
  if (isCoarse) return;
  $$('.tool-card, .skill-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-3px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

/* ============ PARALLAX PHOTO ============ */
function initParallaxPhoto() {
  if (isCoarse) return;
  const photoFrame = $('#heroPhoto');
  if (!photoFrame) return;
  document.addEventListener('mousemove', e => {
    const x = (e.clientX / window.innerWidth - 0.5) * 12;
    const y = (e.clientY / window.innerHeight - 0.5) * 12;
    photoFrame.style.transform = `translate(${x}px, ${y}px)`;
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
  initCursorGlow();
  initDarkMode();
  initScrollProgress();
  initRoleSwitcher();
  initStatsCounter();
  initCustomCursor();
  initProjectFilters();
  initCardTilt();
  initParallaxPhoto();
  onScroll();

  if (hasST) {
    window.addEventListener('load', () => ScrollTrigger.refresh());
    setTimeout(() => ScrollTrigger.refresh(), 800);
  }

  /* Failsafe: guarantee nothing is left hidden */
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

