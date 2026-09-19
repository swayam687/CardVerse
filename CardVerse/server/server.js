/* ============================================================
   RuleVerse relay server
   ---------------------------------------------------------
   · Serves the static client from the project root
   · WebSocket relay for rooms, chat, game actions
   · Host authority: state lives on the host's client
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.mp3':  'audio/mpeg',
  '.woff2':'font/woff2',
  '.ico':  'image/x-icon'
};

const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server: httpServer });

const clients = new Map();  // id -> { id, ws, roomCode, name, avatar }
const rooms = new Map();    // code -> room

function genId() { return randomUUID().replace(/-/g, '').slice(0, 12); }
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + '-' + (10 + Math.floor(Math.random() * 90));
}

function send(ws, msg) {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(msg)); } catch(e){}
}
function broadcast(room, msg, exceptId = null) {
  for (const p of room.players) {
    if (p.id === exceptId) continue;
    const c = clients.get(p.id);
    if (c && c.ws) send(c.ws, msg);
  }
}
function roomSnapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar,
      isBot: !!p.isBot, connected: !!p.connected
    })),
    universeId: room.universeId,
    universeName: room.universeName,
    customDef: room.customDef,
    rulesKey: room.rulesKey,
    started: room.started,
    state: room.state || null
  };
}

wss.on('connection', (ws) => {
  const id = genId();
  const client = { id, ws, roomCode: null, name: 'Player', avatar: '🙂' };
  clients.set(id, client);
  ws.clientId = id;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  send(ws, { type: 'welcome', playerId: id });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    try { handle(client, msg); } catch (e) { console.error('handle error:', e); }
  });

  ws.on('close', () => {
    if (!client.roomCode) { clients.delete(id); return; }
    const room = rooms.get(client.roomCode);
    if (!room) { clients.delete(id); return; }
    const player = room.players.find(p => p.id === client.id);
    if (!player) { clients.delete(id); return; }

    player.connected = false;
    client.ws = null;

    broadcast(room, { type: 'player_left', id: client.id, name: player.name });

    if (client.id === room.hostId) {
      broadcast(room, { type: 'room_closed', reason: 'Host disconnected' });
      for (const p of room.players) {
        const c = clients.get(p.id);
        if (c) c.roomCode = null;
      }
      rooms.delete(room.code);
      return;
    }

    if (!room.started) {
      room.players = room.players.filter(p => p.id !== client.id);
      client.roomCode = null;
      if (room.players.length === 0) rooms.delete(room.code);
      else broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
    } else {
      broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
    }
  });
});

setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) { try { ws.terminate(); } catch(e){} return; }
    ws.isAlive = false;
    try { ws.ping(); } catch(e){}
  });
}, 30000);

// ---------- message handlers ----------
function handle(client, msg) {
  switch (msg.type) {
    case 'create':        return onCreate(client, msg);
    case 'join':          return onJoin(client, msg);
    case 'rejoin':        return onRejoin(client, msg);
    case 'leave':         return onLeave(client);
    case 'update_room':   return onUpdateRoom(client, msg);
    case 'add_bot':       return onAddBot(client, msg);
    case 'remove_bot':    return onRemoveBot(client, msg);
    case 'kick':          return onKick(client, msg);
    case 'start':         return onStart(client, msg);
    case 'cancel_game':   return onCancelGame(client);
    case 'state_update':  return onStateUpdate(client, msg);
    case 'action':        return onAction(client, msg);
    case 'chat':          return onChat(client, msg);
    case 'clear_chat':    return onClearChat(client);   // ← new
    case 'emote':         return onEmote(client, msg);
  }
}

function onClearChat(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  // Host-only
  if (client.id !== room.hostId) return;
  broadcast(room, { type: 'chat_cleared', by: client.name });
}

function onCreate(client, msg) {
  client.name = msg.name || 'Player';
  client.avatar = msg.avatar || '🙂';

  let code;
  do { code = genCode(); } while (rooms.has(code));

  const room = {
    code,
    hostId: client.id,
    players: [{
      id: client.id, name: client.name, avatar: client.avatar,
      isBot: false, connected: true
    }],
    universeId: 'marvel',
    universeName: '🦸 Marvel',
    customDef: null,
    rulesKey: 'classic',
    started: false,
    state: null
  };
  rooms.set(code, room);
  client.roomCode = code;

  send(client.ws, {
    type: 'created',
    code,
    playerId: client.id,
    room: roomSnapshot(room)
  });
}

function onJoin(client, msg) {
  const code = String(msg.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room)                       return send(client.ws, { type: 'error', reason: 'Room not found' });
  if (room.started)                return send(client.ws, { type: 'error', reason: 'Game already started' });
  if (room.players.length >= 8)    return send(client.ws, { type: 'error', reason: 'Room is full' });
  if (room.players.some(p => p.id === client.id))
                                   return send(client.ws, { type: 'error', reason: 'Already in this room' });

  client.name = msg.name || 'Player';
  client.avatar = msg.avatar || '🙂';
  client.roomCode = code;

  room.players.push({
    id: client.id, name: client.name, avatar: client.avatar,
    isBot: false, connected: true
  });

  send(client.ws, {
    type: 'joined',
    code,
    playerId: client.id,
    room: roomSnapshot(room)
  });
  broadcast(room, { type: 'room_update', room: roomSnapshot(room) }, client.id);
  broadcast(room, {
    type: 'chat', system: true,
    text: `${client.name} joined the room`,
    ts: Date.now()
  }, client.id);
}

// ── FIX 2: rejoin accepts the OLD player id and swaps the socket's identity
function onRejoin(client, msg) {
  const code = String(msg.code || '').toUpperCase().trim();
  const oldId = msg.playerId;
  const room = rooms.get(code);
  if (!room) return send(client.ws, { type: 'error', reason: 'Room no longer exists' });

  const player = oldId ? room.players.find(p => p.id === oldId) : null;
  if (!player) return send(client.ws, { type: 'error', reason: 'You are not in this room' });

  // Take over the old seat's identity on this socket
  const newId = client.id;
  const oldClient = clients.get(oldId);
  if (oldClient && oldClient !== client && oldClient.ws) {
    try { oldClient.ws.close(); } catch(e){}
  }
  clients.delete(newId);
  client.id = oldId;
  clients.set(oldId, client);

  player.connected = true;
  client.roomCode = code;
  client.name = player.name;
  client.avatar = player.avatar;

  send(client.ws, {
    type: 'rejoined',
    code,
    playerId: oldId,
    room: roomSnapshot(room)
  });
  broadcast(room, {
    type: 'chat', system: true,
    text: `${player.name} reconnected`,
    ts: Date.now()
  }, oldId);
  broadcast(room, { type: 'room_update', room: roomSnapshot(room) }, oldId);
}

function onLeave(client) {
  const code = client.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.find(p => p.id === client.id);
  if (!player) return;

  broadcast(room, { type: 'player_left', id: client.id, name: player.name });

  if (client.id === room.hostId) {
    broadcast(room, { type: 'room_closed', reason: 'Host left the room' });
    for (const p of room.players) {
      const c = clients.get(p.id);
      if (c) c.roomCode = null;
    }
    rooms.delete(code);
    return;
  }

  room.players = room.players.filter(p => p.id !== client.id);
  client.roomCode = null;
  if (room.players.length === 0) rooms.delete(code);
  else broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
}

function onUpdateRoom(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (client.id !== room.hostId) return;
  if (room.started) return;

  if (typeof msg.universeId === 'string')  room.universeId = msg.universeId;
  if (typeof msg.universeName === 'string') room.universeName = msg.universeName;
  if ('customDef' in msg) room.customDef = msg.customDef || null;
  if (typeof msg.rulesKey === 'string')    room.rulesKey = msg.rulesKey;

  broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
}

function onAddBot(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room || client.id !== room.hostId || room.started) return;
  if (room.players.length >= 8) return;

  const botNames = ['Nova', 'Rift', 'Echo', 'Vex', 'Zephyr', 'Onyx', 'Pixel'];
  const botAvatars = ['🤖', '👾', '🦊', '🐲', '🦉', '🐺', '👽'];
  const botIdx = room.players.filter(p => p.isBot).length;

  room.players.push({
    id: 'bot-' + genId(),
    name: botNames[botIdx % botNames.length],
    avatar: botAvatars[botIdx % botAvatars.length],
    isBot: true,
    connected: true
  });
  broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
}

function onRemoveBot(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room || client.id !== room.hostId || room.started) return;
  room.players = room.players.filter(p => p.id !== msg.botId);
  broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
}

function onKick(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room || client.id !== room.hostId || room.started) return;
  const target = room.players.find(p => p.id === msg.playerId);
  if (!target || target.isBot) return;

  room.players = room.players.filter(p => p.id !== target.id);
  const c = clients.get(target.id);
  if (c) {
    c.roomCode = null;
    send(c.ws, { type: 'kicked', reason: 'Removed by the host' });
  }
  broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
}

function onStart(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room || client.id !== room.hostId || room.started) return;
  if (room.players.length < 2) return;

  room.state = msg.state;
  room.started = true;
  broadcast(room, {
    type: 'game_start',
    state: room.state,
    rulesKey: room.rulesKey
  });
}

// ── FIX 4: host cancels a running match and returns everyone to the room
function onCancelGame(client) {
  const room = rooms.get(client.roomCode);
  if (!room || client.id !== room.hostId) return;
  if (!room.started) return;
  room.started = false;
  room.state = null;
  broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
}

function onStateUpdate(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room || client.id !== room.hostId) return;
  room.state = msg.state;
  broadcast(room, {
    type: 'state_update',
    state: room.state
  }, client.id);
}

function onAction(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room || !room.started) return;
  const host = clients.get(room.hostId);
  if (!host || !host.ws) return;
  send(host.ws, {
    type: 'action',
    fromId: client.id,
    fromName: client.name,
    action: msg.action
  });
}

function onChat(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  const text = String(msg.text || '').slice(0, 240).trim();
  if (!text) return;
  broadcast(room, {
    type: 'chat',
    from: client.id,
    name: client.name,
    avatar: client.avatar,
    text,
    ts: Date.now()
  });
}

function onEmote(client, msg) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  broadcast(room, {
    type: 'emote',
    from: client.id,
    name: client.name,
    emoji: String(msg.emoji || '').slice(0, 4),
    ts: Date.now()
  }, client.id);
}

httpServer.listen(PORT, () => {
  console.log('');
  console.log('  RuleVerse relay running');
  console.log('  → http://localhost:' + PORT);
  console.log('  → On your LAN: http://<your-ip>:' + PORT);
  console.log('');
});