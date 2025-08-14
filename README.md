# Love Letter — Next.js + Socket.IO

## Quick start
```bash
npm install
npm run dev
# open http://localhost:3000
```

### Game features
- Lobby: create/join by code
- Full rules: Guard guess, Priest private reveal, Baron compare, Handmaid protect, Prince discard/replace (Princess elimination), King swap, Countess constraint, Princess self-eliminate
- Round scoring & elimination
- Chat

### File map
- pages/api/socket.ts — server logic (Socket.IO, rules)
- pages/index.tsx — lobby
- pages/game/[code].tsx — game table UI
- lib/socket.js — client socket singleton
- public/cards/*.png — placeholder card art
- styles/global.css — light styling
