import { describe, expect, it } from 'vitest';

import { StarfieldSimulation, type GameStarDefinition } from './simulation';

const TEST_STARS: GameStarDefinition[] = [
  { id: 'sol', name: 'Sol', nx: 0.1, ny: 0.2, buildRate: 1 },
  { id: 'deneb', name: 'Deneb', nx: 0.8, ny: 0.2, buildRate: 1 },
  { id: 'orion', name: 'Orion', nx: 0.25, ny: 0.2, buildRate: 1 },
  { id: 'lyra', name: 'Lyra', nx: 0.4, ny: 0.5, buildRate: 1 },
];

function requireFlightTime(simulation: StarfieldSimulation) {
  const flight = simulation.getInFlightInstructions()[0];
  if (!flight) {
    throw new Error('Expected one in-flight instruction.');
  }

  return flight.timeArrival - simulation.time;
}

describe('StarfieldSimulation', () => {
  it('cycles the homeworld build queue by policy priority', () => {
    const simulation = new StarfieldSimulation(TEST_STARS);

    expect(simulation.getStar('sol')?.starbase?.activeBuild?.item).toBe('upgrade');

    simulation.advanceBy(5);
    expect(simulation.getStar('sol')?.starbase?.level).toBe(2);
    expect(simulation.getStar('sol')?.starbase?.activeBuild?.item).toBe('defense');

    simulation.advanceBy(3);
    expect(simulation.getStar('sol')?.starbase?.defenseStock).toBe(1);
    expect(simulation.getStar('sol')?.starbase?.activeBuild?.item).toBe('probe');

    simulation.advanceBy(6);
    expect(simulation.getStar('sol')?.starbase?.probeStock).toBe(1);
    expect(simulation.getStar('sol')?.starbase?.activeBuild?.item).toBe('missile');
  });

  it('launches a probe that bootstraps before the new starbase comes online', () => {
    const simulation = new StarfieldSimulation(TEST_STARS);

    simulation.advanceBy(14);
    expect(simulation.getStar('sol')?.starbase?.probeStock).toBe(1);
    expect(simulation.getStar('orion')?.starbase).toBeNull();

    const result = simulation.launchProbe('sol', 'orion');
    expect(result.ok).toBe(true);

    if (!result.ok || !result.flight) {
      throw new Error('Expected probe launch to succeed.');
    }

    simulation.advanceBy(result.flight.timeArrival - simulation.time);

    expect(
      simulation
        .getInFlightProbes()
        .filter((flight) => flight.owner === 'player' && flight.toStarId === 'orion')
    ).toHaveLength(0);
    expect(simulation.getStar('orion')?.starbase).toMatchObject({
      owner: 'player',
      isHomeworld: false,
      isBootstrapping: true,
      level: 0,
    });

    simulation.advanceBy(8);

    expect(simulation.getStar('orion')?.starbase).toMatchObject({
      owner: 'player',
      isHomeworld: false,
      isBootstrapping: false,
      level: 1,
    });
  });

  it('delays remote commands until the instruction packet arrives', () => {
    const simulation = new StarfieldSimulation(TEST_STARS);

    simulation.advanceBy(14);
    const colonize = simulation.launchProbe('sol', 'orion');
    if (!colonize.ok || !colonize.flight) {
      throw new Error('Expected colonization probe launch to succeed.');
    }

    simulation.advanceBy(colonize.flight.timeArrival - simulation.time + 8);
    expect(simulation.getStar('orion')?.starbase?.buildFocus.probe).toBe(1);

    const result = simulation.setBuildFocus('orion', {
      upgrade: 1,
      defense: 1,
      probe: 3,
      missile: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.delayed).toBe(true);
    expect(simulation.getStar('orion')?.starbase?.buildFocus.probe).toBe(1);

    simulation.advanceBy(requireFlightTime(simulation));

    expect(simulation.getStar('orion')?.starbase?.buildFocus.probe).toBe(3);
  });

  it('fires auto-kill missiles as soon as a kill shot is available', () => {
    const duelStars: GameStarDefinition[] = [
      { id: 'sol', name: 'Sol', nx: 0.1, ny: 0.2, buildRate: 20 },
      { id: 'deneb', name: 'Deneb', nx: 0.4, ny: 0.2, buildRate: 1 },
    ];
    const simulation = new StarfieldSimulation(duelStars);

    const result = simulation.setMissilePolicy('sol', { mode: 'auto-kill' });
    expect(result.ok).toBe(true);

    simulation.advanceBy(1);

    expect(simulation.getInFlightMissiles()).toHaveLength(1);
  });

  it('resolves missile attacks and ends the game when a homeworld is destroyed', () => {
    const duelStars: GameStarDefinition[] = [
      { id: 'sol', name: 'Sol', nx: 0.1, ny: 0.2, buildRate: 20 },
      { id: 'deneb', name: 'Deneb', nx: 0.4, ny: 0.2, buildRate: 8 },
    ];
    const simulation = new StarfieldSimulation(duelStars);

    const policyResult = simulation.setMissilePolicy('sol', { mode: 'target', targetStarId: 'deneb' });
    expect(policyResult.ok).toBe(true);

    for (let step = 0; step < 240 && !simulation.isGameOver(); step += 1) {
      simulation.advanceBy(0.25);
    }

    expect(simulation.getRecentLog().some((entry) => entry.message.includes('launched a missile'))).toBe(
      true
    );
    expect(simulation.winner).toBe('player');
    expect(simulation.isGameOver()).toBe(true);
    expect(simulation.gameOverReason).toMatch(/Victory/);
  });

  it('lets the AI expand to nearby neutral stars', () => {
    const simulation = new StarfieldSimulation(TEST_STARS);

    simulation.advanceBy(40);

    expect(simulation.getStar('lyra')?.starbase?.owner).toBe('ai');
  });
});
