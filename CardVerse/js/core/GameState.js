/* ============================================================
   js/core/GameState.js
   ============================================================ */

const LOG_MAX = 40; // keep broadcast state small

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
    startedAt: Date.now(),
    // NEW: LAST CARD tracking. Index-aligned with players.
    // false → player must still press "CALL LAST CARD!" before winning.
    // Bots auto-set this to true when they land on exactly 1 card.
    lastCardCalled: players.map(() => false)
  };
}