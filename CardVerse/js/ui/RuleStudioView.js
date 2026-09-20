/* ============================================================
   ui/RuleStudioView.js — Advanced Rules modal (Pulse)

   Bulletproof against script load order:
     · rules are lazily initialized on first access
     · no top-level call to defaultRules()
     · graceful fallback if rules.js hasn't loaded yet
   ============================================================ */
const RuleStudioView = {
  presetKey: 'classic',
  _rules: null,

  get rules() {
    if (!this._rules) {
      if (typeof defaultRules !== 'function') {
        console.error(
          '[RuleStudioView] defaultRules() is not defined. ' +
          'Check that js/data/rules.js loads BEFORE js/ui/RuleStudioView.js in index.html.'
        );
        // Safe fallback so the UI still opens.
        this._rules = {
          matching:  { color: true, rank: true, universe: false, character: false, type: false },
          stacking:  { draw2OnDraw2: true, draw4OnDraw2: false, draw4OnDraw4: false, draw2OnDraw4: false },
          turn:      { timer: 0, drawUntilPlayable: false, jumpIn: false },
          draw:      { count: 1, playAfterDraw: true, forcePlay: false },
          abilities: { enabled: true, costEnabled: true },
          deal:      { handSize: 7, reshuffle: true }
        };
      } else {
        this._rules = defaultRules();
      }
    }
    return this._rules;
  },

  set rules(v) { this._rules = v; },

  openModal(onChange) {
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      if (typeof onChange === 'function') onChange();
    };

    const m = Modal.open(`
      <h2>Advanced Rules</h2>
      <div class="hint">Pick a preset, then fine-tune. Most players stay on Classic.</div>
      <div class="preset-grid" id="presetGrid"></div>
      <div id="ruleGroups"></div>
      <button class="btn primary big" style="width:100%;margin-top:12px" id="rulesDone">Done</button>
    `, { onClose: fire });

    if (!m) { fire(); return; }

    this.renderPresetsModal(m);
    this.renderGroupsModal(m);

    const doneBtn = m.querySelector('#rulesDone');
    if (doneBtn) {
      doneBtn.onclick = () => {
        Modal.close();
        fire();
      };
    }
  },

  renderPresetsModal(host) {
    const grid = host.querySelector('#presetGrid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.entries(RULE_PRESETS).forEach(([key, p]) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'preset-card' + (key === this.presetKey ? ' sel' : '');
      el.innerHTML = `
        <div class="pi">${p.icon || '🎴'}</div>
        <div class="pn">${esc(p.name || key)}</div>
        <div class="pd">${esc(p.desc || '')}</div>
      `;
      el.onclick = () => {
        Sound.click();
        this.presetKey = key;
        this.rules = p.rules();
        this.renderPresetsModal(host);
        this.renderGroupsModal(host);
      };
      grid.appendChild(el);
    });
  },

  renderGroupsModal(host) {
    const groups = host.querySelector('#ruleGroups');
    if (!groups) return;
    groups.innerHTML = '';

    // Snapshot of the canonical shape — used to backfill missing keys.
    const canonical = (typeof defaultRules === 'function')
      ? defaultRules()
      : this.rules; // fallback: use whatever we already have

    for (const g of RULE_SCHEMA) {
      if (!this.rules[g.key] || typeof this.rules[g.key] !== 'object') {
        this.rules[g.key] = { ...(canonical[g.key] || {}) };
      }

      const box = document.createElement('div');
      box.className = 'rule-group';
      box.innerHTML = `<h3>${g.icon || ''} ${esc(g.group || g.key)}</h3>`;

      for (const item of g.items) {
        if (this.rules[g.key][item.key] === undefined) {
          this.rules[g.key][item.key] =
            (canonical[g.key] && canonical[g.key][item.key] !== undefined)
              ? canonical[g.key][item.key]
              : (item.type === 'bool' ? false : 0);
        }

        const val = this.rules[g.key][item.key];
        const row = document.createElement('div');
        row.className = 'rule-row' + (item.disabled ? ' disabled' : '');

        if (item.type === 'bool') {
          row.innerHTML = `
            <div>
              <div class="rl">${esc(item.label)}</div>
              ${item.note ? `<div class="rn">${esc(item.note)}</div>` : ''}
            </div>
            <label class="switch">
              <input type="checkbox" ${val ? 'checked' : ''} ${item.disabled ? 'disabled' : ''}>
              <span class="sl"></span>
            </label>`;
          const cb = row.querySelector('input');
          cb.onchange = () => {
            Sound.click();
            this.rules[g.key][item.key] = cb.checked;
            this.presetKey = 'custom';
          };
        } else {
          row.innerHTML = `
            <div>
              <div class="rl">${esc(item.label)}</div>
              ${item.suffix ? `<div class="rn">${esc(item.suffix)}</div>` : ''}
            </div>
            <input class="num-in" type="number" value="${val}"
              min="${item.min ?? 0}" max="${item.max ?? 99}" step="${item.step ?? 1}">`;
          const inp = row.querySelector('input');
          inp.onchange = () => {
            let v = parseInt(inp.value, 10) || 0;
            v = clamp(v, item.min ?? 0, item.max ?? 99);
            inp.value = v;
            this.rules[g.key][item.key] = v;
            this.presetKey = 'custom';
          };
        }
        box.appendChild(row);
      }
      groups.appendChild(box);
    }
  }
};