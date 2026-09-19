/* ============================================================
   core/Deck.js
   ============================================================ */
function buildDeck(universeId, customDef) {
  const u = customDef || UNIVERSES[universeId];
  const deck = [];

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

  for (const a of (u.actions || [])) {
    const count = a.count || 1;
    for (let i = 0; i < count; i++) deck.push(makeCard(a, universeId));
  }

  return shuffle(deck);
}