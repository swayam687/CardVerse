/* ============================================================
   ui/Tutorial.js — first-game coach (Pulse)
   ============================================================ */
const Tutorial = {
  active: false,
  _index: 0,
  _steps: [],
  _overlay: null,

  shouldRun() {
    try { return localStorage.getItem('rv_tutorial_done') !== '1'; }
    catch(e) { return true; }
  },
  complete() {
    try { localStorage.setItem('rv_tutorial_done', '1'); } catch(e){}
    this.active = false;
    this._hide();
  },

  start() {
    if (!this.shouldRun()) return;
    this.active = true;
    this._index = 0;
    this._steps = [
      { target: '#discardPile', title: 'Match the top card', body: 'Play a card that matches the color OR the number.' },
      { target: '#hand',        title: 'Your hand',         body: 'Tap a glowing card to play it.' },
      { target: '#btnDraw',     title: 'No playable card?', body: 'Tap DRAW, then either play what you got or PASS.' },
      { target: '#opponents',   title: 'Watch your rivals', body: 'Hit them with a +2 or a SKIP.' }
    ];
    setTimeout(() => this._show(), 400);
  },

  next() {
    this._index++;
    if (this._index >= this._steps.length) { this.complete(); return; }
    this._show();
  },

  _hide() { if (this._overlay) { this._overlay.remove(); this._overlay = null; } },

  _show() {
    this._hide();
    if (!this.active) return;
    const step = this._steps[this._index];
    if (!step) { this.complete(); return; }
    const target = document.querySelector(step.target);
    if (!target) { this.next(); return; }
    const rect = target.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:15000;pointer-events:none;';

    const cardTop = Math.min(window.innerHeight - 220, rect.bottom + 16);
    const cardLeft = Math.max(12, Math.min(window.innerWidth - 300, rect.left + rect.width / 2 - 140));

    overlay.innerHTML = `
      <div style="
        position:absolute;
        top:${Math.max(6, rect.top - 6)}px;
        left:${Math.max(6, rect.left - 6)}px;
        width:${rect.width + 12}px;
        height:${rect.height + 12}px;
        border-radius:16px;
        box-shadow: 0 0 0 9999px rgba(4,4,10,.72), 0 0 40px -4px var(--accent);
        pointer-events:none;
      "></div>
      <div style="
        position:absolute;
        top:${cardTop}px; left:${cardLeft}px;
        width:min(300px, calc(100vw - 24px));
        background:var(--bg-elevated);
        border:1px solid var(--accent);
        border-radius:16px;
        padding:16px;
        box-shadow:var(--sh-lg);
        pointer-events:auto;
      ">
        <div style="font-size:9.5px;font-weight:900;letter-spacing:2px;color:var(--accent);margin-bottom:4px">STEP ${this._index + 1} / ${this._steps.length}</div>
        <div style="font-size:15px;font-weight:900;margin-bottom:4px">${step.title}</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;font-weight:700">${step.body}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn ghost sm" id="tutSkip">Skip</button>
          <button class="btn primary sm" id="tutNext">${this._index === this._steps.length - 1 ? 'Finish' : 'Next →'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;
    overlay.querySelector('#tutNext').onclick = () => { Sound.click(); this.next(); };
    overlay.querySelector('#tutSkip').onclick = () => { Sound.click(); this.complete(); };
  }
};