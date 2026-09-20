/* ============================================================
   ui/Taunts.js — v2.15
   Inline tray (mirrors .emote-sheet layout). No modal.
   · Same positioning/styling as emote tray via shared class.
   · Tap a taunt → fires + closes tray + bubble pops over avatar.
   · Mutually exclusive with emote tray.
   ============================================================ */
const Taunts = {
  PRESETS: [
    'gg', 'ez', 'skill issue', 'pain', 'cooked',
    'nice try', 'sit down', 'ratio', 'no way', 'run it back',
    '🧠', '🥱', '💀', '🔥', '😎', '🤡'
  ],

  _wired: false,

  _css() {
    return `
      /* Only overrides — layout comes from .emote-sheet */
      .emote-sheet.taunt-tray {
        display: none !important;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 6px;
        max-width: calc(100vw - 24px);
        padding: 8px 10px;
      }
      .emote-sheet.taunt-tray.on {
        display: flex !important;
      }

      .taunt-tray-btn {
        flex: 0 0 auto;
        padding: 7px 12px;
        background: var(--bg-surface-2);
        border: 1px solid var(--border);
        border-radius: 999px;
        color: var(--text-primary);
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
        line-height: 1.1;
        transition: background .12s, border-color .12s, transform .1s;
      }
      .taunt-tray-btn:hover {
        background: var(--bg-surface-3);
        border-color: var(--accent);
      }
      .taunt-tray-btn:active { transform: scale(.94); }
      .taunt-tray-btn.emoji-only {
        font-size: 18px;
        padding: 6px 10px;
        line-height: 1;
      }

      .taunt-bubble {
        position: fixed;
        z-index: 9700;
        background: var(--accent);
        color: #fff;
        padding: 10px 16px;
        border-radius: 18px;
        font-weight: 900;
        font-size: 14px;
        box-shadow: 0 12px 30px -8px rgba(0,0,0,.7), 0 4px 14px -2px var(--accent);
        pointer-events: none;
        max-width: 240px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0;
        transform: translateY(8px) scale(.85);
        transition: opacity .2s ease, transform .28s cubic-bezier(.2,.9,.3,1.4);
        font-family: var(--font);
      }
      .taunt-bubble::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -6px;
        transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-top: 7px solid var(--accent);
      }
      .taunt-bubble.in { opacity: 1; transform: translateY(0) scale(1); }
      .taunt-bubble.out {
        opacity: 0;
        transform: translateY(-10px) scale(.9);
        transition: opacity .3s ease, transform .3s ease;
      }
    `;
  },

  mount() {
    if (this._wired) return;
    this._wired = true;
    console.log('[Taunts] mount()');

    if (!document.getElementById('tauntStyles')) {
      const st = document.createElement('style');
      st.id = 'tauntStyles';
      st.textContent = this._css();
      document.head.appendChild(st);
    }

    this._populateTray();
    this._wireButton();
    this._wireOutsideClose();

    if (typeof Net !== 'undefined' && Net.on) {
      Net.on('taunt', msg => {
        const s = (typeof ArenaView !== 'undefined') ? ArenaView.state : null;
        if (!s || !msg.from) return;
        const idx = s.players.findIndex(p => p.id === msg.from);
        if (idx === -1 || idx === ArenaView._localIdx) return;
        this._show(msg.text, idx);
      });
    }
  },

  _populateTray() {
    const tray = document.getElementById('tauntTray');
    if (!tray) {
      console.warn('[Taunts] #tauntTray missing — retrying in 300ms');
      setTimeout(() => this._populateTray(), 300);
      return;
    }
    if (tray.dataset.populated === '1') return;
    tray.dataset.populated = '1';

    this.PRESETS.forEach(txt => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'taunt-tray-btn';
      // Emoji-only taunts get a slightly bigger glyph
      if (/^\p{Emoji}/u.test(txt) && txt.length <= 2) b.classList.add('emoji-only');
      b.textContent = txt;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.send(txt);
        this.close();
      });
      tray.appendChild(b);
    });
    console.log('[Taunts] tray populated with', this.PRESETS.length, 'taunts');
  },

  _wireButton() {
    const btn = document.getElementById('btnTaunt');
    if (!btn) { setTimeout(() => this._wireButton(), 300); return; }
    if (btn.dataset.tauntWired === '1') return;
    btn.dataset.tauntWired = '1';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
      if (typeof Haptics !== 'undefined' && Haptics.tap) Haptics.tap();
      this.toggle();
    });

    // Mutual exclusion: emote button closes taunt tray
    const emoteBtn = document.getElementById('btnEmote');
    if (emoteBtn) {
      emoteBtn.addEventListener('click', () => this.close());
    }
  },

  _wireOutsideClose() {
    document.addEventListener('click', (e) => {
      const tray = document.getElementById('tauntTray');
      if (!tray || !tray.classList.contains('on')) return;
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#tauntTray')) return;
      if (t.closest('#btnTaunt')) return;
      this.close();
    });
  },

  toggle() {
    const tray = document.getElementById('tauntTray');
    if (!tray) return;
    if (tray.classList.contains('on')) this.close();
    else this.open();
  },

  open() {
    const tray = document.getElementById('tauntTray');
    if (!tray) return;
    // Close the emote tray if it's open — mutually exclusive
    const emoteTray = document.getElementById('emoteTray');
    if (emoteTray) emoteTray.classList.remove('on');
    if (typeof ArenaView !== 'undefined') ArenaView._emoteOpen = false;

    tray.classList.add('on');
  },

  close() {
    const tray = document.getElementById('tauntTray');
    if (tray) tray.classList.remove('on');
  },

  send(text) {
    if (!text) return;
    if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
    if (typeof Haptics !== 'undefined' && Haptics.tap) Haptics.tap();
    if (typeof ArenaView !== 'undefined' && ArenaView.state) {
      this._show(text, ArenaView._localIdx);
    }
    if (typeof Net !== 'undefined' && Net.active) Net.sendTaunt(text);
  },

  _show(text, playerIdx) {
    if (typeof ArenaView === 'undefined' || !ArenaView.state) return;
    const anchor = this._anchorFor(playerIdx);
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const bubble = document.createElement('div');
    bubble.className = 'taunt-bubble';
    bubble.textContent = text;
    document.body.appendChild(bubble);

    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - bw - 8,
      rect.left + rect.width / 2 - bw / 2));
    const y = Math.max(8, rect.top - bh - 12);
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';

    requestAnimationFrame(() => bubble.classList.add('in'));

    setTimeout(() => {
      bubble.classList.add('out');
      setTimeout(() => bubble.remove(), 320);
    }, 1700);
  },

  _anchorFor(playerIdx) {
    const s = ArenaView.state;
    if (!s) return null;

    if (playerIdx === ArenaView._localIdx) {
      return document.getElementById('myCount')
          || document.querySelector('.hand-meta')
          || document.querySelector('.hand-area');
    }

    const opps = document.querySelectorAll('#opponents .opp');
    for (const el of opps) {
      if (el.dataset.playerIdx === String(playerIdx)) {
        return el.querySelector('.opp-av') || el;
      }
    }

    const arr = Array.from(opps);
    let n = 0;
    for (let i = 0; i < s.players.length; i++) {
      if (i === ArenaView._localIdx) continue;
      if (i === playerIdx) {
        const el = arr[n];
        return el ? (el.querySelector('.opp-av') || el) : null;
      }
      n++;
    }
    return null;
  }
};

/* ── Self-mount (idempotent) ── */
(function selfMount() {
  const go = () => {
    try { Taunts.mount(); }
    catch (e) { console.error('[Taunts] self-mount error', e); }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go, { once: true });
  } else {
    setTimeout(go, 0);
  }
})();