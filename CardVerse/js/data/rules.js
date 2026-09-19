/* ============================================================
   data/rules.js — the rule CONFIG SCHEMA
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
      { key: 'draw2OnDraw4', label: '+2 on +4', type: 'bool', def: false }
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
      { key: 'handSize', label: 'Starting Hand', type: 'num', def: 7, min: 3, max: 12 },
      { key: 'reshuffle', label: 'Reshuffle Discard', type: 'bool', def: true }
    ]
  }
];

function defaultRules() {
  const r = {};
  for (const g of RULE_SCHEMA) {
    r[g.key] = {};
    for (const it of g.items) r[g.key][it.key] = it.def;
  }
  return r;
}