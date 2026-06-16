/* =============================================
   ISA — Markdown helpers (shared by admin + public pages)
   Requires marked.js + DOMPurify to be loaded first.
   ============================================= */

function escHtmlMd(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Full markdown -> sanitized HTML (used for modal / detail views)
function mdToHtml(text) {
  if (!text) return '';
  try {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      const raw = marked.parse(String(text), { breaks: true, gfm: true });
      return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: ['p','br','strong','em','b','i','a','ul','ol','li','blockquote','code','pre','h1','h2','h3','h4','hr','img','del','table','thead','tbody','tr','th','td'],
        ALLOWED_ATTR: ['href','target','rel','src','alt','title']
      });
    }
  } catch (e) {
    console.error('Markdown render failed:', e);
  }
  // Fallback if libs failed to load: escape + preserve line breaks
  return escHtmlMd(text).replace(/\n/g, '<br>');
}

// Markdown -> plain text, for short truncated previews (cards/lists)
function mdToPlain(text) {
  if (!text) return '';
  return String(text)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}
