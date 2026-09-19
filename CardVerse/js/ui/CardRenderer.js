/* ============================================================
   ui/CardRenderer.js — Pulse
   ---------------------------------------------------------
   Card hierarchy: NUMBER (largest) > NAME > ABILITY PILL.
   Shapes appear only in colorblind mode.
   ============================================================ */
const CardRenderer = {
  SHAPE: { red: '▲', blue: '●', green: '■', yellow: '★', wild: '◆' },

  slugify(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  },

  portraitPath(card) {
    if (!card || (card.type !== 'action' && card.type !== 'special')) return null;
    const uni = card.universe || 'wild';
    return `assets/cards/${uni}/${this.slugify(card.name)}.webp`;
  },

  centerDisplay(card) {
    if (!card) return '★';
    if (card.type === 'number') return String(card.value);
    for (const e of card.effects) {
      switch (e.type) {
        case 'DRAW':       return `+${e.amount}`;
        case 'SKIP':       return '⊘';
        case 'REVERSE':    return '↻';
        case 'EXTRA_TURN': return '✦';
        case 'DISCARD':    return e.amount === -1 ? '½' : `-${e.amount}`;
        case 'SWAP_HANDS': return '⇄';
        case 'REVEAL':     return '👁';
        case 'SHIELD':     return '🛡';
        case 'IMMUNE':     return '✨';
        case 'COPY':       return '⎘';
        case 'STEAL':      return '↜';
      }
    }
    if (card.color === 'wild') return '◆';
    return '✦';
  },

  isIcon(card) { return card && card.type !== 'number'; },

  abilityKeyword(card) {
    if (!card || card.type === 'number') return '';
    if (card.requires && card.requires.minHand) return `NEED ${card.requires.minHand}+`;
    const parts = [];
    for (const e of card.effects) {
      switch (e.type) {
        case 'DRAW':       parts.push(`DRAW ${e.amount}`); break;
        case 'SKIP':       parts.push('SKIP'); break;
        case 'REVERSE':    parts.push('REVERSE'); break;
        case 'EXTRA_TURN': parts.push('EXTRA'); break;
        case 'DISCARD':    parts.push(e.amount === -1 ? 'HALF' : `DISCARD ${e.amount}`); break;
        case 'SWAP_HANDS': parts.push('SWAP'); break;
        case 'REVEAL':     parts.push('REVEAL'); break;
        case 'SHIELD':     parts.push('SHIELD'); break;
        case 'IMMUNE':     parts.push('IMMUNE'); break;
        case 'COPY':       parts.push('COPY'); break;
        case 'STEAL':      parts.push('STEAL'); break;
      }
    }
    if (!parts.length) return card.color === 'wild' ? 'WILD' : '★';
    return parts.join(' + ');
  },

  fullText(card) {
    if (!card) return '';
    if (card.type === 'number') return `${COLOR_META[card.color].label} ${card.value}`;
    if (card.text) return card.text;
    return card.color === 'wild' ? 'Change the active color.' : '';
  },

  build(card, { small = false, tiny = false, faceDown = false } = {}) {
    const el = document.createElement('div');
    el.className = 'card' + (small ? ' small' : '') + (tiny ? ' tiny' : '');
    el.dataset.color = card ? card.color : 'wild';
    if (card) {
      el.dataset.uid = card.uid;
      if (card.rarity) el.dataset.rarity = card.rarity;
      if (card.type) el.dataset.type = card.type;
    }

    const cb = document.documentElement.classList.contains('cb-mode');
    const shape = (cb && card) ? (this.SHAPE[card.color] || '') : '';
    const center = this.isIcon(card) ? this.centerDisplay(card) : (card ? String(card.value) : '★');
    const centerClass = this.isIcon(card) ? 'c-center is-icon' : 'c-center';
    const keyword = (card && card.type !== 'number') ? this.abilityKeyword(card) : '';
    const needsReq = card && card.requires;

    el.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-front">
          ${card ? `
            ${shape ? `<div class="c-shape tl">${shape}</div>` : ''}
            <div class="${centerClass}">${esc(center)}</div>
            <div class="c-bottom">
              <div class="c-name">${esc(card.name)}</div>
              ${keyword ? `<div class="c-pill ${needsReq ? 'locked' : ''}">${esc(keyword)}</div>` : ''}
            </div>
            ${shape ? `<div class="c-shape br">${shape}</div>` : ''}
          ` : ''}
        </div>
        <div class="card-face card-back"></div>
      </div>`;

    if (card) el.dataset.tooltip = this.fullText(card);
    return el;
  },

  miniStack(count, max = 5) {
    const wrap = document.createElement('div');
    wrap.className = 'opp-mini-stack';
    const shown = Math.min(count, max);
    for (let i = 0; i < shown; i++) {
      const d = document.createElement('div');
      d.className = 'mini';
      wrap.appendChild(d);
    }
    return wrap;
  }
};