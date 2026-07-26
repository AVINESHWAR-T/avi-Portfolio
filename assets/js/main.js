// =============================================
// NAVBAR SHADOW
// =============================================
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 30);
});

// =============================================
// HAMBURGER MENU
// =============================================
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');

burger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  burger.setAttribute('aria-expanded', navLinks.classList.contains('open'));
});

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  });
});

// =============================================
// SMOOTH SCROLL WITH OFFSET
// =============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const targetId = anchor.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      e.preventDefault();
      const offset = navbar.offsetHeight + 20;
      const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }
  });
});

// =============================================
// SCROLL REVEAL ANIMATIONS
// =============================================
const revealSelectors = [
  '.about-grid',
  '.skill-card',
  '.exp-card',
  '.project-card',
  '.process-step',
  '.edu-card',
  '.training-card',
  '.roadmap-card',
  '.cert-card',
  '.section-header'
];

const revealEls = document.querySelectorAll(revealSelectors.join(','));

if (window.innerWidth > 768) {
  revealEls.forEach(el => el.classList.add('reveal-up'));

  const safetyTimer = setTimeout(() => {
    revealEls.forEach(el => el.classList.add('visible'));
  }, 3000);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          clearTimeout(safetyTimer);
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -60px 0px'
    });

    revealEls.forEach(el => io.observe(el));

    setTimeout(() => {
      revealEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          el.classList.add('visible');
        }
      });
    }, 200);
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }
} else {
  revealEls.forEach(el => el.classList.add('visible'));
}

// =============================================
// ANIMATED COUNTERS
// =============================================
function animateCounter(el) {
  const target = parseInt(el.dataset.count);
  const duration = 2000;
  const start = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(easeOut * target);
    el.textContent = current + (target > 10 ? '+' : '');

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

const statNums = document.querySelectorAll('.stat-num');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

statNums.forEach(num => counterObserver.observe(num));

// =============================================
// PROCESS TIMELINE PROGRESS
// =============================================
const processProgress = document.getElementById('processProgress');
const processSection = document.querySelector('.process-section');

if (processProgress && processSection) {
  const processObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        processProgress.style.width = '100%';
        processObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  processObserver.observe(processSection);
}

// =============================================
// CARD TILT EFFECT
// =============================================
const tiltCards = document.querySelectorAll('[data-tilt]');

if (window.innerWidth > 768) {
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 55;
      const rotateY = (centerX - x) / 55;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
      setTimeout(() => {
        card.style.transform = '';
      }, 300);
    });
  });
}

// =============================================
// HERO PARALLAX ORBS
// =============================================
const orbs = document.querySelectorAll('.gradient-orb');
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  orbs.forEach((orb, i) => {
    const speed = 0.03 + (i * 0.015);
    orb.style.transform = `translateY(${scrollY * speed}px)`;
  });
});

// =============================================
// NAV LINK ACTIVE STATE
// =============================================
const sections = document.querySelectorAll('section[id]');
const navLinkEls = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - navbar.offsetHeight - 100;
    if (scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });

  navLinkEls.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {
      link.classList.add('active');
    }
  });
});