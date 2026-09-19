/* ============================================================
   ui/Modal.js — Pulse
   ============================================================ */
const Modal = {
  _isOpen: false,

  open(html, { onClose = null } = {}) {
    const bg = document.getElementById('modalBg');
    const m = document.getElementById('modal');
    m.innerHTML = html;
    bg.classList.add('on');
    this._isOpen = true;
    bg.onclick = e => { if (e.target === bg) this.close(onClose); };
    return m;
  },

  close(cb) {
    document.getElementById('modalBg').classList.remove('on');
    this._isOpen = false;
    if (typeof cb === 'function') cb();
  },

  colorPick(onPick, onCancel) {
    const m = this.open(`
      <h2>Choose a Color</h2>
      <div class="hint">Your wild card takes on this color.</div>
      <div class="color-pick">
        <button class="cp" data-c="red"><span class="cp-dot"></span>Red</button>
        <button class="cp" data-c="blue"><span class="cp-dot"></span>Blue</button>
        <button class="cp" data-c="green"><span class="cp-dot"></span>Green</button>
        <button class="cp" data-c="yellow"><span class="cp-dot"></span>Yellow</button>
      </div>
    `);
    m.querySelectorAll('.cp').forEach(el => {
      el.onclick = () => { Sound.click(); this.close(); onPick(el.dataset.c); };
    });
    document.getElementById('modalBg').onclick = e => {
      if (e.target === document.getElementById('modalBg')) {
        this.close();
        onCancel && onCancel();
      }
    };
  },

  revealHand(player, cards, onClose) {
    const m = this.open(`
      <h2>${esc(player.avatar)} ${esc(player.name)}'s Hand</h2>
      <div class="hint">${cards.length} card${cards.length !== 1 ? 's' : ''} revealed.</div>
      <div class="reveal-hand" id="revealHand"></div>
      <button class="btn primary big" style="width:100%;margin-top:20px" id="closeReveal">Got it</button>
    `);
    const wrap = m.querySelector('#revealHand');
    cards.forEach(c => wrap.appendChild(CardRenderer.build(c, { small: true })));
    m.querySelector('#closeReveal').onclick = () => this.close(onClose);
    const t = setTimeout(() => {
      if (document.getElementById('modalBg').classList.contains('on')) this.close(onClose);
    }, 6000);
    document.getElementById('modalBg').addEventListener('click', () => clearTimeout(t), { once: true });
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
        Targets: <code>self · next · prev · all · others</code>.
      </div>
      <textarea id="deckJson" spellcheck="false">${esc(JSON.stringify(sample, null, 2))}</textarea>
      <div class="row" style="margin-top:16px">
        <button class="btn primary" id="loadDeck" style="flex:1">Load Deck</button>
        <button class="btn ghost" id="cancelDeck">Cancel</button>
      </div>
      <div class="hint" id="deckErr" style="color:var(--danger);margin-top:12px;display:none;font-weight:800"></div>
    `);

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