/* ============================================================
   ui/Modal.js — Pulse v2.9
   FIX: all pickers now correctly return the picked value.
   Bug: close() fired onClose(=finish(null)) BEFORE the pick
   callback, so picked items were treated as cancels. The card
   list for Mandarin/Orochimaru never opened because the chain
   aborted right after the player was picked.
   Now: item click suppresses onClose, closes, THEN finishes.
   ============================================================ */
const Modal = {
  _isOpen: false,
  _forceChoice: false,
  _tabHandler: null,
  _returnFocus: null,
  _closeCb: null,

  open(html, { onClose = null, forceChoice = false } = {}) {
    const bg = document.getElementById('modalBg');
    const m = document.getElementById('modal');
    if (!bg || !m) return null;

    this._returnFocus = document.activeElement;
    this._closeCb = (typeof onClose === 'function') ? onClose : null;

    m.innerHTML = html;
    bg.classList.add('on');
    this._isOpen = true;
    this._forceChoice = !!forceChoice;
    if (this._forceChoice) bg.classList.add('no-dismiss');
    else bg.classList.remove('no-dismiss');

    bg.onclick = e => {
      if (e.target !== bg) return;
      if (this._forceChoice) return;
      this.close();
    };

    const focusable = m.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();

    this._removeTabHandler();
    this._tabHandler = (e) => {
      if (e.key === 'Escape') {
        if (!this._forceChoice) this.close();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = Array.from(m.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', this._tabHandler);

    return m;
  },

  _removeTabHandler() {
    if (this._tabHandler) {
      document.removeEventListener('keydown', this._tabHandler);
      this._tabHandler = null;
    }
  },

  close() {
    if (this._forceChoice) return;

    const bg = document.getElementById('modalBg');
    if (bg) {
      bg.classList.remove('on');
      bg.classList.remove('no-dismiss');
      bg.onclick = null;
    }
    const wasOpen = this._isOpen;
    this._isOpen = false;
    this._removeTabHandler();

    if (this._returnFocus && typeof this._returnFocus.focus === 'function') {
      try { this._returnFocus.focus(); } catch (e) {}
    }
    this._returnFocus = null;

    const cb = this._closeCb;
    this._closeCb = null;
    this._forceChoice = false;

    if (wasOpen && typeof cb === 'function') {
      try { cb(); } catch (e) { console.error('[modal] close cb error', e); }
    }
  },

  /**
   * Commit a picked value:
   *  1. Suppress onClose so close() does NOT fire finish(null).
   *  2. Close the modal (cleans up state, restores focus).
   *  3. Fire finish(value) — triggers the next step of the chain.
   */
  _commit(value, finish) {
    this._closeCb = null;
    this.close();
    if (typeof Sound !== 'undefined') Sound.click();
    finish(value);
  },

  /* ── Single-callback pickers ─────────────────────────── */

  colorPick(onResult) {
    if (typeof onResult !== 'function') return;
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      onResult(val);
    };

    const m = this.open(`
      <h2>Choose a Color</h2>
      <div class="hint">Your wild card takes on this color.</div>
      <div class="color-pick">
        <button class="cp" data-c="red"><span class="cp-dot"></span>Red</button>
        <button class="cp" data-c="blue"><span class="cp-dot"></span>Blue</button>
        <button class="cp" data-c="green"><span class="cp-dot"></span>Green</button>
        <button class="cp" data-c="yellow"><span class="cp-dot"></span>Yellow</button>
      </div>
      <button class="btn ghost big" id="cpCancel"
              style="width:100%;margin-top:14px">Cancel</button>
    `, { onClose: () => finish(null) });

    if (!m) { finish(null); return; }

    m.querySelectorAll('.cp').forEach(el => {
      el.onclick = () => {
        const color = el.dataset.c;
        this._commit(color, finish);
      };
    });
    m.querySelector('#cpCancel').onclick = () => this.close();
  },

  pickPlayer(state, excludeIdx, onResult) {
    if (typeof onResult !== 'function') return;
    if (!state || !Array.isArray(state.players)) { onResult(null); return; }

    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      onResult(val);
    };

    const m = this.open(`
      <h2>Choose a Player</h2>
      <div class="hint">This ability targets any player you pick.</div>
      <div class="player-pick-grid" id="playerPickGrid"></div>
      <button class="btn ghost big" style="width:100%;margin-top:14px" id="ppCancel">Cancel</button>
    `, { onClose: () => finish(null) });

    if (!m) { finish(null); return; }

    const grid = m.querySelector('#playerPickGrid');
    if (!grid) { this.close(); finish(null); return; }

    state.players.forEach((p, i) => {
      if (i === excludeIdx) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'player-pick-btn';
      btn.innerHTML = `
        <span class="pp-av">${esc(p.avatar || '🙂')}</span>
        <span class="pp-name">${esc(p.name)}</span>
        <span class="pp-cnt">${p.hand.length} card${p.hand.length === 1 ? '' : 's'}</span>
      `;
      btn.onclick = () => this._commit(i, finish);
      grid.appendChild(btn);
    });

    m.querySelector('#ppCancel').onclick = () => this.close();
  },

  pickCardFrom(player, onResult) {
    if (typeof onResult !== 'function') return;
    if (!player || !Array.isArray(player.hand)) { onResult(null); return; }

    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      onResult(val);
    };

    const m = this.open(`
      <h2>Pick a Card</h2>
      <div class="hint">Tap one card from ${esc(player.avatar)} ${esc(player.name)}'s hand.</div>
      <div class="card-pick-grid" id="cardPickGrid"></div>
      <button class="btn ghost big" style="width:100%;margin-top:14px" id="cpCancel">Cancel</button>
    `, { onClose: () => finish(null) });

    if (!m) { finish(null); return; }

    const grid = m.querySelector('#cardPickGrid');
    if (!grid) { this.close(); finish(null); return; }

    if (!player.hand.length) {
      grid.innerHTML = '<p style="opacity:.7;margin:8px 0">No cards in hand.</p>';
    }

    player.hand.forEach(card => {
      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'card-pick-btn';
      wrap.setAttribute('aria-label', `Take ${card.name}`);
      wrap.style.cssText = 'background:transparent;border:0;padding:0;margin:0;cursor:pointer;pointer-events:auto;';

      const cardEl = CardRenderer.build(card, { small: true });
      cardEl.style.pointerEvents = 'none';
      wrap.appendChild(cardEl);

      wrap.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[RV] card picked:', card.name, card.uid);
        const uid = card.uid;
        this._commit(uid, finish);
      };

      grid.appendChild(wrap);
    });

    m.querySelector('#cpCancel').onclick = () => this.close();
  },

  revealHand(player, cards, onClose) {
    const m = this.open(`
      <h2>${esc(player.avatar)} ${esc(player.name)}'s Hand</h2>
      <div class="hint">${cards.length} card${cards.length !== 1 ? 's' : ''} revealed.</div>
      <div class="reveal-hand" id="revealHand"></div>
      <button class="btn primary big" style="width:100%;margin-top:20px" id="closeReveal">Got it</button>
    `, { onClose });
    if (!m) return;
    const wrap = m.querySelector('#revealHand');
    cards.forEach(c => wrap.appendChild(CardRenderer.build(c, { small: true })));
    m.querySelector('#closeReveal').onclick = () => this.close();

    setTimeout(() => {
      const bg = document.getElementById('modalBg');
      if (bg && bg.classList.contains('on') && !this._forceChoice) this.close();
    }, 6000);
  },

  customDeck(onLoad) {
    const sample = {
      name: "My Anime Deck",
      colors: ["red", "blue", "green", "yellow"],
      numberNames: {
        red: ["Hero A","Hero B","Hero C","Hero D","Hero E","Hero F","Hero G","Hero H","Hero I","Hero J"],
        blue: ["Blue A","Blue B","Blue C","Blue D","Blue E","Blue F","Blue G","Blue H","Blue I","Blue J"],
        green: ["Green A","Green B","Green C","Green D","Green E","Green F","Green G","Green H","Green I","Green J"],
        yellow: ["Yellow A","Yellow B","Yellow C","Yellow D","Yellow E","Yellow F","Yellow G","Yellow H","Yellow I","Yellow J"]
      },
      actions: [
        { name: "Naruto", color: "red", type: "action", icon: "🍥", rarity: "uncommon", count: 3,
          text: "Rasengan — next player draws 2.",
          effects: [{ type: "DRAW", target: "next", amount: 2 }] },
        { name: "Sasuke", color: "blue", type: "action", icon: "⚡", rarity: "uncommon", count: 2,
          text: "Chidori — next player skips.",
          effects: [{ type: "SKIP", target: "next" }] },
        { name: "Itachi", color: "green", type: "action", icon: "🔥", rarity: "rare", count: 1,
          text: "Tsukuyomi — reverse and draw 1.",
          effects: [{ type: "REVERSE" }, { type: "DRAW", target: "self", amount: 1 }] },
        { name: "Madara", color: "wild", type: "special", icon: "👁️", rarity: "ultimate", count: 1,
          text: "Infinite Tsukuyomi — others discard half (needs 6+).",
          requires: { minHand: 6 },
          effects: [{ type: "DISCARD", target: "others", amount: -1 }] }
      ]
    };

    const m = this.open(`
      <h2>🎨 Deck Studio</h2>
      <div class="hint">
        Define a universe as JSON. Effect types:
        <code>DRAW · SKIP · REVERSE · EXTRA_TURN · DISCARD · SWAP_HANDS · REVEAL · SHIELD · IMMUNE · COPY · STEAL</code>.
        Targets: <code>self · next · prev · all · others · choose</code>.
      </div>
      <textarea id="deckJson" spellcheck="false">${esc(JSON.stringify(sample, null, 2))}</textarea>
      <div class="row" style="margin-top:16px">
        <button class="btn primary" id="loadDeck" style="flex:1">Load Deck</button>
        <button class="btn ghost" id="cancelDeck">Cancel</button>
      </div>
      <div class="hint" id="deckErr" style="color:var(--danger);margin-top:12px;display:none;font-weight:800"></div>
    `);
    if (!m) return;

    m.querySelector('#cancelDeck').onclick = () => this.close();
    m.querySelector('#loadDeck').onclick = () => {
      const errEl = m.querySelector('#deckErr');
      try {
        const obj = JSON.parse(m.querySelector('#deckJson').value);
        if (!obj.name || !obj.colors || !obj.numberNames || !obj.actions)
          throw new Error('Needs name, colors, numberNames and actions.');
        if (!Array.isArray(obj.colors) || obj.colors.length < 2)
          throw new Error('Provide at least 2 colors.');
        this.close();
        onLoad(obj);
      } catch (e) {
        errEl.style.display = 'block';
        errEl.textContent = '⚠ ' + e.message;
      }
    };
  }
};