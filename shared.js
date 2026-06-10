/* =============================================
   ISA — Shared JS (all pages include this)
   ============================================= */

const GUILD_ID = '1507774799194099903';
const INVITE_CODE = 'CMDSKwTBnm';

const DISCORD_STATS_FALLBACK = {
  guild_id: GUILD_ID,
  guild_name: 'ISA- community server',
  invite_url: `https://discord.gg/${INVITE_CODE}`,
  member_count: 16,
  online_count: 8,
  icon: '08113c0188539b6cadaf1245b896bc25',
};

function discordStatsPath() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  const dirDepth = last.includes('.') ? segments.length - 1 : segments.length;
  return (dirDepth > 0 ? '../'.repeat(dirDepth) : '') + 'discord-stats.json';
}

function formatCount(value) {
  return value != null ? value.toLocaleString() : '—';
}

function guildIconUrl(stats) {
  if (!stats.icon) return null;
  return `https://cdn.discordapp.com/icons/${stats.guild_id}/${stats.icon}.png?size=128`;
}

function applyDiscordStats(stats) {
  document.querySelectorAll('.discord-member-count').forEach(el => {
    el.textContent = formatCount(stats.member_count);
  });
  document.querySelectorAll('.discord-online-count').forEach(el => {
    el.textContent = formatCount(stats.online_count);
  });
  document.querySelectorAll('.discord-guild-name').forEach(el => {
    el.textContent = stats.guild_name || 'ISA Discord';
  });
  document.querySelectorAll('.discord-stats-line').forEach(el => {
    el.textContent = `${formatCount(stats.member_count)} Members · ${formatCount(stats.online_count)} Online`;
  });

  const iconUrl = guildIconUrl(stats);
  document.querySelectorAll('.discord-guild-icon').forEach(el => {
    if (iconUrl) {
      el.src = iconUrl;
      el.alt = stats.guild_name || 'Discord server';
      el.hidden = false;
    }
  });

  document.querySelectorAll('a[data-discord-invite]').forEach(el => {
    el.href = stats.invite_url || `https://discord.gg/${INVITE_CODE}`;
  });
}

async function fetchDiscordStats() {
  try {
    const res = await fetch(discordStatsPath(), { cache: 'no-store' });
    if (!res.ok) throw new Error('stats file missing');
    applyDiscordStats(await res.json());
    return;
  } catch {
    applyDiscordStats(DISCORD_STATS_FALLBACK);
  }
}

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
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    const target = href.split('/').pop().split('#')[0] || 'index.html';
    if (target === page) a.classList.add('active');
  });
})();

// ---- SOCIAL LINKS ----
const ISA_SOCIAL = {
  tiktok: 'https://www.tiktok.com/@isaspaceagency',
  youtube: 'https://www.youtube.com/@isa-space-agency',
};

(function injectSocialLinks() {
  const items = [
    ['TikTok', ISA_SOCIAL.tiktok],
    ['YouTube', ISA_SOCIAL.youtube],
  ];

  function addLink(container, label, href, className) {
    if (container.querySelector(`a[href="${href}"]`)) return;
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    if (className) link.className = className;
    container.appendChild(link);
  }

  document.querySelectorAll('.footer-links').forEach((container) => {
    items.forEach(([label, href]) => addLink(container, label, href));
  });

  document.querySelectorAll('[data-isa-social]').forEach((container) => {
    const asButtons = container.dataset.isaSocial === 'buttons';
    items.forEach(([label, href]) => {
      addLink(container, label, href, asButtons ? 'btn-outline' : '');
    });
  });
})();

// ---- DISCORD STATS ----
fetchDiscordStats();
setInterval(fetchDiscordStats, 300000);

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
