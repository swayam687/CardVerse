/* ============================================================
   ui/LobbyView.js — Home screen controller (Pulse)
   ============================================================ */
const AVATARS = ['🙂', '😎', '🤖', '👾', '🦊', '🐲', '🦉', '🐺', '👽', '🧙', '🥷', '🦁'];

const LobbyView = {
  profile: { name: 'Player', avatar: '🙂' },
  players: 4,
  bots: 3,
  universeId: 'marvel',
  customDef: null,

  init() {
    try {
      const p = JSON.parse(localStorage.getItem('rv_profile') || 'null');
      if (p && p.name) this.profile = p;
    } catch(e){}
    this._applyProfile();

    const sel = document.getElementById('selUniverse');
    sel.innerHTML = '';
    Object.values(UNIVERSES).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.icon} ${u.name}`;
      sel.appendChild(opt);
    });
    sel.value = this.universeId;
    sel.onchange = () => {
      this.universeId = sel.value;
      this.customDef = null;
      this._updateHero();
      Sound.click();
    };

    const selP = document.getElementById('selPlayers');
    selP.value = this.players;
    selP.onchange = () => {
      this.players = parseInt(selP.value, 10);
      const maxBots = this.players - 1;
      const selBots = document.getElementById('selBots');
      if (this.bots > maxBots) {
        this.bots = maxBots;
        selBots.value = String(maxBots);
      }
      Array.from(selBots.options).forEach(o => {
        o.disabled = parseInt(o.value, 10) > maxBots;
      });
      this._updateHero();
    };

    const selB = document.getElementById('selBots');
    selB.value = this.bots;
    selB.onchange = () => {
      this.bots = parseInt(selB.value, 10);
      this._updateHero();
    };

    const selR = document.getElementById('selRules');
    Object.entries(RULE_PRESETS).forEach(([k, p]) => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = `${p.icon} ${p.name}`;
      selR.appendChild(opt);
    });
    selR.value = 'classic';
    selR.onchange = () => {
      RuleStudioView.presetKey = selR.value;
      RuleStudioView.rules = RULE_PRESETS[selR.value].rules();
      this._updateHero();
      Sound.click();
    };

    document.getElementById('btnProfile').onclick = () => { Sound.click(); this.openProfileModal(); };
    document.getElementById('btnQuickPlay').onclick = () => { Sound.click(); GameFlow.startGame(); };
    document.getElementById('btnOpenRules').onclick = () => {
      Sound.click();
      RuleStudioView.openModal(() => {
        selR.value = RuleStudioView.presetKey;
        this._updateHero();
      });
    };
    document.getElementById('btnOpenCustom').onclick = () => {
      Sound.click();
      Modal.customDeck(def => this.addCustomUniverse(def));
    };

    this._updateHero();
  },

  _applyProfile() {
    const av = document.getElementById('myAvatar');
    const nm = document.getElementById('myName');
    if (av) av.textContent = this.profile.avatar;
    if (nm) nm.textContent = this.profile.name;
  },

  _saveProfile() {
    try { localStorage.setItem('rv_profile', JSON.stringify(this.profile)); } catch(e){}
  },

  _updateHero() {
    const sub = document.querySelector('.bh-sub');
    if (!sub) return;
    const u = this.customDef
      ? { name: this.customDef.name }
      : { name: UNIVERSES[this.universeId].name };
    const preset = RULE_PRESETS[RuleStudioView.presetKey];
    const rulesName = preset ? preset.name : 'Custom';
    sub.textContent = `${u.name} · ${this.players} players · ${rulesName}`;
  },

  addCustomUniverse(def) {
    this.customDef = def;
    this.universeId = 'custom';
    const sel = document.getElementById('selUniverse');
    Array.from(sel.options).forEach(o => { if (o.value === 'custom') o.remove(); });
    const opt = document.createElement('option');
    opt.value = 'custom';
    opt.textContent = `🎨 ${def.name}`;
    sel.appendChild(opt);
    sel.value = 'custom';
    this._updateHero();
    Toast.show(`Loaded "${def.name}"`);
  },

  openProfileModal() {
    const m = Modal.open(`
      <h2>Your Profile</h2>
      <div class="hint">Your name shows to other players.</div>
      <label class="fl">Display Name</label>
      <input id="profName" maxlength="14" autocomplete="off" value="${esc(this.profile.name)}">
      <label class="fl" style="margin-top:16px">Avatar</label>
      <div id="profAvatars" style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px"></div>
      <button class="btn primary big" id="profSave" style="width:100%;margin-top:20px">Save</button>
    `);

    const grid = m.querySelector('#profAvatars');
    AVATARS.forEach(a => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = a;
      const sel = a === this.profile.avatar;
      el.style.cssText = `
        aspect-ratio: 1;
        border-radius: 12px;
        font-size: 22px;
        background: ${sel ? 'var(--accent-soft)' : 'var(--bg-surface-2)'};
        border: 2px solid ${sel ? 'var(--accent)' : 'var(--border)'};
        cursor: pointer;
        font-family: inherit;
        transition: .15s;
      `;
      el.onclick = () => {
        this.profile.avatar = a;
        grid.querySelectorAll('button').forEach(x => {
          x.style.background = 'var(--bg-surface-2)';
          x.style.borderColor = 'var(--border)';
        });
        el.style.background = 'var(--accent-soft)';
        el.style.borderColor = 'var(--accent)';
        Sound.click();
      };
      grid.appendChild(el);
    });

    m.querySelector('#profSave').onclick = () => {
      const n = m.querySelector('#profName').value.trim();
      if (n) this.profile.name = n;
      this._saveProfile();
      this._applyProfile();
      Sound.click();
      Modal.close();
      Toast.show(`Hi, ${this.profile.name}`);
    };
  }
};