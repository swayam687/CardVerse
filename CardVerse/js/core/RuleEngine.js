/* ============================================================
   core/RuleEngine.js
   --------------------------------------------------------
   Pure functions. No state mutation.
   ============================================================ */
const RuleEngine = {
  top(state) { return state.discard[state.discard.length - 1] || null; },

  stackAmount(card) {
    const e = card.effects.find(x => x.type === 'DRAW' && x.target === 'next');
    return e ? e.amount : 0;
  },

  canStack(card, state, rules) {
    const pending = state.pendingDraw;
    if (!pending) return false;
    const amt = this.stackAmount(card);
    if (!amt) return false;
    const colorOK = card.color === 'wild' || card.color === state.activeColor;
    if (!colorOK) return false;
    const s = rules.stacking;
    if (pending === 2 && amt === 2) return s.draw2OnDraw2;
    if (pending === 2 && amt >= 4) return s.draw4OnDraw2;
    if (pending >= 4 && amt >= 4) return s.draw4OnDraw4;
    if (pending >= 4 && amt === 2) return s.draw2OnDraw4;
    return false;
  },

  isPlayable(card, state, rules) {
    const top = this.top(state);
    if (!top) return true;

    if (state.pendingDraw > 0) return this.canStack(card, state, rules);

    if (card.color === 'wild') return true;

    const m = rules.matching;
    if (m.color && card.color === state.activeColor) return true;
    if (m.universe && card.universe === top.universe) return true;
    if (m.rank && card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
    if (m.character && card.name === top.name) return true;
    if (m.type && card.type === top.type && card.type !== 'number') return true;

    return false;
  },

  meetsRequirement(card, player, rules) {
    if (!card.requires) return true;
    if (card.requires.minHand && player.hand.length < card.requires.minHand) return false;
    return true;
  },

  targets(state, actor, keyword) {
    const n = state.players.length;
    const next = mod(actor + state.direction, n);
    const prev = mod(actor - state.direction, n);
    switch (keyword) {
      case 'self':   return [actor];
      case 'next':   return [next];
      case 'prev':   return [prev];
      case 'all':    return state.players.map((_, i) => i);
      case 'others': return state.players.map((_, i) => i).filter(i => i !== actor);
      default:       return [];
    }
  }
};