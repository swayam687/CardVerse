# RuleVerse Relay Server

Serves the client + relays multiplayer messages.

## Setup

```bash
cd server
npm install
npm start



Play with friends on the same WiFi
Find your LAN IP:

Mac/Linux: ifconfig | grep "inet " or ip addr

Windows: ipconfig → look for IPv4 Address

Friends open http://<your-ip>:8080 on their device.

Host creates a room, shares the code, everyone joins.

Play over the internet
Deploy the whole CardVerse/ folder to any Node host:

Railway: railway up

Fly.io: fly launch

Render: point at the repo, cd server && npm install && npm start

ngrok (quick): ngrok http 8080 → share the public URL

The server serves static files and the relay from one process.