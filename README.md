# Trivex Game

Three browser 3D games built with Three.js. No build step: it is a static site, so it deploys on Vercel as-is.

| Path | Game |
| --- | --- |
| `/` | **Ranabhumi**: ancient-weapons battle royale (swords, spears, maces, bows), 12 warriors, shrinking zone, online rooms with friends |
| `/fight/` | **Raksha Rana**: 3D Angampora fighting game with story mode, versus CPU and 2-player duel |
| `/neon-rift/` | **Neon Rift**: neon endless flyer |

## Play online with friends (Ranabhumi)

1. One player clicks **Host Online Room** and shares the 5-letter code (or the invite link).
2. Friends type the code and click **Join Room**.
3. The host clicks **Start Match**. Empty slots are filled with bots up to 12.

Multiplayer is peer-to-peer (WebRTC through [PeerJS](https://peerjs.com)). The host's browser runs the match, so no game server is needed. If a friend cannot connect on a strict network (some office or mobile networks block peer-to-peer), try another network.

## Controls (Ranabhumi)

`W A S D` move · mouse look · left click attack · `Shift` sprint · `Space` jump · `E` pick up · `1` `2` / `Q` switch weapon · `Esc` release mouse

## Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this repository.
2. Framework preset: **Other**. Leave build command and output directory empty.
3. Click **Deploy**. Every push to `main` redeploys automatically.

## Run locally

Serve the folder with any static server, for example `npx serve .` or `python3 -m http.server`, then open `http://localhost:8000` (opening the file directly works for the fighting and flying games, but the battle royale loads `game.js` as a module, which needs a server).
