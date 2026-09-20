/* ============================================================
   js/core/util.js — shared pure helpers.
   MUST be loaded before every other JS file.
   ============================================================ */

/** Positive modulo: mod(-1, 4) === 3, not -1. */
function mod(n, m) { return ((n % m) + m) % m; }

/** Fisher–Yates. Mutates and returns the array. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Inclusive clamp. */
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/** Random integer [min, max] inclusive. */
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/** Escape user-controlled text before injecting into innerHTML. */
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** True if the user is currently typing into an input/textarea/contenteditable.
 *  Used to suppress keyboard shortcuts. */
function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

/** Small stable id for namespacing card UIDs across host/client. */
const SESSION_TAG = (function () {
  let t = sessionStorage.getItem('rv_tag');
  if (!t) {
    t = Math.random().toString(36).slice(2, 8);
    try { sessionStorage.setItem('rv_tag', t); } catch (e) {}
  }
  return t;
})();

/** Deep-clone a plain effects array (small, structured objects only). */
function cloneEffects(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(e => (e && typeof e === 'object') ? { ...e } : e);
}

/** Deep-clone a plain object (used for `requires`, rules). */
function cloneDeep(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cloneDeep);
  const out = {};
  for (const k of Object.keys(obj)) out[k] = cloneDeep(obj[k]);
  return out;
}