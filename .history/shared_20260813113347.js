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
  initLogoCursorEgg();

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
    const href = l.id ? `/launch.html?id=${encodeURIComponent(l.id)}` : '/launches.html';
    return `
      <a class="nav-launch-item" href="${href}">
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
    const url = `${LAUNCH_SB_URL}/rest/v1/launches?select=id,name,status,date,image&published=eq.true&date=gte.${encodeURIComponent(nowIso)}&order=date.asc&limit=${NAV_LAUNCHES_LIMIT}`;
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

function initLogoCursorEgg() {
  const logoLink = document.querySelector('.nav-logo-link');
  if (!logoLink) return;

  const HOVER_STREAK_TARGET = 3;
  const STREAK_WINDOW_MS = 2500; // must re-hover within this gap to count as "in a row"
  const EGG_DURATION_MS = 6000;  // how long the custom cursor stays active

  let hoverStreak = 0;
  let streakResetTimer = null;
  let eggEndTimer = null;

  function resetStreak() {
    hoverStreak = 0;
  }

  function activateEgg() {
    document.documentElement.classList.add('isa-cursor-egg');
    clearTimeout(eggEndTimer);
    eggEndTimer = setTimeout(() => {
      document.documentElement.classList.remove('isa-cursor-egg');
    }, EGG_DURATION_MS);
  }

  logoLink.addEventListener('mouseenter', () => {
    hoverStreak += 1;
    clearTimeout(streakResetTimer);
    streakResetTimer = setTimeout(resetStreak, STREAK_WINDOW_MS);

    if (hoverStreak >= HOVER_STREAK_TARGET) {
      activateEgg();
      hoverStreak = 0;
    }
  });
}

const DISCORD_STATS_FALLBACK = {
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

// --- Hero title pinning (launch / project / news-post detail pages) ---
// Used on pages with a `.launch-hero.has-image` block where the photo can
// be taller than the viewport. While the image still has room below the
// current scroll position, the title block is pinned to the bottom of the
// screen (position: fixed) so it's visible without scrolling. Once the
// bottom of the image scrolls up to meet that position, the pin is
// released and the block settles in its normal spot, flush with the
// bottom of the image.
(function initHeroPin() {
  let hero = null, inner = null, img = null;
  let ticking = false;

  function find() {
    hero = document.querySelector('.launch-hero.has-image');
    inner = hero && hero.querySelector('.launch-hero-inner');
    img = hero && hero.querySelector('.launch-hero-bg-img');
    return !!(hero && inner && img);
  }

  function update() {
    ticking = false;
    if (!hero || !document.body.contains(hero)) { if (!find()) return; }
    const rect = hero.getBoundingClientRect();
    const pin = rect.bottom > window.innerHeight;
    inner.classList.toggle('is-pinned', pin);
  }

  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function start() {
    if (!find()) return;
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    if (img.complete) update();
    img.addEventListener('load', update);
  }

  // The hero image src is set asynchronously after a data fetch on these
  // pages, so watch for the `has-image` class (and the whole subtree, in
  // case the hero markup itself gets rendered later) rather than relying
  // on DOMContentLoaded alone.
  const mo = new MutationObserver(() => { if (!hero) start(); else update(); });
  mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'src'] });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

// --- isaCard(): console-driven shareable badge generator -----------------
// From the devtools console, on a launch, project, or news page, just type:
//   isaCard()
// The title, status, and any custom tags are read straight off the page
// (whatever is already rendered there) and a PNG badge is downloaded
// immediately. Pass a truthy argument to also stamp the ISA logo:
//   isaCard(true)
(function initIsaCard() {
  const STATUS_STYLES = {
    scheduled:      { fg: '#22c55e', bg: 'rgba(34,197,94,0.14)',   label: 'Scheduled' },
    upcoming:       { fg: '#3b82f6', bg: 'rgba(59,130,246,0.14)',  label: 'Upcoming' },
    delayed:        { fg: '#fbbf24', bg: 'rgba(251,191,36,0.14)',  label: 'Delayed' },
    'in-progress':  { fg: '#fbbf24', bg: 'rgba(251,191,36,0.16)',  label: 'In Progress' },
    'in progress':  { fg: '#fbbf24', bg: 'rgba(251,191,36,0.16)',  label: 'In Progress' },
    active:         { fg: '#22c55e', bg: 'rgba(34,197,94,0.14)',   label: 'Active' },
    'in development': { fg: '#fbbf24', bg: 'rgba(251,191,36,0.14)', label: 'In Development' },
    completed:      { fg: '#9a9a9a', bg: 'rgba(136,136,136,0.14)', label: 'Completed' },
    inactive:       { fg: '#9a9a9a', bg: 'rgba(136,136,136,0.14)', label: 'Inactive' },
    scrubbed:       { fg: '#e05555', bg: 'rgba(224,85,85,0.14)',   label: 'Scrubbed' },
  };

  // Badge pills that show a live countdown (e.g. "T-05:12:33") swap their
  // text content every second, so the status name has to be recovered from
  // the CSS class instead of the visible text in that case.
  const STATUS_CLASS_LABELS = {
    'launch-status-scheduled': 'Scheduled',
    'launch-status-upcoming': 'Upcoming',
    'launch-status-delayed': 'Delayed',
    'launch-status-in-progress': 'In Progress',
    'launch-status-completed': 'Completed',
    'launch-status-scrubbed': 'Scrubbed',
  };

  function statusStyle(raw) {
    const key = String(raw || '').trim().toLowerCase();
    if (STATUS_STYLES[key]) return STATUS_STYLES[key];
    const label = String(raw || 'Status').trim().replace(/\b\w/g, c => c.toUpperCase()) || 'Status';
    return { fg: '#3b82f6', bg: 'rgba(59,130,246,0.14)', label };
  }

  function readStatusFromBadge(el) {
    if (!el) return null;
    const text = el.textContent.trim();
    if (text && !/^T[+-]/.test(text)) return text;
    for (const cls of el.classList) {
      if (STATUS_CLASS_LABELS[cls]) return STATUS_CLASS_LABELS[cls];
    }
    return text || null;
  }

  function textOf(el) {
    return el ? el.textContent.trim() : '';
  }

  function tagsFrom(scope) {
    if (!scope) return [];
    // Try to find tags from .isa-tag elements or data-tags attribute
    const tagEls = Array.from(scope.querySelectorAll('.isa-tag, [data-isa-tag]'));
    if (tagEls.length) {
      return tagEls.map(t => t.textContent.trim() || t.getAttribute('data-isa-tag')).filter(Boolean);
    }
    // Fallback: check for data-tags attribute
    const dataTags = scope.getAttribute('data-tags');
    if (dataTags) {
      try {
        const parsed = JSON.parse(dataTags);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch { return []; }
    }
    return [];
  }

  // Looks at the current page and pulls whichever launch / project / news
  // item is already on screen — a detail page's single item, or the first
  // card on a list page — so nothing has to be typed by hand.
  function detectPageContent() {
    // Launch detail page
    const launchTitle = document.getElementById('launch-detail-title');
    if (launchTitle && textOf(launchTitle)) {
      const meta = document.getElementById('launch-detail-meta');
      return {
        title: textOf(launchTitle),
        status: readStatusFromBadge(meta && meta.querySelector('.launch-status')) || 'Upcoming',
        tags: tagsFrom(meta),
      };
    }

    // Project detail page
    const projectTitle = document.getElementById('project-title');
    if (projectTitle && textOf(projectTitle)) {
      const meta = document.getElementById('project-meta');
      const projectTags = document.getElementById('project-tags');
      return {
        title: textOf(projectTitle),
        status: textOf(meta && meta.querySelector('.mission-status')) || 'Active',
        tags: tagsFrom(projectTags) || tagsFrom(meta) || [],
      };
    }

    // News post detail page (no separate status concept — first tag doubles as one)
    const newsTitle = document.getElementById('news-detail-title');
    if (newsTitle && textOf(newsTitle)) {
      const meta = document.getElementById('news-detail-meta');
      const tags = tagsFrom(meta);
      return { title: textOf(newsTitle), status: tags[0] || 'News', tags: tags.slice(1) };
    }

    // Launches list page — use the top (soonest) card
    const launchCard = document.querySelector('#launches-list .launch-card');
    if (launchCard) {
      return {
        title: textOf(launchCard.querySelector('.launch-title')),
        status: readStatusFromBadge(launchCard.querySelector('.launch-status')) || 'Upcoming',
        tags: tagsFrom(launchCard),
      };
    }

    // Projects list page — use the first mission card
    const missionCard = document.querySelector('#missions-list .mission-card');
    if (missionCard) {
      return {
        title: textOf(missionCard.querySelector('.mission-title')),
        status: textOf(missionCard.querySelector('.mission-status')) || 'Active',
        tags: tagsFrom(missionCard),
      };
    }

    // News list page — featured post first, else the first grid card
    const newsCard = document.querySelector('.news-featured') || document.querySelector('#news-grid .news-card');
    if (newsCard) {
      const tags = tagsFrom(newsCard);
      return {
        title: textOf(newsCard.querySelector('h2, h3')),
        status: tags[0] || 'News',
        tags: tags.slice(1),
      };
    }

    return null;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function loadLogo() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/ISSSSSSSAAAA.png';
    });
  }

  function loadBackgroundImage() {
    return new Promise((resolve) => {
      // Try to load the hero/mission background image
      const heroImg = document.querySelector('.launch-hero-bg-img');
      const missionImg = document.querySelector('.mission-cover-img');
      const newsImg = document.querySelector('.news-featured-img, .news-card img');
      const imgEl = heroImg || missionImg || newsImg;
      
      if (!imgEl || !imgEl.src) {
        resolve(null);
        return;
      }
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = imgEl.src;
    });
  }

  function wrapText(ctx, text, maxWidth, maxLines, force) {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines) {
          if (!force) return null;
          break;
        }
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines) {
      if (line) lines.push(line);
    } else if (force && line) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/…$/, '') + '…';
    }
    if (!force && line && lines[lines.length - 1] !== line && ctx.measureText(line).width > maxWidth) return null;
    return lines;
  }

  function fitTitle(ctx, text, maxWidth, maxLines) {
    let size = 72;
    const minSize = 34;
    while (size >= minSize) {
      ctx.font = `800 ${size}px Inter, sans-serif`;
      const lines = wrapText(ctx, text, maxWidth, maxLines, false);
      if (lines) return { size, lines };
      size -= 4;
    }
    ctx.font = `800 ${minSize}px Inter, sans-serif`;
    return { size: minSize, lines: wrapText(ctx, text, maxWidth, maxLines, true) };
  }

  function slug(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'card';
  }

  async function ensureFontsReady() {
    if (!document.fonts) return;
    try {
      await Promise.all([
        document.fonts.load('800 72px Inter'),
        document.fonts.load('700 22px Inter'),
        document.fonts.load('600 15px Inter'),
        document.fonts.load('700 20px Inter'),
      ]);
      await document.fonts.ready;
    } catch (e) { /* fall back to default sans-serif */ }
  }

  async function isaCard(withLogo) {
    const info = detectPageContent();
    if (!info || !info.title) {
      console.warn(
        '%cISA%c isaCard(): no launch, project, or news item found on this page. Open a launch, project, or news page and try again.',
        'color:#3b82f6;font-weight:800;', 'color:#888888;'
      );
      return;
    }

    await ensureFontsReady();

    const st = statusStyle(info.status);
    const heading = String(info.title).trim() || 'ISA Mission';
    const tags = (info.tags || []).filter(Boolean);

    const W = 1200, H = 630, SCALE = 2, PAD = 64;
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // Load background image
    const bgImg = await loadBackgroundImage();
    const logo = withLogo ? await loadLogo() : null;

    // base background (dark fallback)
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0d0d0d');
    bgGrad.addColorStop(1, '#141414');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Apply background image if available - bright & saturated like on site
    if (bgImg) {
      const scale = Math.max(W / bgImg.width, H / bgImg.height);
      const x = (W - bgImg.width * scale) / 2;
      const y = (H - bgImg.height * scale) / 2;
      ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
      // Simulate CSS filter: saturate(1.15) brightness(1.12) by drawing a lighter overlay
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, W, H);
    }

    // Overlay gradient: light at top, dark at bottom (like on site)
    const overlayGrad = ctx.createLinearGradient(0, 0, 0, H);
    overlayGrad.addColorStop(0, 'rgba(10,10,10,0.05)');
    overlayGrad.addColorStop(0.55, 'rgba(10,10,10,0.15)');
    overlayGrad.addColorStop(1, 'rgba(10,10,10,0.9)');
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, W, H);

    // border frame
    roundRect(ctx, 1, 1, W - 2, H - 2, 28);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw logo if present
    if (logo) {
      const logoSize = 56;
      ctx.drawImage(logo, PAD, PAD, logoSize, logoSize);
    }

    // Content positioned at BOTTOM like site hero-inner
    const contentBottomPadding = 40;
    let contentTop = H - contentBottomPadding;

    // Calculate space needed for content (working backwards from bottom)
    ctx.font = '700 22px Inter, sans-serif';
    const pillLabel = st.label.toUpperCase();
    const pillPadX = 20;
    const pillW = ctx.measureText(pillLabel).width + pillPadX * 2;
    const pillH = 42;

    // Estimate title height
    const { size, lines } = fitTitle(ctx, heading, W - PAD * 2, 2);
    const lineHeight = size * 1.14;
    const titleHeight = size + (lines.length - 1) * lineHeight;
    
    // Calculate tags height if present (SMALLER TAGS)
    let tagsHeight = 0;
    if (tags.length) {
      tagsHeight = 28 + 8; // smaller tag height + spacing
    }

    // Position content from bottom: padding -> url -> tags -> title -> pill
    const urlTop = contentTop - 18;
    const tagsTop = urlTop - tagsHeight - 16;
    const titleTop = tagsTop - titleHeight - 32;
    const pillTop = titleTop - pillH - 16;

    // status pill
    ctx.font = '700 22px Inter, sans-serif';
    ctx.fillStyle = st.bg;
    roundRect(ctx, PAD, pillTop, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = st.fg;
    ctx.textBaseline = 'middle';
    ctx.fillText(pillLabel, PAD + pillPadX, pillTop + pillH / 2 + 1);

    // title (bright white)
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => {
      ctx.font = `800 ${size}px Inter, sans-serif`;
      ctx.fillText(line, PAD, titleTop + size + i * lineHeight);
    });

    // custom tags - SMALLER VERSION
    if (tags.length) {
      let tx = PAD;
      ctx.font = '600 16px Inter, sans-serif';
      ctx.textBaseline = 'middle';
      const tagPadX = 12, tagH = 28;
      tags.forEach((tag) => {
        const label = tag;
        const w = ctx.measureText(label).width + tagPadX * 2;
        if (tx + w > W - PAD) {
          return; // stop if doesn't fit
        }
        roundRect(ctx, tx, tagsTop, w, tagH, tagH / 2);
        ctx.fillStyle = 'rgba(45,212,191,0.14)';
        ctx.fill();
        ctx.fillStyle = '#2dd4bf';
        ctx.fillText(label, tx + tagPadX, tagsTop + tagH / 2 + 1);
        tx += w + 6;
      });
      ctx.textBaseline = 'alphabetic';
    }

    // footer URL - RIGHT ALIGNED or under logo
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = '#888888';
    
    if (logo) {
      // Under logo
      ctx.textAlign = 'left';
      ctx.fillText('https://isa-aerospace.vercel.app/', PAD, PAD + 88);
    } else {
      // Right bottom corner
      ctx.textAlign = 'right';
      ctx.fillText('https://isa-aerospace.vercel.app/', W - PAD, urlTop);
    }
    ctx.textAlign = 'left';

    canvas.toBlob((blob) => {
      if (!blob) { console.error('isaCard: could not render image'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `isa-${slug(st.label)}-${slug(heading)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  }

  window.isaCard = isaCard;

  console.log(
    '%cISA%c badge generator ready — on a launch, project, or news page, run: isaCard()  ·  add true to also stamp the logo: isaCard(true)',
    'color:#3b82f6;font-weight:800;font-size:12px;',
    'color:#888888;font-size:12px;'
  );
})();
