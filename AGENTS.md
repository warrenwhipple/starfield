# Starfield

## Cursor Cloud specific instructions

**Product:** Single-player real-time space conquest browser game (TypeScript + Pixi.js + Vite). Purely frontend — no backend, no database, no Docker, no environment variables.

**Services:**

| Service | Command | Notes |
|---|---|---|
| Dev server | `npm run dev -- --host 0.0.0.0` | Vite HMR on port 5173. Use `--host` so the browser can reach it. |

**Lint / Type-check / Build / Dev:**

- Lint (type-check): `npx tsc --noEmit` — strict mode TypeScript is the only linter configured.
- Build: `npm run build` (runs `tsc && vite build`).
- Dev: `npm run dev` — starts Vite dev server with HMR.
- No test framework is installed yet (Vitest is planned per `DESIGN.md` but not in `package.json`).

**Visual testing:** Per `DESIGN.md`, primary validation is visual — "does it look and feel right in the browser?" Use the dev server + browser to verify changes. Video recordings are the preferred evidence.
