const GUILD_ID = '1507774799194099903';
const INVITE_CODE = 'CMDSKwTBnm';

const DISCORD_STATS_FALLBACK = {
  guild_id: GUILD_ID,
  guild_name: 'ISA- community server',
  invite_url: `https:
  member_count: 16,
  online_count: 8,
  icon: '08113c0188539b6cadaf1245b896bc25',
};

function formatCount(value) {
  return value != null ? value.toLocaleString() : '—';
}

function guildIconUrl(stats) {
  if (!stats.icon) return null;
  return `https:
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
    el.href = stats.invite_url || `https:
  });
}

async function fetchDiscordStats() {
  try {
    const res = await fetch('/api/discord-stats');
    if (!res.ok) throw new Error(`API ${res.status}`);
    applyDiscordStats(await res.json());
  } catch {
    applyDiscordStats(DISCORD_STATS_FALLBACK);
  }
}

const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });
}

const burger = document.getElementById('burger');
const navLinks = document.getElementById('nav-links');
if (burger && navLinks) {
  burger.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

(function() {
  const currentPath = new URL(window.location.href).pathname.replace(/\/$/, '/index.html');
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    const targetPath = new URL(href, window.location.href).pathname.replace(/\/$/, '/index.html');
    if (targetPath === currentPath) a.classList.add('active');
  });
})();

const ISA_SOCIAL = {
  tiktok: 'https:
  youtube: 'https:
  source: 'https:
};

(function injectSocialLinks() {
  const socialItems = [
    ['TikTok', ISA_SOCIAL.tiktok],
    ['YouTube', ISA_SOCIAL.youtube],
  ];
  const footerItems = [
    ['Discord', `https:
    ['YouTube', ISA_SOCIAL.youtube],
    ['TikTok', ISA_SOCIAL.tiktok],
    ['Source code', ISA_SOCIAL.source],
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
    container.replaceChildren();
    footerItems.forEach(([label, href]) => addLink(container, label, href));
  });

  document.querySelectorAll('[data-isa-social]').forEach((container) => {
    const asButtons = container.dataset.isaSocial === 'buttons';
    socialItems.forEach(([label, href]) => {
      addLink(container, label, href, asButtons ? 'btn-outline' : '');
    });
  });
})();

(function injectFooterCredit() {
  document.querySelectorAll('.site-footer .footer-inner').forEach((footer) => {
    if (footer.querySelector('.footer-credit')) return;
    const credit = document.createElement('div');
    credit.className = 'footer-credit';
    credit.textContent = "Build by Ski's Team";
    footer.appendChild(credit);
  });
})();

fetchDiscordStats();
setInterval(fetchDiscordStats, 300000);

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

document.querySelectorAll('[data-stagger]').forEach(grid => {
  grid.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${i * 70}ms`;
  });
});