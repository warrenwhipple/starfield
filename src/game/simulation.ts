import { SimulationClock, createTravelEvent, type SimulationEvent } from '../des';

export type PlayerId = 'player' | 'ai';
export type BuildItem = 'upgrade' | 'defense' | 'probe' | 'missile';

export type BuildFocus = Record<BuildItem, number>;

export type GameStarDefinition = {
  id: string;
  name: string;
  nx: number;
  ny: number;
  buildRate: number;
};

type BuildCompleteEvent = SimulationEvent<
  'build-complete',
  {
    starId: string;
    item: BuildItem;
  }
>;

type ProbeArrivalEvent = SimulationEvent<
  'probe-arrival',
  {
    owner: PlayerId;
    fromStarId: string;
    toStarId: string;
  }
>;

export type GameEvent = BuildCompleteEvent | ProbeArrivalEvent;

export type ActiveBuild = {
  item: BuildItem;
  completesAt: number;
};

export type StarbaseState = {
  owner: PlayerId;
  isHomeworld: boolean;
  level: number;
  probeStock: number;
  missileStock: number;
  defenseStock: number;
  buildFocus: BuildFocus;
  activeBuild: ActiveBuild | null;
};

export type StarState = {
  id: string;
  name: string;
  nx: number;
  ny: number;
  buildRate: number;
  starbase: StarbaseState | null;
};

export type ProbeFlight = {
  id: string;
  owner: PlayerId;
  fromStarId: string;
  toStarId: string;
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  timeOrigin: number;
  timeArrival: number;
};

export type EventLogEntry = {
  time: number;
  message: string;
};

export type LaunchProbeResult =
  | {
      ok: true;
      flight: ProbeFlight;
    }
  | {
      ok: false;
      reason: string;
    };

const LIGHT_SPEED = 1;
const MAX_STARBASE_LEVEL = 6;
const HOMEWORLD_IDS = {
  player: 'sol',
  ai: 'deneb',
} as const;

const BUILD_PRIORITY: BuildItem[] = ['upgrade', 'defense', 'probe', 'missile'];

function createDefaultBuildFocus(): BuildFocus {
  return {
    upgrade: 1,
    defense: 1,
    probe: 1,
    missile: 1,
  };
}

function createStarbase(owner: PlayerId, isHomeworld: boolean): StarbaseState {
  return {
    owner,
    isHomeworld,
    level: 1,
    probeStock: 0,
    missileStock: 0,
    defenseStock: 0,
    buildFocus: createDefaultBuildFocus(),
    activeBuild: null,
  };
}

function getProbeSpeed(level: number): number {
  return LIGHT_SPEED * (1 - 0.85 ** level);
}

function getItemCount(starbase: StarbaseState, item: BuildItem): number {
  switch (item) {
    case 'upgrade':
      return starbase.level - 1;
    case 'defense':
      return starbase.defenseStock;
    case 'probe':
      return starbase.probeStock;
    case 'missile':
      return starbase.missileStock;
  }
}

function getBuildCost(starbase: StarbaseState, item: BuildItem): number {
  switch (item) {
    case 'upgrade':
      return 4 + starbase.level;
    case 'defense':
      return 3;
    case 'probe':
      return 6;
    case 'missile':
      return 4;
  }
}

function describeBuildItem(item: BuildItem): string {
  switch (item) {
    case 'upgrade':
      return 'upgrade';
    case 'defense':
      return 'defense';
    case 'probe':
      return 'probe';
    case 'missile':
      return 'missile';
  }
}

export class StarfieldSimulation {
  private readonly clock = new SimulationClock<GameEvent>();
  private readonly stars = new Map<string, StarState>();
  private readonly starOrder: string[];
  private readonly inFlightProbes = new Map<string, ProbeFlight>();
  private readonly eventLog: EventLogEntry[] = [];
  private nextEventId = 0;

  constructor(definitions: GameStarDefinition[]) {
    if (definitions.length === 0) {
      throw new Error('Simulation requires at least one star definition.');
    }

    this.starOrder = definitions.map((definition) => definition.id);

    for (const definition of definitions) {
      if (this.stars.has(definition.id)) {
        throw new Error(`Duplicate star id "${definition.id}".`);
      }

      this.stars.set(definition.id, {
        ...definition,
        starbase: null,
      });
    }

    this.seedHomeworld(HOMEWORLD_IDS.player, 'player');
    this.seedHomeworld(HOMEWORLD_IDS.ai, 'ai');
  }

  get time(): number {
    return this.clock.time;
  }

  get pendingEventCount(): number {
    return this.clock.pendingEventCount;
  }

  get playerHomeworldId(): string {
    return HOMEWORLD_IDS.player;
  }

  get aiHomeworldId(): string {
    return HOMEWORLD_IDS.ai;
  }

  getStars(): StarState[] {
    return this.starOrder.map((starId) => {
      const star = this.requireStar(starId);
      return {
        ...star,
        starbase: star.starbase
          ? {
              ...star.starbase,
              buildFocus: { ...star.starbase.buildFocus },
              activeBuild: star.starbase.activeBuild ? { ...star.starbase.activeBuild } : null,
            }
          : null,
      };
    });
  }

  getStar(starId: string): StarState | undefined {
    const star = this.stars.get(starId);
    if (!star) {
      return undefined;
    }

    return {
      ...star,
      starbase: star.starbase
        ? {
            ...star.starbase,
            buildFocus: { ...star.starbase.buildFocus },
            activeBuild: star.starbase.activeBuild ? { ...star.starbase.activeBuild } : null,
          }
        : null,
    };
  }

  getInFlightProbes(): ProbeFlight[] {
    return [...this.inFlightProbes.values()].sort((left, right) => left.timeArrival - right.timeArrival);
  }

  getRecentLog(): EventLogEntry[] {
    return [...this.eventLog];
  }

  getNextEvent(): GameEvent | undefined {
    return this.clock.peekNextEvent();
  }

  advanceBy(deltaTime: number): GameEvent[] {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return [];
    }

    return this.clock.runUntil(this.clock.time + deltaTime, (event) => {
      this.handleEvent(event);
    });
  }

  advanceToNextEvent(): GameEvent | undefined {
    const nextEvent = this.clock.peekNextEvent();
    if (!nextEvent) {
      return undefined;
    }

    this.clock.runUntil(nextEvent.timeArrival, (event) => {
      this.handleEvent(event);
    });
    return nextEvent;
  }

  launchProbe(fromStarId: string, toStarId: string): LaunchProbeResult {
    if (fromStarId === toStarId) {
      return {
        ok: false,
        reason: 'Select a different target star.',
      };
    }

    const originStar = this.stars.get(fromStarId);
    const targetStar = this.stars.get(toStarId);
    if (!originStar || !targetStar || !originStar.starbase) {
      return {
        ok: false,
        reason: 'Probe launch path is invalid.',
      };
    }

    if (originStar.starbase.probeStock <= 0) {
      return {
        ok: false,
        reason: `${originStar.name} has no probes ready.`,
      };
    }

    originStar.starbase.probeStock -= 1;

    const event = createTravelEvent({
      id: this.createEventId('probe'),
      type: 'probe-arrival',
      origin: { x: originStar.nx, y: originStar.ny },
      destination: { x: targetStar.nx, y: targetStar.ny },
      timeOrigin: this.clock.time,
      speed: getProbeSpeed(originStar.starbase.level),
      payload: {
        owner: originStar.starbase.owner,
        fromStarId,
        toStarId,
      },
    });

    const flight: ProbeFlight = {
      id: event.id,
      owner: event.payload.owner,
      fromStarId,
      toStarId,
      origin: event.origin,
      destination: event.destination,
      timeOrigin: event.timeOrigin,
      timeArrival: event.timeArrival,
    };

    this.inFlightProbes.set(flight.id, flight);
    this.clock.schedule(event);
    this.log(
      `${originStar.name} launched a probe toward ${targetStar.name}; arrival @ t=${event.timeArrival.toFixed(2)}`
    );

    return { ok: true, flight };
  }

  private seedHomeworld(starId: string, owner: PlayerId) {
    const star = this.requireStar(starId);
    star.starbase = createStarbase(owner, true);
    this.scheduleNextBuild(starId);
    this.log(`${star.name} established as ${owner === 'player' ? 'player' : 'AI'} homeworld.`);
  }

  private scheduleNextBuild(starId: string) {
    const star = this.requireStar(starId);
    const starbase = star.starbase;
    if (!starbase || starbase.activeBuild) {
      return;
    }

    const nextItem = this.chooseNextBuild(starbase);
    const event: BuildCompleteEvent = {
      id: this.createEventId('build'),
      type: 'build-complete',
      origin: { x: star.nx, y: star.ny },
      destination: { x: star.nx, y: star.ny },
      timeOrigin: this.clock.time,
      timeArrival: this.clock.time + getBuildCost(starbase, nextItem) / star.buildRate,
      payload: {
        starId,
        item: nextItem,
      },
    };

    starbase.activeBuild = {
      item: nextItem,
      completesAt: event.timeArrival,
    };
    this.clock.schedule(event);
  }

  private chooseNextBuild(starbase: StarbaseState): BuildItem {
    let selected: BuildItem | null = null;
    let selectedRatio = Number.POSITIVE_INFINITY;

    for (const item of BUILD_PRIORITY) {
      if (item === 'upgrade' && starbase.level >= MAX_STARBASE_LEVEL) {
        continue;
      }

      const ratio = getItemCount(starbase, item) / starbase.buildFocus[item];
      if (ratio < selectedRatio) {
        selectedRatio = ratio;
        selected = item;
      }
    }

    if (!selected) {
      return 'defense';
    }

    return selected;
  }

  private handleEvent(event: GameEvent) {
    switch (event.type) {
      case 'build-complete':
        this.handleBuildComplete(event);
        break;
      case 'probe-arrival':
        this.handleProbeArrival(event);
        break;
    }
  }

  private handleBuildComplete(event: BuildCompleteEvent) {
    const star = this.requireStar(event.payload.starId);
    const starbase = star.starbase;
    if (!starbase) {
      return;
    }

    starbase.activeBuild = null;

    switch (event.payload.item) {
      case 'upgrade':
        starbase.level = Math.min(MAX_STARBASE_LEVEL, starbase.level + 1);
        this.log(`${star.name} upgraded to level ${starbase.level}.`);
        break;
      case 'defense':
        starbase.defenseStock += 1;
        this.log(`${star.name} completed 1 defense stockpile.`);
        break;
      case 'probe':
        starbase.probeStock += 1;
        this.log(`${star.name} completed 1 probe.`);
        break;
      case 'missile':
        starbase.missileStock += 1;
        this.log(`${star.name} completed 1 missile.`);
        break;
    }

    this.scheduleNextBuild(event.payload.starId);
  }

  private handleProbeArrival(event: ProbeArrivalEvent) {
    this.inFlightProbes.delete(event.id);

    const targetStar = this.requireStar(event.payload.toStarId);
    if (!targetStar.starbase) {
      targetStar.starbase = createStarbase(event.payload.owner, false);
      this.scheduleNextBuild(targetStar.id);
      this.log(`${targetStar.name} was colonized by a probe and now has a level 1 starbase.`);
      return;
    }

    if (targetStar.starbase.owner === event.payload.owner) {
      targetStar.starbase.probeStock += 1;
      this.log(`${targetStar.name} received a friendly probe into storage.`);
      return;
    }

    this.log(`${targetStar.name} rejected an enemy probe; the probe was lost.`);
  }

  private log(message: string) {
    this.eventLog.unshift({
      time: this.clock.time,
      message,
    });

    if (this.eventLog.length > 8) {
      this.eventLog.length = 8;
    }
  }

  private createEventId(prefix: string): string {
    this.nextEventId += 1;
    return `${prefix}-${this.nextEventId}`;
  }

  private requireStar(starId: string): StarState {
    const star = this.stars.get(starId);
    if (!star) {
      throw new Error(`Unknown star "${starId}".`);
    }

    return star;
  }
}

export { describeBuildItem, getProbeSpeed };
