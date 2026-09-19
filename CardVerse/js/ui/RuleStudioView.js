/* ============================================================
   ui/RuleStudioView.js — Advanced Rules modal (Pulse)
   ============================================================ */
const RuleStudioView = {
  rules: defaultRules(),
  presetKey: 'classic',

  openModal(onChange) {
    const m = Modal.open(`
      <h2>Advanced Rules</h2>
      <div class="hint">Pick a preset, then fine-tune. Most players stay on Classic.</div>
      <div class="preset-grid" id="presetGrid"></div>
      <div id="ruleGroups"></div>
      <button class="btn primary big" style="width:100%;margin-top:12px" id="rulesDone">Done</button>
    `);
    this.renderPresetsModal(m);
    this.renderGroupsModal(m);
    m.querySelector('#rulesDone').onclick = () => {
      Modal.close();
      onChange && onChange();
    };
  },

  renderPresetsModal(host) {
    const grid = host.querySelector('#presetGrid');
    grid.innerHTML = '';
    Object.entries(RULE_PRESETS).forEach(([key, p]) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'preset-card' + (key === this.presetKey ? ' sel' : '');
      el.innerHTML = `
        <div class="pi">${p.icon}</div>
        <div class="pn">${p.name}</div>
        <div class="pd">${p.desc}</div>
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
    groups.innerHTML = '';
    for (const g of RULE_SCHEMA) {
      const box = document.createElement('div');
      box.className = 'rule-group';
      box.innerHTML = `<h3>${g.icon} ${g.group}</h3>`;

      for (const item of g.items) {
        const val = this.rules[g.key][item.key];
        const row = document.createElement('div');
        row.className = 'rule-row' + (item.disabled ? ' disabled' : '');

        if (item.type === 'bool') {
          row.innerHTML = `
            <div>
              <div class="rl">${item.label}</div>
              ${item.note ? `<div class="rn">${item.note}</div>` : ''}
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
              <div class="rl">${item.label}</div>
              ${item.suffix ? `<div class="rn">${item.suffix}</div>` : ''}
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