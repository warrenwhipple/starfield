# AGENTS.md

## Cursor Cloud specific instructions

**Project:** Starfield — a Vite + TypeScript browser game (Pixi.js). No backend, no Docker, no external services.

**Running the app:** `npm run dev` starts the Vite dev server on `http://localhost:5173`. Use `-- --host 0.0.0.0` if you need external access.

**Lint / type-check:** `npx tsc --noEmit` — there is no ESLint config; TypeScript strict mode is the only static analysis.

**Build:** `npm run build` (runs `tsc && vite build`, outputs to `dist/`).

**Tests:** The `DESIGN.md` mentions Vitest but it is not yet configured in `package.json`. When Vitest is added, run tests with `npx vitest` or whichever script is defined.

**Visual testing is primary:** Per `DESIGN.md`, the preferred validation method is visual — record a demo video showing the feature working in the browser. Unit tests are secondary.

**No git hooks or pre-commit checks** are configured.
