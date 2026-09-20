/* ============================================================
   RuleVerse relay server — v2.13
   Adds: public room list, soundPack, isPublic, cleanup,
         avatarImage passthrough.
   ============================================================ */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const ROOT = path.resolve(path.join(__dirname, '..'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch (e) { res.writeHead(400).end('Bad request'); return; }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  if (/^\/r\/[A-Z0-9]{4,8}\/?$/i.test(urlPath)) urlPath = '/index.html';

  const safe = path.normalize(path.join(ROOT, urlPath));
  if (!safe.startsWith(ROOT + path.sep) && safe !== ROOT) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(safe, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const ext = path.extname(safe).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    fs.createReadStream(safe).pipe(res);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server, maxPayload: 128 * 1024 });

const rooms = new Map();

function genCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return rooms.has(s) ? genCode() : s;
}

function send(ws, obj) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(obj)); } catch (e) {}
}

function roomBroadcast(code, obj, exceptWs) {
  const room = rooms.get(code);
  if (!room) return;
  for (const clientWs of room.clients.keys()) {
    if (clientWs === exceptWs) continue;
    send(clientWs, obj);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.roomCode = null;
  ws.playerId = null;
  ws.isHost = false;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;
    try { handleMessage(ws, msg); }
    catch (e) { console.error('[msg]', msg.type, e); }
  });

  ws.on('close', () => handleClose(ws));
  ws.on('error', () => {});
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch (e) {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  }
}, 30000);

// Prune empty/stale rooms every 60s
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const humanCount = Array.from(room.clients.values()).filter(p => !p.isBot).length;
    const idleMs = now - (room.lastActivity || room.createdAt || now);
    if (humanCount === 0 && idleMs > 60 * 1000) rooms.delete(code);
    else if (idleMs > 30 * 60 * 1000) rooms.delete(code);
  }
}, 60000);

wss.on('close', () => { clearInterval(heartbeat); clearInterval(cleanup); });

function touchRoom(room) { room.lastActivity = Date.now(); }

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'create':          return onCreate(ws, msg);
    case 'join':            return onJoin(ws, msg);
    case 'rejoin':          return onRejoin(ws, msg);
    case 'leave':           return onLeave(ws);
    case 'update_room':     return onUpdateRoom(ws, msg);
    case 'add_bot':         return onAddBot(ws, msg);
    case 'remove_bot':      return onRemoveBot(ws, msg);
    case 'kick':            return onKick(ws, msg);
    case 'start':           return onStart(ws, msg);
    case 'cancel_game':     return onCancelGame(ws);
    case 'state_update':    return onStateUpdate(ws, msg);
    case 'action':          return onAction(ws, msg);
    case 'chat':            return onChat(ws, msg);
    case 'clear_chat':      return onClearChat(ws);
    case 'emote':           return onEmote(ws, msg);
    case 'taunt':           return onTaunt(ws, msg);
    case 'rematch_request': return onRematchRequest(ws, msg);
    case 'set_badge':       return onSetBadge(ws, msg);
    case 'list_rooms':      return onListRooms(ws);
    default:                return;
  }
}

function makeRoom(name, universe, rules) {
  const code = genCode();
  const now = Date.now();
  const room = {
    code,
    host: null,
    clients: new Map(),
    name: name || 'Room',
    universe: universe || 'marvel',
    rules: rules || 'classic',
    started: false,
    chat: [],
    soundPack: 'default',
    isPublic: true,
    createdAt: now,
    lastActivity: now
  };
  rooms.set(code, room);
  return room;
}

function roomSummary(room) {
  return {
    code: room.code,
    name: room.name,
    universe: room.universe,
    rules: room.rules,
    started: room.started,
    soundPack: room.soundPack,
    isPublic: room.isPublic,
    hostId: room.host ? room.host.playerId : null,
    players: Array.from(room.clients.values()).map(p => ({
      id: p.playerId,
      name: p.name,
      avatar: p.avatar,
      avatarImage: p.avatarImage || null,
      isBot: !!p.isBot,
      isHost: !!p.isHost,
      connected: true,
      badgeId: p.badgeId || null
    }))
  };
}

function normaliseAvatarImage(v) {
  if (typeof v !== 'string') return null;
  if (!v.startsWith('data:image/')) return null;
  if (v.length > 40000) return null; // ~30 KB raw → 40 KB base64
  return v;
}

function onCreate(ws, msg) {
  const room = makeRoom(msg.name, msg.universe, msg.rules);
  room.host = ws;
  ws.roomCode = room.code;
  ws.playerId = msg.playerId || 'p1';
  ws.isHost = true;
  room.clients.set(ws, {
    playerId: ws.playerId,
    name: msg.playerName || msg.name || 'Host',
    avatar: msg.avatar || '🙂',
    avatarImage: normaliseAvatarImage(msg.avatarImage),
    isBot: false,
    isHost: true,
    badgeId: typeof msg.badgeId === 'string' ? msg.badgeId.slice(0, 32) : null
  });
  touchRoom(room);
  send(ws, { type: 'created', code: room.code, you: ws.playerId });
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

function onJoin(ws, msg) {
  const room = rooms.get((msg.code || '').toUpperCase());
  if (!room) return send(ws, { type: 'error', code: 'no_room', message: 'Room not found' });
  if (room.started) return send(ws, { type: 'error', code: 'in_progress', message: 'Match already started' });
  if (room.clients.size >= 8) return send(ws, { type: 'error', code: 'full', message: 'Room is full' });

  ws.roomCode = room.code;
  ws.playerId = msg.playerId || `p${room.clients.size + 1}`;
  ws.isHost = false;
  room.clients.set(ws, {
    playerId: ws.playerId,
    name: msg.playerName || msg.name || 'Player',
    avatar: msg.avatar || '🙂',
    avatarImage: normaliseAvatarImage(msg.avatarImage),
    isBot: false,
    isHost: false,
    badgeId: typeof msg.badgeId === 'string' ? msg.badgeId.slice(0, 32) : null
  });
  touchRoom(room);
  send(ws, { type: 'joined', code: room.code, you: ws.playerId });
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

function onRejoin(ws, msg) {
  const room = rooms.get((msg.code || '').toUpperCase());
  if (!room) return send(ws, { type: 'error', code: 'no_room', message: 'Room not found' });

  let stale = null;
  for (const [clientWs, info] of room.clients.entries()) {
    if (info.playerId === msg.playerId && clientWs !== ws) { stale = clientWs; break; }
  }
  if (stale) room.clients.delete(stale);

  ws.roomCode = room.code;
  ws.playerId = msg.playerId;
  ws.isHost = room.host === stale;
  if (ws.isHost) room.host = ws;

  room.clients.set(ws, {
    playerId: msg.playerId,
    name: msg.playerName || msg.name || 'Player',
    avatar: msg.avatar || '🙂',
    avatarImage: normaliseAvatarImage(msg.avatarImage),
    isBot: false,
    isHost: ws.isHost,
    badgeId: typeof msg.badgeId === 'string' ? msg.badgeId.slice(0, 32) : null
  });
  touchRoom(room);
  send(ws, { type: 'rejoined', code: room.code, you: ws.playerId, isHost: ws.isHost, room: roomSummary(room) });
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) }, ws);
}

function onLeave(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  const wasHost = room.host === ws;
  room.clients.delete(ws);
  touchRoom(room);

  if (wasHost) {
    roomBroadcast(room.code, { type: 'room_closed' });
    rooms.delete(room.code);
    return;
  }
  roomBroadcast(room.code, { type: 'player_left', playerId: ws.playerId });
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

function onUpdateRoom(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host !== ws) return;
  if (typeof msg.name === 'string') room.name = msg.name.slice(0, 40);
  if (typeof msg.universe === 'string') room.universe = msg.universe;
  if (typeof msg.rules === 'string') room.rules = msg.rules;
  if (msg.soundPack === 'default' || msg.soundPack === 'meme') room.soundPack = msg.soundPack;
  if (typeof msg.isPublic === 'boolean') room.isPublic = msg.isPublic;
  touchRoom(room);
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

function onAddBot(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host !== ws) return;
  if (room.clients.size >= 8) return;
  const botId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  room.clients.set({ readyState: 3 }, {
    playerId: botId, name: msg.name || 'Bot',
    avatar: msg.avatar || '🤖', avatarImage: null,
    isBot: true, isHost: false, badgeId: null
  });
  touchRoom(room);
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

function onRemoveBot(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host !== ws) return;
  for (const [clientWs, info] of room.clients.entries()) {
    if (info.isBot && info.playerId === msg.playerId) { room.clients.delete(clientWs); break; }
  }
  touchRoom(room);
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

function onKick(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host !== ws) return;
  for (const [clientWs, info] of room.clients.entries()) {
    if (info.playerId === msg.playerId && !info.isBot) {
      send(clientWs, { type: 'kicked' });
      try { clientWs.close(); } catch (e) {}
      room.clients.delete(clientWs);
      break;
    }
  }
  touchRoom(room);
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

function onStart(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host !== ws) return;
  room.started = true;
  touchRoom(room);
  roomBroadcast(room.code, {
    type: 'start',
    state: msg.state,
    rulesKey: msg.rulesKey,
    config: msg.config || {},
    room: roomSummary(room)
  });
}

function onCancelGame(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host !== ws) return;
  room.started = false;
  touchRoom(room);
  roomBroadcast(room.code, { type: 'cancel_game', room: roomSummary(room) });
}

function onStateUpdate(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host !== ws) return;
  touchRoom(room);
  roomBroadcast(room.code, { type: 'state_update', state: msg.state }, ws);
}

function onAction(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host === ws) return;
  touchRoom(room);
  send(room.host, { type: 'action', playerId: ws.playerId, action: msg.action });
}

function onChat(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  const text = String(msg.text || '').slice(0, 200);
  if (!text.trim()) return;
  touchRoom(room);
  const from = room.clients.get(ws);
  const line = {
    from: from ? from.name : 'Player',
    avatar: from ? from.avatar : '🙂',
    text,
    ts: Date.now()
  };
  room.chat.push(line);
  if (room.chat.length > 100) room.chat.shift();
  roomBroadcast(room.code, {
    type: 'chat',
    from: line.from, avatar: line.avatar, text: line.text, ts: line.ts, line
  });
}

function onClearChat(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.host !== ws) return;
  room.chat = [];
  touchRoom(room);
  const me = room.clients.get(ws);
  roomBroadcast(room.code, { type: 'chat_cleared', by: me ? me.name : 'Host' });
}

function onEmote(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  touchRoom(room);
  const from = room.clients.get(ws);
  roomBroadcast(room.code, {
    type: 'emote',
    from: from ? from.playerId : null,
    emoji: String(msg.emoji || '').slice(0, 4)
  }, ws);
}

function onTaunt(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  touchRoom(room);
  const from = room.clients.get(ws);
  const text = String(msg.text || '').slice(0, 80);
  if (!text) return;
  roomBroadcast(room.code, {
    type: 'taunt',
    from: from ? from.playerId : null,
    fromName: from ? from.name : 'Player',
    text
  }, ws);
}

function onRematchRequest(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room || !room.host) return;
  touchRoom(room);
  const from = room.clients.get(ws);
  send(room.host, {
    type: 'rematch_request',
    from: from ? from.playerId : null,
    fromName: from ? from.name : 'Player'
  });
}

function onSetBadge(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  const me = room.clients.get(ws);
  if (!me) return;
  me.badgeId = (typeof msg.badgeId === 'string' && msg.badgeId)
    ? msg.badgeId.slice(0, 32) : null;
  touchRoom(room);
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

function onListRooms(ws) {
  const list = [];
  for (const room of rooms.values()) {
    if (!room.isPublic) continue;
    if (room.started) continue;
    const humans = Array.from(room.clients.values()).filter(p => !p.isBot);
    if (!humans.length) continue;
    if (room.clients.size >= 8) continue;
    list.push({
      code: room.code,
      name: room.name,
      universe: room.universe,
      rules: room.rules,
      soundPack: room.soundPack,
      players: Array.from(room.clients.values()).map(p => ({
        id: p.playerId, name: p.name, avatar: p.avatar
      }))
    });
  }
  list.sort((a, b) => b.players.length - a.players.length);
  send(ws, { type: 'room_list', rooms: list.slice(0, 40) });
}

function handleClose(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  const wasHost = room.host === ws;
  const info = room.clients.get(ws);
  room.clients.delete(ws);
  touchRoom(room);
  if (wasHost) {
    roomBroadcast(room.code, { type: 'room_closed' });
    rooms.delete(room.code);
    return;
  }
  if (info) roomBroadcast(room.code, { type: 'player_left', playerId: info.playerId });
  roomBroadcast(room.code, { type: 'room_update', room: roomSummary(room) });
}

server.listen(PORT, () => {
  console.log(`RuleVerse relay listening on :${PORT} (serving ${ROOT})`);
});