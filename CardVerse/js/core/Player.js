/* ============================================================
   core/Player.js
   ============================================================ */
let _pid = 0;
function makePlayer({ name, avatar, isBot = false, id = null }) {
  return {
    id: id || `local-${++_pid}`,
    name,
    avatar,
    isBot,
    hand: [],
    shield: 0,
    immune: false,
    stats: { played: 0, drawn: 0, abilities: 0 }
  };
}