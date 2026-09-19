/* ============================================================
   data/presets.js
   ============================================================ */
const RULE_PRESETS = {
  classic: {
    name: 'Classic', icon: '🎴', tag: 'BALANCED',
    desc: 'Standard color/number matching. +2 stacks on +2. Abilities on.',
    rules: () => defaultRules()
  },
  chaos: {
    name: 'Chaos', icon: '🌪️', tag: 'WILD',
    desc: 'Everything stacks on everything. Draw until playable. Absolute nonsense.',
    rules: () => {
      const r = defaultRules();
      r.stacking.draw2OnDraw2 = true;
      r.stacking.draw4OnDraw2 = true;
      r.stacking.draw4OnDraw4 = true;
      r.stacking.draw2OnDraw4 = true;
      r.turn.drawUntilPlayable = true;
      r.matching.character = true;
      return r;
    }
  },
  tactical: {
    name: 'Tactical', icon: '🧠', tag: 'SHARP',
    desc: 'No stacking. Turn timer on. Abilities matter more than luck.',
    rules: () => {
      const r = defaultRules();
      r.stacking.draw2OnDraw2 = false;
      r.turn.timer = 15;
      r.draw.playAfterDraw = false;
      return r;
    }
  },
  purge: {
    name: 'Purge', icon: '💀', tag: 'BRUTAL',
    desc: 'No abilities — pure card matching. Big hands, long games.',
    rules: () => {
      const r = defaultRules();
      r.abilities.enabled = false;
      r.deal.handSize = 9;
      r.stacking.draw2OnDraw2 = true;
      r.stacking.draw4OnDraw2 = true;
      return r;
    }
  }
};