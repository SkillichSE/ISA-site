/* =============================================
   ISA — Shared JS (all pages include this)
   ============================================= */

const GUILD_ID = '1507774799194099903';

// ---- NAV SCROLL ----
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });
}

// ---- BURGER ----
const burger = document.getElementById('burger');
const navLinks = document.getElementById('nav-links');
if (burger && navLinks) {
  burger.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// ---- ACTIVE NAV LINK ----
(function() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href').replace(/\/$/, '') || '/';
    if (href === path || (path !== '/' && path !== '/index.html' && href !== '/' && href !== '/index.html' && path.startsWith(href))) {
      a.classList.add('active');
    }
  });
})();

// ---- DISCORD ONLINE COUNT ----
async function fetchDiscordOnline() {
  const els = document.querySelectorAll('.discord-online-count');
  if (!els.length) return;
  try {
    const res = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/widget.json`, { mode: 'cors' });
    if (!res.ok) throw new Error('widget disabled');
    const data = await res.json();
    const count = data.presence_count ?? data.members?.length ?? null;
    els.forEach(el => {
      el.textContent = count !== null ? count.toLocaleString() : 'some';
    });
  } catch {
    els.forEach(el => el.textContent = 'some');
  }
}
fetchDiscordOnline();
setInterval(fetchDiscordOnline, 60000);

// ---- SCROLL REVEAL ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal-target').forEach(el => {
  el.classList.add('reveal');
  observer.observe(el);
});

// stagger grids
document.querySelectorAll('[data-stagger]').forEach(grid => {
  grid.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${i * 70}ms`;
  });
});
