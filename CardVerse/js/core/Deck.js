/* ============================================================
   js/core/Deck.js
   buildDeck — assembles + shuffles a deck from a universe def.
   ============================================================ */

function buildDeck(universeId, customDef) {
  const u = customDef || (typeof UNIVERSES !== 'undefined' ? UNIVERSES[universeId] : null);
  if (!u) throw new Error(`Unknown universe: ${universeId}`);
  const deck = [];

  // Numbers: value 0 = single copy, 1..9 = two copies each.
  if (u.numberNames) {
    for (const color of u.colors) {
      const names = u.numberNames[color] || [];
      names.forEach((name, value) => {
        const copies = value === 0 ? 1 : 2;
        for (let i = 0; i < copies; i++) {
          deck.push(makeCard({
            name, color, type: 'number', value,
            icon: value >= 7 ? '★★' : '★'
          }, universeId));
        }
      });
    }
  }

  // Actions / wilds.
  for (const a of (u.actions || [])) {
    const count = clamp(Number(a.count) || 1, 0, 12);
    for (let i = 0; i < count; i++) deck.push(makeCard(a, universeId));
  }

  if (deck.length < 20) {
    console.warn(`[Deck] Suspiciously small deck for "${universeId}": ${deck.length} cards.`);
  }

  return shuffle(deck);
}