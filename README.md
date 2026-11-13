# Evolving The Machine

A retro arcade journey through eight stages in which an AI companion learns from you, befriends you, and finally turns on you. Each stage reimagines a classic arcade genre, rendered on an HTML5 canvas inside a React app.

## Stages

| # | Stage | Genre |
|---|-------|-------|
| 1 | Pong Master | Paddle duel against an adaptive AI |
| 2 | Temple Breaker | Brick breaker whose paddle evolves mid-level |
| 3 | Asteroid Hunter | Asteroids-style space shooter |
| 4 | Defender | Side-scrolling shooter: protect civilians |
| 5 | Lasat Starfighter | Wave shooter with a boss and finale |
| 6 | Dance Interlude | Rhythm interlude (Space skips) |
| 7 | Space Battle | Fleet combat and a capital-ship boss |
| 8 | The Betrayal | Final boss fight against the AI |

Progress unlocks the next stage. On `localhost`, stages unlock as you play; deployed builds unlock all stages.

## Quick Start

Requires Node.js 20 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5000
```

Dev shortcuts:

- `?unlock=all` unlocks every stage
- `?stage=N` jumps straight to stage N (1–8)
- `unlockAllLevels()` in the browser console does the same as `?unlock=all`

To test on a phone on the same network, run `npm run dev -- --host`.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build into `dist/public` |
| `npm start` | Preview the production build |
| `npm test` | Jest test suite |
| `npm run lint` | ESLint |
| `npm run check` | TypeScript type check |

## Controls

- **Keyboard:** WASD / arrow keys to move, Space to fire; stage-specific abilities on Z, X and C
- **Touch:** each stage maps taps and drags to movement and firing (see the in-game tutorial)

## Architecture

```
client/src/
├── components/        React UI: menus, HUD, GameCanvas, error boundaries
├── hooks/             React hooks
└── lib/
    ├── games/         One class per stage, all extending BaseGame
    │   ├── BaseGame.ts    Game loop, keyboard input, shared services
    │   └── engine/        Settings, audio, haptics, ScreenShake,
    │                      FlashExplosions, collision helpers
    ├── stores/        Zustand stores (game progress, settings, audio, haptics)
    ├── controls/      Touch controls (virtual stick)
    └── utils/         ParticleSystem, AssetLoader, PerformanceMonitor, ...
shared/types.ts        Types shared across the client
```

`GameCanvas` lazy-loads the class for the current stage, sizes the canvas, and forwards pointer events. Each game implements `init`, `update` and `render`, reads held keys from `this.keys`, and uses `BaseGame` helpers for sound, haptics, settings and screen shake. Player settings such as reduce motion, screen shake and haptics are applied by these helpers, so individual games don't need to check them.

More detail lives in [`docs/`](docs/), including the [architecture overview](docs/ARCHITECTURE.md), [development guide](docs/DEVELOPMENT_GUIDE.md) and the narrative design notes.

## Deployment

Netlify builds with `npm run build` and serves `dist/public` as a static site (see `netlify.toml`). CI (`.github/workflows/ci.yml`) type-checks, lints, tests and builds every push to `main`.
