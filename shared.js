const GUILD_ID = '1507774799194099903';
const INVITE_CODE = 'CMDSKwTBnm';

async function injectInclude(placeholderId, url) {
  const placeholder = document.getElementById(placeholderId);
  if (!placeholder) return;
  try {
    const res = await fetch(url);
    placeholder.outerHTML = await res.text();
  } catch (e) {
    console.warn(`${url} failed to load`, e);
  }
}

(async function injectLayout() {
  // nav.html and footer.html are shared across every page, so both are
  // fetched and injected here before any code that depends on their
  // markup (navbar scroll state, footer links, etc.) runs.
  await Promise.all([
    injectInclude('nav-placeholder', '/nav.html'),
    injectInclude('footer-placeholder', '/footer.html'),
  ]);

  const navbar = document.getElementById('navbar');
  if (navbar) {
    function updateNavbar() {
      navbar.classList.toggle('scrolled', window.scrollY > 30);
    }
    window.addEventListener('scroll', updateNavbar, { passive: true });
    updateNavbar();
  }

  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  initNavLaunches();

  const currentPath = new URL(window.location.href).pathname.replace(/\/$/, '/index.html');
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    const targetPath = new URL(href, window.location.href).pathname.replace(/\/$/, '/index.html');
    if (targetPath === currentPath) a.classList.add('active');
  });

  // footer.html has just been injected above, so footer-link population
  // and the credit line must run here, not at top-level script scope.
  injectSocialLinks();
  injectFooterCredit();
})();

const LAUNCH_SB_URL = 'https://fqvghuvmgswegirgitom.supabase.co';
const LAUNCH_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdmdodXZtZ3N3ZWdpcmdpdG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTI4MTAsImV4cCI6MjA5NjY4ODgxMH0.7tKrak3ANnnhp4pISK2ythPdCt557vMACUhpQsqWn0s';
const NAV_LAUNCHES_LIMIT = 3;

function navEscHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function navLaunchStatusClass(s) {
  const map = { scheduled:'nav-launch-status-scheduled', upcoming:'nav-launch-status-upcoming',
                delayed:'nav-launch-status-delayed', completed:'nav-launch-status-completed', scrubbed:'nav-launch-status-scrubbed' };
  return map[s] || 'nav-launch-status-scheduled';
}

function navPad2(n) { return String(n).padStart(2, '0'); }

function navCountdownStr(dateIso) {
  if (!dateIso) return null;
  const target = new Date(dateIso).getTime();
  if (isNaN(target)) return null;
  const diffMs = target - Date.now();
  const sign = diffMs >= 0 ? 'T-' : 'T+';
  const abs = Math.abs(diffMs);
  const totalHours = Math.floor(abs / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const secs = Math.floor((abs % 60000) / 1000);
  return `${sign}${navPad2(totalHours)}:${navPad2(mins)}:${navPad2(secs)}`;
}

function updateNavCountdowns() {
  document.querySelectorAll('[data-nav-countdown]').forEach(el => {
    const str = navCountdownStr(el.dataset.navCountdown);
    if (str) el.textContent = str;
  });
}
setInterval(updateNavCountdowns, 1000);

function renderNavLaunches(listEl, launches) {
  if (!launches.length) {
    listEl.innerHTML = '<div class="nav-launches-empty">No upcoming launches.</div>';
    return;
  }
  listEl.innerHTML = launches.map(l => {
    const date = l.date ? new Date(l.date) : null;
    const dateStr = date ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
    let timeStr = date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
    let tzStr = '';
    if (date) {
      try {
        tzStr = Intl.DateTimeFormat('en-US', { timeZoneName: 'long' }).formatToParts(date)
          .find(p => p.type === 'timeZoneName')?.value || '';
      } catch { tzStr = ''; }
    }
    const glyph = l.image
      ? `<span class="nav-launch-glyph nav-launch-glyph-img" style="background-image:url('${navEscHtml(l.image)}')"></span>`
      : `<span class="nav-launch-glyph">🚀</span>`;
    const cd = (l.status === 'scheduled' || l.status === 'upcoming') ? navCountdownStr(l.date) : null;
    return `
      <a class="nav-launch-item" href="/launches.html">
        ${glyph}
        <span class="nav-launch-info">
          <span class="nav-launch-name">${navEscHtml(l.name || 'Unnamed Launch')}</span>
          <span class="nav-launch-date">${dateStr}${timeStr ? ` · ${timeStr}` : ''}</span>
          ${tzStr ? `<span class="nav-launch-tz">${navEscHtml(tzStr)}</span>` : ''}
        </span>
        ${cd
          ? `<span class="nav-launch-status ${navLaunchStatusClass(l.status)}" data-nav-countdown="${navEscHtml(l.date)}">${cd}</span>`
          : `<span class="nav-launch-status ${navLaunchStatusClass(l.status)}">${navEscHtml(l.status || 'scheduled')}</span>`}
      </a>`;
  }).join('');
}

async function loadNavLaunches(listEl) {
  try {
    const nowIso = new Date().toISOString();
    const url = `${LAUNCH_SB_URL}/rest/v1/launches?select=name,status,date,image&published=eq.true&date=gte.${encodeURIComponent(nowIso)}&order=date.asc&limit=${NAV_LAUNCHES_LIMIT}`;
    const res = await fetch(url, { headers: { apikey: LAUNCH_SB_KEY, Authorization: `Bearer ${LAUNCH_SB_KEY}` } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const launches = await res.json();
    renderNavLaunches(listEl, Array.isArray(launches) ? launches : []);
  } catch (e) {
    console.warn('nav launches failed to load', e);
    listEl.innerHTML = '<div class="nav-launches-empty">Unable to load launches.</div>';
  }
}

function initNavLaunches() {
  const widget  = document.getElementById('nav-launches');
  const toggle  = document.getElementById('nav-launches-toggle');
  const listEl  = document.getElementById('nav-launches-list');
  if (!widget || !toggle || !listEl) return;

  let closeTimer = null;

  function openPanel() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    widget.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    widget.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function scheduleClose() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      closeTimer = null;
      closePanel();
    }, 150);
  }

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  const panel = document.getElementById('nav-launches-panel');

  widget.addEventListener('pointerenter', () => openPanel());
  widget.addEventListener('pointerleave', scheduleClose);
  panel?.addEventListener('pointerenter', cancelClose);
  panel?.addEventListener('pointerleave', scheduleClose);
  document.addEventListener('click', (e) => {
    if (!widget.contains(e.target)) closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  loadNavLaunches(listEl);
  setInterval(() => loadNavLaunches(listEl), 300000);
}

const DISCORD_STATS_FALLBACK = {
  guild_id: GUILD_ID,
  guild_name: 'ISA- community server',
  invite_url: `https://discord.gg/${INVITE_CODE}`,
  member_count: 16,
  online_count: 8,
  icon: '08113c0188539b6cadaf1245b896bc25',
};

function formatCount(value) {
  return value != null ? value.toLocaleString() : '—';
}

function guildIconUrl(stats) {
  if (!stats.icon) return null;
  return `https://cdn.discordapp.com/icons/${GUILD_ID}/${stats.icon}.png?size=64`;
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
    const res = await fetch('/api/discord-stats');
    if (!res.ok) throw new Error(`API ${res.status}`);
    applyDiscordStats(await res.json());
  } catch {
    applyDiscordStats(DISCORD_STATS_FALLBACK);
  }
}

const ISA_SOCIAL = {
  tiktok: 'https://www.tiktok.com/@isa.space',
  youtube: 'https://www.youtube.com/@isa-space-agency',
  source: 'https://github.com/SkillichSE/ISA-site',
};

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

function injectSocialLinks() {
  const socialItems = [
    ['TikTok', ISA_SOCIAL.tiktok],
    ['YouTube', ISA_SOCIAL.youtube],
  ];
  const footerItems = [
    ['Discord', `https://discord.gg/${INVITE_CODE}`],
    ['YouTube', ISA_SOCIAL.youtube],
    ['TikTok', ISA_SOCIAL.tiktok],
    ['Source code', ISA_SOCIAL.source],
  ];

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
}

function injectFooterCredit() {
  document.querySelectorAll('.site-footer .footer-inner').forEach((footer) => {
    if (footer.querySelector('.footer-credit')) return;
    const credit = document.createElement('div');
    credit.className = 'footer-credit';
    credit.textContent = "Build by Ski's Team";
    footer.appendChild(credit);
  });
}

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