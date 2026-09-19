/* ============================================================
   core/GameState.js
   ============================================================ */
function makeGameState({ players, universeId, universeName, rules }) {
  return {
    players,
    deck: [],
    discard: [],
    turn: 0,
    direction: 1,
    activeColor: null,
    pendingDraw: 0,
    rules,
    universeId,
    universeName,
    winner: null,
    log: [],
    lastAction: null,
    hasDrawn: false,
    turnStart: Date.now(),
    reveal: null,
    turnCount: 0,
    startedAt: Date.now()
  };
}