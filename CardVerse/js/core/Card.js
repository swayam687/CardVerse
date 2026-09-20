/* ============================================================
   js/core/Card.js
   makeCard — clones effects/requires, namespaces uid per session.
   ============================================================ */

let _uid = 0;

function makeCard(def, universeId) {
  return {
    uid: `${SESSION_TAG}-${++_uid}`,
    name: def.name,
    color: def.color,
    universe: universeId,
    type: def.type,
    value: def.value ?? null,
    rarity: def.rarity || 'common',
    text: def.text || '',
    effects: cloneEffects(def.effects || []),
    icon: def.icon || '★',
    requires: def.requires ? { ...def.requires } : null
  };
}