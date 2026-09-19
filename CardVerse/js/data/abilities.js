/* ============================================================
   data/abilities.js
   --------------------------------------------------------
   The ability vocabulary — the ONLY verbs the engine understands.
   WHEN / IF / THEN, expressed as data.
   ============================================================ */
const EFFECTS = {
  DRAW:       'DRAW',        // {target, amount}
  SKIP:       'SKIP',        // {target}
  REVERSE:    'REVERSE',     // {}
  EXTRA_TURN: 'EXTRA_TURN',  // {}
  DISCARD:    'DISCARD',     // {target, amount}  (amount:-1 = half, rounded down)
  SWAP_HANDS: 'SWAP_HANDS',  // {target}
  REVEAL:     'REVEAL',      // {target}
  SHIELD:     'SHIELD',      // {target:'self'}  negate next draw on you
  IMMUNE:     'IMMUNE',      // {target:'self'}  untargetable until your turn
  COPY:       'COPY',        // {} copy last action card's effects
  STEAL:      'STEAL'        // {target, amount}
};