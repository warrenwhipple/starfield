import { describe, expect, it } from 'vitest';

import { StarfieldSimulation, type GameStarDefinition } from './simulation';

const TEST_STARS: GameStarDefinition[] = [
  { id: 'sol', name: 'Sol', nx: 0.1, ny: 0.2, buildRate: 1 },
  { id: 'deneb', name: 'Deneb', nx: 0.8, ny: 0.2, buildRate: 1 },
  { id: 'orion', name: 'Orion', nx: 0.25, ny: 0.2, buildRate: 1 },
];

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

  it('launches a probe that bootstraps a new starbase on arrival', () => {
    const simulation = new StarfieldSimulation(TEST_STARS);

    simulation.advanceBy(14);
    expect(simulation.getStar('sol')?.starbase?.probeStock).toBe(1);
    expect(simulation.getStar('orion')?.starbase).toBeNull();

    const result = simulation.launchProbe('sol', 'orion');
    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('Expected probe launch to succeed.');
    }

    expect(simulation.getStar('sol')?.starbase?.probeStock).toBe(0);
    expect(simulation.getInFlightProbes()).toHaveLength(1);

    simulation.advanceBy(result.flight.timeArrival - simulation.time);

    expect(simulation.getInFlightProbes()).toHaveLength(0);
    expect(simulation.getStar('orion')?.starbase).toMatchObject({
      owner: 'player',
      isHomeworld: false,
      level: 1,
    });
  });
});
