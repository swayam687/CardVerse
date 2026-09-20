/* ============================================================
   data/rules.js — the rule CONFIG SCHEMA + defaults
   v2.11: adds stacking.anyColor (stack +2 on +2 regardless
          of color — No Mercy rule).
   ============================================================ */
const RULE_SCHEMA = [
  {
    group: 'Matching', key: 'matching', icon: '🎯',
    items: [
      { key: 'color',     label: 'Match Color',     type: 'bool', def: true },
      { key: 'rank',      label: 'Match Number',    type: 'bool', def: true },
      { key: 'universe',  label: 'Match Universe',  type: 'bool', def: false, note: 'Only matters in mixed-universe decks' },
      { key: 'character', label: 'Match Character', type: 'bool', def: false, note: 'Same character name always playable' },
      { key: 'type',      label: 'Match Card Type', type: 'bool', def: false }
    ]
  },
  {
    group: 'Stacking', key: 'stacking', icon: '📚',
    items: [
      { key: 'draw2OnDraw2', label: '+2 on +2', type: 'bool', def: true },
      { key: 'draw4OnDraw2', label: '+4 on +2', type: 'bool', def: false },
      { key: 'draw4OnDraw4', label: '+4 on +4', type: 'bool', def: false },
      { key: 'draw2OnDraw4', label: '+2 on +4', type: 'bool', def: false },
      { key: 'anyColor',     label: 'Stack Any Color', type: 'bool', def: false,
        note: 'No Mercy: +2 stacks onto +2 even when colors differ' }
    ]
  },
  {
    group: 'Turn', key: 'turn', icon: '⏱️',
    items: [
      { key: 'timer',             label: 'Turn Timer', type: 'num', def: 0, min: 0, max: 60, step: 5, suffix: 'sec (0 = off)' },
      { key: 'drawUntilPlayable', label: 'Draw Until Playable', type: 'bool', def: false },
      { key: 'jumpIn',            label: 'Jump-In', type: 'bool', def: false, disabled: true, note: 'Coming in the reaction-window update' }
    ]
  },
  {
    group: 'Drawing', key: 'draw', icon: '🃏',
    items: [
      { key: 'count',          label: 'Cards Per Draw', type: 'num', def: 1, min: 1, max: 5 },
      { key: 'playAfterDraw',  label: 'May Play After Drawing', type: 'bool', def: true },
      { key: 'forcePlay',      label: 'Must Play If Able', type: 'bool', def: false }
    ]
  },
  {
    group: 'Abilities', key: 'abilities', icon: '✨',
    items: [
      { key: 'enabled',     label: 'Character Abilities', type: 'bool', def: true },
      { key: 'costEnabled', label: 'Ability Costs',       type: 'bool', def: true }
    ]
  },
  {
    group: 'Table', key: 'deal', icon: '🎲',
    items: [
      { key: 'handSize',  label: 'Starting Hand',      type: 'num', def: 7, min: 3, max: 20 },
      { key: 'reshuffle', label: 'Reshuffle Discard',  type: 'bool', def: true },
      { key: 'deckMode',  label: 'Deck Mode', type: 'str', def: 'normal', hidden: true }
    ]
  }
];

function defaultRules() {
  const out = {};
  for (const group of RULE_SCHEMA) {
    const g = {};
    for (const item of group.items) {
      g[item.key] = (item.def !== undefined) ? item.def : 0;
    }
    out[group.key] = g;
  }
  return out;
}

function sanitizeRules(r) {
  const src = (r && typeof r === 'object') ? r : {};

  const out = {
    matching:  { ...(src.matching  || {}) },
    stacking:  { ...(src.stacking  || {}) },
    turn:      { ...(src.turn      || {}) },
    draw:      { ...(src.draw      || {}) },
    abilities: { ...(src.abilities || {}) },
    deal:      { ...(src.deal      || {}) }
  };

  const num = (v, lo, hi, dflt) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(lo, Math.min(hi, n));
  };

  out.deal.handSize = num(out.deal.handSize, 3, 20, 7);
  out.draw.count    = num(out.draw.count,    1, 5,  1);
  out.turn.timer    = num(out.turn.timer,    0, 120, 0);

  if (out.deal.deckMode !== 'allWild') out.deal.deckMode = 'normal';

  return out;
}