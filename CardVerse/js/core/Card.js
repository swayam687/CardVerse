/* ============================================================
   core/Card.js
   ============================================================ */
let _uid = 0;
function makeCard(def, universeId) {
  return {
    uid: ++_uid,
    name: def.name,
    color: def.color,
    universe: universeId,
    type: def.type,
    value: def.value ?? null,
    rarity: def.rarity || 'common',
    text: def.text || '',
    effects: def.effects || [],
    icon: def.icon || '★',
    requires: def.requires || null
  };
}