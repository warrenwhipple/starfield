# Starfield

A minimal single-player real-time space conquest game. DES engine, Pixi.js rendering, TypeScript.

## Stack

- TypeScript (strict mode), Pixi.js, Vite, Vitest
- No backend, no mobile layout, no sound — browser desktop only

## Development Workflow

This repo is developed primarily via Cursor cloud agents, reviewed asynchronously on a phone. Design for this:

- **Every task should produce visible output.** If the agent changes game logic, it should also produce a visual change the video recording can capture. Pure refactors are fine but should be explicitly requested.
- **Keep the dev server startable with `npm run dev`.** No complex build steps, no Docker, no env vars beyond what's in the repo. The cloud VM needs to boot and serve the game with zero manual setup.
- **Small PRs over large ones.** Each agent run should be one feature or one mechanic. "Add probe launch animation" not "implement all unit types."
- **Test visually first, unit test second.** Vitest tests are welcome but the primary validation is: does it look and feel right in the browser? Use the video recording to demonstrate.

## Game Concept

Two players (human vs scripted AI) compete on a 2D star map. Each starts with a homeworld starbase. Build probes to colonize empty stars, missiles to attack enemy starbases. Win by destroying the opponent's homeworld.

The core strategic hook: all information and instructions travel at light speed (1c). You see distant stars as they were, not as they are. Your commands to remote starbases arrive with delay. This is not implemented in v1 (god view for now) but the engine must carry spatial + temporal data on every event so fog-of-war can be layered in without rewriting anything.

## Entities

**Star** — A fixed position on the 2D map. Has a `build_rate` (how fast its starbase produces things). Starts unoccupied. 15–20 stars, hard-coded layout.

**Starbase** — Built on a star when a probe arrives. Has a level (starts at 1 after bootstrap). Stores probes, missiles, and defenses. Builds one item at a time according to its build policy.

**Probe** — Travels to a target star. If the star is empty, bootstraps a new starbase (level 0 → 1). If friendly, stored. If enemy level 1+, wasted. If enemy bootstrapping, both destroyed.

**Missile** — Travels to a target star. If enemy starbase has defense, defense reduced by 1. If no defense, starbase level and all stores halved (rounded down). If friendly, stored.

**Homeworld** — A special starbase that cannot be rebuilt. Losing your homeworld = losing the game.

## Build System

Each starbase has a build policy: four focus integers (upgrade, defense, probe, missile) defaulting to `1,1,1,1`. The starbase tries to maintain stockpiles in the ratio of these focus values. Tiebreaker priority: upgrade > defense > probe > missile.

Build durations:
- `build_duration = cost / star_build_rate`
- `upgrade_cost(level → level+1) = 4 + level`
- `bootstrap_cost = 8` (probe arriving at empty star)
- `probe_cost = 6`
- `defense_cost = 3`
- `missile_cost = 4`

Starbase levels go from 1 to 6. Higher level = faster shots.

## Launch Policies

Each starbase has a probe policy and a missile policy, each set to one of:

**Probe policy** (choose one):
- Stockpile — hold all probes
- Expand — launch one at nearest visibly empty, untargeted star
- Target — launch all at a specific target star

**Missile policy** (choose one):
- Stockpile — hold all missiles
- Auto kill — launch enough to kill nearest visibly enemy star
- Auto overkill — launch all at nearest visible enemy star
- Target — launch all at a specific target star

## Player Actions

At homeworld (instant):
- Change build policy focus ratios
- Launch probe at target star
- Launch missile at target star

Remote starbase instructions (travel at 1c):
- Change build policy
- Change probe policy
- Change missile policy
- Immediate launch orders

## Travel

- `c = 1.0` (light speed, also instruction travel speed)
- `shot_speed(level) = c * (1 - 0.85^level)`
- Shots are invisible to opponents during travel
- All stars initially visible as unoccupied

## Win Condition

Only one player's homeworld starbase remains.

## AI Opponent

Simple scripted AI. Does not need to be smart — just needs to play: expand to nearby stars, build missiles when it has starbases, attack when it has numerical advantage. Good enough to test the game loop.

## Architecture

**DES Engine** (pure logic, no rendering):
- Event queue with timestamps, not tick-based
- Events carry spatial + temporal data (position, time of origin, time of arrival)
- `arrival_time = distance / speed`
- Simulation clock advances to next event
- Pattern reference: `atjn/blockchain-visualizer` — EventQueue, distance-based scheduling, sim → draw separation

**Game State** (read by renderer):
- Stars, starbases, in-flight entities, player resources
- Observation/state separation from day one (reference: `SimonLucas/planet-wars-rts` — observation interfaces)

**Renderer** (Pixi.js, reads state, draws):
- Stars as glowing sprites on a dark field
- Animated travel paths for probes and missiles
- Visual feedback for launches, arrivals, impacts
- Should feel like a game, not a debug view

**UI Controls:**
- Time is paused by default. Player plans, then advances.
- Play / pause / fast-forward to next event
- Click star to select, see info, issue commands
- Homeworld control panel for build policy

## v1 Boundaries

- God view — player sees all state. No fog of war yet. But engine data supports adding it.
- No multiplayer. Single player vs AI.
- No sound. No mobile layout.
- Homeworld-only player actions in v1. Remote policy changes are a stretch goal.
- Hard-coded star layout. No procedural generation.

## Current Status

- Empty Vite + vanilla-TS repo from `npm create vite`
- No game code yet

## Suggested Build Order

Each of these is roughly one cloud agent task:

1. **Canvas** — Get Pixi.js rendering a dark background with a starfield of small dots. Confirm dev server works.
2. **Stars** — Render 15–20 hard-coded star positions as glowing sprites. Click a star to see its name/info in a tooltip or panel.
3. **DES Engine** — Implement EventQueue, Event types, simulation clock. Pure logic module with Vitest tests. No rendering yet.
4. **Homeworld** — Mark one star as player homeworld, one as AI homeworld. Render them distinctly. Add a build rate display.
5. **Build Loop** — Homeworld produces probes/missiles/defenses per build policy. Show stockpile counts on the star info panel. Time controls (pause/play/fast-forward).
6. **Probe Launch** — Player clicks a star to launch a probe from homeworld. Animate the probe traveling across the map. On arrival, bootstrap a starbase.
7. **Missile Launch** — Same as probe but with missile mechanics (damage on arrival).
8. **AI Player** — Scripted AI that expands and attacks. Game loop: two players competing.
9. **Polish** — Launch effects, impact effects, better star rendering, game over screen.
10. **Remote Policies** — Stretch: set build/launch policies on remote starbases via delayed instructions.