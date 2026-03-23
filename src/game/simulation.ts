import { SimulationClock, createTravelEvent, type SimulationEvent } from '../des';

export type PlayerId = 'player' | 'ai';
export type BuildItem = 'upgrade' | 'defense' | 'probe' | 'missile';
export type ProductionItem = BuildItem | 'bootstrap';
export type BuildFocus = Record<BuildItem, number>;

export type ProbePolicy =
  | { mode: 'stockpile' }
  | { mode: 'expand' }
  | { mode: 'target'; targetStarId: string };

export type MissilePolicy =
  | { mode: 'stockpile' }
  | { mode: 'auto-kill' }
  | { mode: 'auto-overkill' }
  | { mode: 'target'; targetStarId: string };

export type RemoteInstruction =
  | { kind: 'set-build-focus'; focus: BuildFocus }
  | { kind: 'set-probe-policy'; policy: ProbePolicy }
  | { kind: 'set-missile-policy'; policy: MissilePolicy }
  | { kind: 'launch-probe'; targetStarId: string }
  | { kind: 'launch-missile'; targetStarId: string };

type LaunchInstruction = Extract<
  RemoteInstruction,
  { kind: 'launch-probe' | 'launch-missile' }
>;

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
    item: ProductionItem;
    generation: number;
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

type MissileArrivalEvent = SimulationEvent<
  'missile-arrival',
  {
    owner: PlayerId;
    fromStarId: string;
    toStarId: string;
  }
>;

type InstructionArrivalEvent = SimulationEvent<
  'instruction-arrival',
  {
    owner: PlayerId;
    starId: string;
    instruction: RemoteInstruction;
  }
>;

export type GameEvent =
  | BuildCompleteEvent
  | ProbeArrivalEvent
  | MissileArrivalEvent
  | InstructionArrivalEvent;

export type ActiveBuild = {
  item: ProductionItem;
  completesAt: number;
};

export type StarbaseState = {
  owner: PlayerId;
  isHomeworld: boolean;
  isBootstrapping: boolean;
  level: number;
  probeStock: number;
  missileStock: number;
  defenseStock: number;
  buildFocus: BuildFocus;
  probePolicy: ProbePolicy;
  missilePolicy: MissilePolicy;
  activeBuild: ActiveBuild | null;
};

type MutableStarbaseState = StarbaseState & {
  buildGeneration: number;
};

export type StarState = {
  id: string;
  name: string;
  nx: number;
  ny: number;
  buildRate: number;
  homeworldOwner: PlayerId | null;
  starbase: StarbaseState | null;
};

type MutableStarState = Omit<StarState, 'starbase'> & {
  starbase: MutableStarbaseState | null;
  nextGeneration: number;
};

type BaseFlight = {
  id: string;
  owner: PlayerId;
  fromStarId: string;
  toStarId: string;
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  timeOrigin: number;
  timeArrival: number;
};

export type ProbeFlight = BaseFlight;
export type MissileFlight = BaseFlight;

export type InstructionFlight = {
  id: string;
  owner: PlayerId;
  starId: string;
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  timeOrigin: number;
  timeArrival: number;
  instruction: RemoteInstruction;
};

export type EventLogEntry = {
  time: number;
  message: string;
};

export type CommandResult<TFlight = ProbeFlight | MissileFlight | InstructionFlight> =
  | {
      ok: true;
      delayed: boolean;
      message: string;
      flight?: TFlight;
    }
  | {
      ok: false;
      reason: string;
    };

const LIGHT_SPEED = 1;
const MAX_STARBASE_LEVEL = 6;
const BOOTSTRAP_COST = 8;
const HOMEWORLD_IDS = {
  player: 'sol',
  ai: 'deneb',
} as const;
const BUILD_PRIORITY: BuildItem[] = ['upgrade', 'defense', 'probe', 'missile'];
const STOCKPILE_PROBE_POLICY: ProbePolicy = { mode: 'stockpile' };
const EXPAND_PROBE_POLICY: ProbePolicy = { mode: 'expand' };
const STOCKPILE_MISSILE_POLICY: MissilePolicy = { mode: 'stockpile' };
const AUTO_KILL_MISSILE_POLICY: MissilePolicy = { mode: 'auto-kill' };
const AUTO_OVERKILL_MISSILE_POLICY: MissilePolicy = { mode: 'auto-overkill' };

function createDefaultBuildFocus(): BuildFocus {
  return {
    upgrade: 1,
    defense: 1,
    probe: 1,
    missile: 1,
  };
}

function cloneBuildFocus(focus: BuildFocus): BuildFocus {
  return {
    upgrade: focus.upgrade,
    defense: focus.defense,
    probe: focus.probe,
    missile: focus.missile,
  };
}

function cloneProbePolicy(policy: ProbePolicy): ProbePolicy {
  return policy.mode === 'target' ? { ...policy } : { mode: policy.mode };
}

function cloneMissilePolicy(policy: MissilePolicy): MissilePolicy {
  return policy.mode === 'target' ? { ...policy } : { mode: policy.mode };
}

function createStarbase(
  owner: PlayerId,
  isHomeworld: boolean,
  generation: number,
  isBootstrapping: boolean
): MutableStarbaseState {
  return {
    owner,
    isHomeworld,
    isBootstrapping,
    level: isBootstrapping ? 0 : 1,
    probeStock: 0,
    missileStock: 0,
    defenseStock: 0,
    buildFocus: createDefaultBuildFocus(),
    probePolicy: isHomeworld && owner === 'ai' ? EXPAND_PROBE_POLICY : STOCKPILE_PROBE_POLICY,
    missilePolicy: STOCKPILE_MISSILE_POLICY,
    activeBuild: null,
    buildGeneration: generation,
  };
}

function getShotSpeed(level: number): number {
  return LIGHT_SPEED * (1 - 0.85 ** level);
}

function getItemCount(starbase: MutableStarbaseState, item: BuildItem): number {
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

function getBuildCost(starbase: MutableStarbaseState, item: BuildItem): number {
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

function describeBuildItem(item: ProductionItem): string {
  switch (item) {
    case 'bootstrap':
      return 'bootstrap';
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

function describeProbePolicy(policy: ProbePolicy): string {
  switch (policy.mode) {
    case 'stockpile':
      return 'Stockpile';
    case 'expand':
      return 'Expand';
    case 'target':
      return `Target ${policy.targetStarId}`;
  }
}

function describeMissilePolicy(policy: MissilePolicy): string {
  switch (policy.mode) {
    case 'stockpile':
      return 'Stockpile';
    case 'auto-kill':
      return 'Auto kill';
    case 'auto-overkill':
      return 'Auto overkill';
    case 'target':
      return `Target ${policy.targetStarId}`;
  }
}

function estimateMissilesToKill(starbase: StarbaseState): number {
  if (starbase.isBootstrapping) {
    return 1;
  }

  let hits = starbase.defenseStock;
  let remainingLevel = starbase.level;
  while (remainingLevel > 0) {
    remainingLevel = Math.floor(remainingLevel / 2);
    hits += 1;
  }

  return hits;
}

function validateBuildFocus(focus: BuildFocus): string | null {
  for (const [key, value] of Object.entries(focus)) {
    if (!Number.isInteger(value) || value <= 0) {
      return `Build focus for ${key} must be a positive integer.`;
    }
  }

  return null;
}

function describeInstruction(instruction: RemoteInstruction): string {
  switch (instruction.kind) {
    case 'set-build-focus':
      return 'build policy';
    case 'set-probe-policy':
      return 'probe policy';
    case 'set-missile-policy':
      return 'missile policy';
    case 'launch-probe':
      return 'probe launch order';
    case 'launch-missile':
      return 'missile launch order';
  }
}

export class StarfieldSimulation {
  private readonly clock = new SimulationClock<GameEvent>();
  private readonly stars = new Map<string, MutableStarState>();
  private readonly starOrder: string[];
  private readonly inFlightProbes = new Map<string, ProbeFlight>();
  private readonly inFlightMissiles = new Map<string, MissileFlight>();
  private readonly inFlightInstructions = new Map<string, InstructionFlight>();
  private readonly eventLog: EventLogEntry[] = [];
  private nextEventId = 0;
  private winnerId: PlayerId | null = null;
  private endReason: string | null = null;

  constructor(definitions: GameStarDefinition[]) {
    if (definitions.length === 0) {
      throw new Error('Simulation requires at least one star definition.');
    }

    this.starOrder = definitions.map((definition) => definition.id);

    for (const definition of definitions) {
      if (this.stars.has(definition.id)) {
        throw new Error(`Duplicate star id "${definition.id}".`);
      }

      const homeworldOwner = this.getHomeworldOwner(definition.id);
      this.stars.set(definition.id, {
        ...definition,
        homeworldOwner,
        starbase: null,
        nextGeneration: 1,
      });
    }

    this.seedHomeworld(HOMEWORLD_IDS.player, 'player');
    this.seedHomeworld(HOMEWORLD_IDS.ai, 'ai');
    this.refreshAutomation();
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

  get winner(): PlayerId | null {
    return this.winnerId;
  }

  get gameOverReason(): string | null {
    return this.endReason;
  }

  isGameOver(): boolean {
    return this.winnerId !== null;
  }

  getStars(): StarState[] {
    return this.starOrder.map((starId) => this.cloneStar(this.requireStar(starId)));
  }

  getStar(starId: string): StarState | undefined {
    const star = this.stars.get(starId);
    return star ? this.cloneStar(star) : undefined;
  }

  getInFlightProbes(): ProbeFlight[] {
    return [...this.inFlightProbes.values()].sort((left, right) => left.timeArrival - right.timeArrival);
  }

  getInFlightMissiles(): MissileFlight[] {
    return [...this.inFlightMissiles.values()].sort((left, right) => left.timeArrival - right.timeArrival);
  }

  getInFlightInstructions(): InstructionFlight[] {
    return [...this.inFlightInstructions.values()].sort(
      (left, right) => left.timeArrival - right.timeArrival
    );
  }

  getRecentLog(): EventLogEntry[] {
    return [...this.eventLog];
  }

  getNextEvent(): GameEvent | undefined {
    return this.clock.peekNextEvent();
  }

  advanceBy(deltaTime: number): GameEvent[] {
    if (this.isGameOver() || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return [];
    }

    return this.clock.runUntil(this.clock.time + deltaTime, (event) => {
      this.handleEvent(event);
    });
  }

  advanceToNextEvent(): GameEvent | undefined {
    if (this.isGameOver()) {
      return undefined;
    }

    const nextEvent = this.clock.peekNextEvent();
    if (!nextEvent) {
      return undefined;
    }

    this.clock.runUntil(nextEvent.timeArrival, (event) => {
      this.handleEvent(event);
    });
    return nextEvent;
  }

  launchProbe(fromStarId: string, toStarId: string): CommandResult {
    return this.issueLaunchCommand(fromStarId, { kind: 'launch-probe', targetStarId: toStarId });
  }

  launchMissile(fromStarId: string, toStarId: string): CommandResult {
    return this.issueLaunchCommand(fromStarId, { kind: 'launch-missile', targetStarId: toStarId });
  }

  setBuildFocus(starId: string, focus: BuildFocus): CommandResult {
    const validationError = validateBuildFocus(focus);
    if (validationError) {
      return {
        ok: false,
        reason: validationError,
      };
    }

    return this.issueInstruction(starId, {
      kind: 'set-build-focus',
      focus: cloneBuildFocus(focus),
    });
  }

  setProbePolicy(starId: string, policy: ProbePolicy): CommandResult {
    return this.issueInstruction(starId, {
      kind: 'set-probe-policy',
      policy: cloneProbePolicy(policy),
    });
  }

  setMissilePolicy(starId: string, policy: MissilePolicy): CommandResult {
    return this.issueInstruction(starId, {
      kind: 'set-missile-policy',
      policy: cloneMissilePolicy(policy),
    });
  }

  private cloneStarbase(starbase: MutableStarbaseState): StarbaseState {
    return {
      owner: starbase.owner,
      isHomeworld: starbase.isHomeworld,
      isBootstrapping: starbase.isBootstrapping,
      level: starbase.level,
      probeStock: starbase.probeStock,
      missileStock: starbase.missileStock,
      defenseStock: starbase.defenseStock,
      buildFocus: cloneBuildFocus(starbase.buildFocus),
      probePolicy: cloneProbePolicy(starbase.probePolicy),
      missilePolicy: cloneMissilePolicy(starbase.missilePolicy),
      activeBuild: starbase.activeBuild ? { ...starbase.activeBuild } : null,
    };
  }

  private cloneStar(star: MutableStarState): StarState {
    return {
      id: star.id,
      name: star.name,
      nx: star.nx,
      ny: star.ny,
      buildRate: star.buildRate,
      homeworldOwner: star.homeworldOwner,
      starbase: star.starbase ? this.cloneStarbase(star.starbase) : null,
    };
  }

  private getHomeworldOwner(starId: string): PlayerId | null {
    if (starId === HOMEWORLD_IDS.player) {
      return 'player';
    }

    if (starId === HOMEWORLD_IDS.ai) {
      return 'ai';
    }

    return null;
  }

  private seedHomeworld(starId: string, owner: PlayerId) {
    const star = this.requireStar(starId);
    star.starbase = createStarbase(owner, true, star.nextGeneration++, false);
    if (owner === 'ai') {
      star.starbase.buildFocus = { upgrade: 1, defense: 1, probe: 3, missile: 1 };
      star.starbase.probePolicy = EXPAND_PROBE_POLICY;
    }
    this.scheduleNextBuild(starId);
    this.log(`${star.name} established as ${owner === 'player' ? 'player' : 'AI'} homeworld.`);
  }

  private issueLaunchCommand(fromStarId: string, instruction: LaunchInstruction): CommandResult {
    if (this.isGameOver()) {
      return {
        ok: false,
        reason: 'The game is already over.',
      };
    }

    const originStar = this.stars.get(fromStarId);
    if (!originStar?.starbase || originStar.starbase.owner !== 'player') {
      return {
        ok: false,
        reason: 'Select a player-controlled starbase first.',
      };
    }

    if (instruction.targetStarId === fromStarId) {
      return {
        ok: false,
        reason: 'Select a different target star.',
      };
    }

    if (fromStarId === this.playerHomeworldId) {
      return this.executeInstructionOnStar(originStar, instruction, true);
    }

    return this.issueInstruction(fromStarId, instruction);
  }

  private issueInstruction(starId: string, instruction: RemoteInstruction): CommandResult {
    if (this.isGameOver()) {
      return {
        ok: false,
        reason: 'The game is already over.',
      };
    }

    const targetStar = this.stars.get(starId);
    if (!targetStar?.starbase || targetStar.starbase.owner !== 'player') {
      return {
        ok: false,
        reason: 'That command can only target a player-controlled starbase.',
      };
    }

    if (starId === this.playerHomeworldId) {
      return this.executeInstructionOnStar(targetStar, instruction, true);
    }

    const homeworld = this.requireStar(this.playerHomeworldId);
    const event: InstructionArrivalEvent = createTravelEvent({
      id: this.createEventId('instruction'),
      type: 'instruction-arrival',
      origin: { x: homeworld.nx, y: homeworld.ny },
      destination: { x: targetStar.nx, y: targetStar.ny },
      timeOrigin: this.clock.time,
      speed: LIGHT_SPEED,
      payload: {
        owner: 'player' as PlayerId,
        starId,
        instruction: this.cloneInstruction(instruction),
      },
    });

    const flight: InstructionFlight = {
      id: event.id,
      owner: 'player',
      starId,
      origin: event.origin,
      destination: event.destination,
      timeOrigin: event.timeOrigin,
      timeArrival: event.timeArrival,
      instruction: this.cloneInstruction(instruction),
    };
    this.inFlightInstructions.set(flight.id, flight);
    this.clock.schedule(event);
    this.log(
      `Command packet for ${targetStar.name} carrying ${describeInstruction(instruction)} launched; arrival @ t=${event.timeArrival.toFixed(2)}`
    );

    return {
      ok: true,
      delayed: true,
      message: `Instruction en route to ${targetStar.name}.`,
      flight,
    };
  }

  private executeInstructionOnStar(
    star: MutableStarState,
    instruction: RemoteInstruction,
    isInstant: boolean
  ): CommandResult {
    const starbase = star.starbase;
    if (!starbase || starbase.owner !== 'player') {
      return {
        ok: false,
        reason: `${star.name} is no longer under player control.`,
      };
    }

    switch (instruction.kind) {
      case 'set-build-focus':
        starbase.buildFocus = cloneBuildFocus(instruction.focus);
        this.log(
          `${star.name} ${isInstant ? 'updated' : 'received'} build policy: ${instruction.focus.upgrade}/${instruction.focus.defense}/${instruction.focus.probe}/${instruction.focus.missile}.`
        );
        this.refreshAutomation();
        return {
          ok: true,
          delayed: !isInstant,
          message: `Build policy updated for ${star.name}.`,
        };
      case 'set-probe-policy':
        starbase.probePolicy = cloneProbePolicy(instruction.policy);
        this.log(
          `${star.name} ${isInstant ? 'updated' : 'received'} probe policy: ${describeProbePolicy(instruction.policy)}.`
        );
        this.refreshAutomation();
        return {
          ok: true,
          delayed: !isInstant,
          message: `Probe policy updated for ${star.name}.`,
        };
      case 'set-missile-policy':
        starbase.missilePolicy = cloneMissilePolicy(instruction.policy);
        this.log(
          `${star.name} ${isInstant ? 'updated' : 'received'} missile policy: ${describeMissilePolicy(instruction.policy)}.`
        );
        this.refreshAutomation();
        return {
          ok: true,
          delayed: !isInstant,
          message: `Missile policy updated for ${star.name}.`,
        };
      case 'launch-probe': {
        const result = this.launchProbeDirect(star.id, instruction.targetStarId, 'player');
        if (!result.ok) {
          return result;
        }
        return {
          ok: true,
          delayed: !isInstant,
          message: result.message,
          flight: result.flight,
        };
      }
      case 'launch-missile': {
        const result = this.launchMissileDirect(star.id, instruction.targetStarId, 'player');
        if (!result.ok) {
          return result;
        }
        return {
          ok: true,
          delayed: !isInstant,
          message: result.message,
          flight: result.flight,
        };
      }
    }
  }

  private cloneInstruction(instruction: RemoteInstruction): RemoteInstruction {
    switch (instruction.kind) {
      case 'set-build-focus':
        return {
          kind: 'set-build-focus',
          focus: cloneBuildFocus(instruction.focus),
        };
      case 'set-probe-policy':
        return {
          kind: 'set-probe-policy',
          policy: cloneProbePolicy(instruction.policy),
        };
      case 'set-missile-policy':
        return {
          kind: 'set-missile-policy',
          policy: cloneMissilePolicy(instruction.policy),
        };
      case 'launch-probe':
        return { ...instruction };
      case 'launch-missile':
        return { ...instruction };
    }
  }

  private scheduleBootstrap(starId: string) {
    const star = this.requireStar(starId);
    const starbase = star.starbase;
    if (!starbase || !starbase.isBootstrapping || starbase.activeBuild) {
      return;
    }

    const event: BuildCompleteEvent = {
      id: this.createEventId('bootstrap'),
      type: 'build-complete',
      origin: { x: star.nx, y: star.ny },
      destination: { x: star.nx, y: star.ny },
      timeOrigin: this.clock.time,
      timeArrival: this.clock.time + BOOTSTRAP_COST / star.buildRate,
      payload: {
        starId,
        item: 'bootstrap',
        generation: starbase.buildGeneration,
      },
    };

    starbase.activeBuild = {
      item: 'bootstrap',
      completesAt: event.timeArrival,
    };
    this.clock.schedule(event);
  }

  private scheduleNextBuild(starId: string) {
    const star = this.requireStar(starId);
    const starbase = star.starbase;
    if (!starbase || starbase.activeBuild || starbase.isBootstrapping) {
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
        generation: starbase.buildGeneration,
      },
    };

    starbase.activeBuild = {
      item: nextItem,
      completesAt: event.timeArrival,
    };
    this.clock.schedule(event);
  }

  private chooseNextBuild(starbase: MutableStarbaseState): BuildItem {
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

    return selected ?? 'defense';
  }

  private handleEvent(event: GameEvent) {
    if (this.isGameOver()) {
      return;
    }

    switch (event.type) {
      case 'build-complete':
        this.handleBuildComplete(event);
        break;
      case 'probe-arrival':
        this.handleProbeArrival(event);
        break;
      case 'missile-arrival':
        this.handleMissileArrival(event);
        break;
      case 'instruction-arrival':
        this.handleInstructionArrival(event);
        break;
    }

    if (!this.isGameOver()) {
      this.refreshAutomation();
    }
  }

  private handleBuildComplete(event: BuildCompleteEvent) {
    const star = this.requireStar(event.payload.starId);
    const starbase = star.starbase;
    if (!starbase || starbase.buildGeneration !== event.payload.generation) {
      return;
    }

    starbase.activeBuild = null;

    switch (event.payload.item) {
      case 'bootstrap':
        starbase.isBootstrapping = false;
        starbase.level = 1;
        this.log(`${star.name} completed bootstrap and established a level 1 starbase.`);
        this.scheduleNextBuild(star.id);
        return;
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
      if (targetStar.homeworldOwner) {
        this.log(
          `${targetStar.name} is a destroyed homeworld and cannot be rebuilt; the probe was lost.`
        );
        return;
      }

      targetStar.starbase = createStarbase(event.payload.owner, false, targetStar.nextGeneration++, true);
      this.scheduleBootstrap(targetStar.id);
      this.log(`${targetStar.name} began bootstrapping a new ${event.payload.owner} starbase.`);
      return;
    }

    if (targetStar.starbase.owner === event.payload.owner) {
      targetStar.starbase.probeStock += 1;
      this.log(`${targetStar.name} received a friendly probe into storage.`);
      return;
    }

    if (targetStar.starbase.isBootstrapping) {
      targetStar.starbase = null;
      this.log(`${targetStar.name} lost its bootstrapping starbase in a probe clash.`);
      return;
    }

    this.log(`${targetStar.name} rejected an enemy probe; the probe was lost.`);
  }

  private handleMissileArrival(event: MissileArrivalEvent) {
    this.inFlightMissiles.delete(event.id);

    const targetStar = this.requireStar(event.payload.toStarId);
    const starbase = targetStar.starbase;
    if (!starbase) {
      this.log(`${targetStar.name} was empty when the missile arrived.`);
      return;
    }

    if (starbase.owner === event.payload.owner) {
      starbase.missileStock += 1;
      this.log(`${targetStar.name} stored a friendly missile on arrival.`);
      return;
    }

    if (starbase.isBootstrapping) {
      this.destroyStarbase(targetStar, event.payload.owner, 'A missile destroyed the bootstrapping starbase.');
      return;
    }

    if (starbase.defenseStock > 0) {
      starbase.defenseStock -= 1;
      this.log(`${targetStar.name} absorbed the missile with point defense.`);
      return;
    }

    starbase.level = Math.floor(starbase.level / 2);
    starbase.probeStock = Math.floor(starbase.probeStock / 2);
    starbase.missileStock = Math.floor(starbase.missileStock / 2);
    starbase.defenseStock = Math.floor(starbase.defenseStock / 2);

    if (starbase.level <= 0) {
      this.destroyStarbase(targetStar, event.payload.owner, 'A missile destroyed the starbase.');
      return;
    }

    this.log(`${targetStar.name} was hit by a missile and dropped to level ${starbase.level}.`);
  }

  private handleInstructionArrival(event: InstructionArrivalEvent) {
    this.inFlightInstructions.delete(event.id);

    const targetStar = this.requireStar(event.payload.starId);
    if (!targetStar.starbase || targetStar.starbase.owner !== event.payload.owner) {
      this.log(`${targetStar.name} could not receive its command packet because control was lost.`);
      return;
    }

    const result = this.executeInstructionOnStar(targetStar, event.payload.instruction, false);
    if (!result.ok) {
      this.log(`${targetStar.name} could not execute its remote command: ${result.reason}`);
    }
  }

  private launchProbeDirect(fromStarId: string, toStarId: string, owner: PlayerId): CommandResult<ProbeFlight> {
    return this.launchFlightDirect(fromStarId, toStarId, owner, 'probe');
  }

  private launchMissileDirect(
    fromStarId: string,
    toStarId: string,
    owner: PlayerId
  ): CommandResult<MissileFlight> {
    return this.launchFlightDirect(fromStarId, toStarId, owner, 'missile');
  }

  private launchFlightDirect(
    fromStarId: string,
    toStarId: string,
    owner: PlayerId,
    kind: 'probe' | 'missile'
  ): CommandResult<ProbeFlight | MissileFlight> {
    if (fromStarId === toStarId) {
      return {
        ok: false,
        reason: 'Select a different target star.',
      };
    }

    const originStar = this.stars.get(fromStarId);
    const targetStar = this.stars.get(toStarId);
    if (!originStar?.starbase || !targetStar || originStar.starbase.owner !== owner) {
      return {
        ok: false,
        reason: 'Launch path is invalid.',
      };
    }

    if (originStar.starbase.isBootstrapping) {
      return {
        ok: false,
        reason: `${originStar.name} is still bootstrapping and cannot launch yet.`,
      };
    }

    const stockKey = kind === 'probe' ? 'probeStock' : 'missileStock';
    if (originStar.starbase[stockKey] <= 0) {
      return {
        ok: false,
        reason: `${originStar.name} has no ${kind}s ready.`,
      };
    }

    originStar.starbase[stockKey] -= 1;

    const event = createTravelEvent({
      id: this.createEventId(kind),
      type: kind === 'probe' ? 'probe-arrival' : 'missile-arrival',
      origin: { x: originStar.nx, y: originStar.ny },
      destination: { x: targetStar.nx, y: targetStar.ny },
      timeOrigin: this.clock.time,
      speed: getShotSpeed(originStar.starbase.level),
      payload: {
        owner,
        fromStarId,
        toStarId,
      },
    }) as ProbeArrivalEvent | MissileArrivalEvent;

    const flight: BaseFlight = {
      id: event.id,
      owner,
      fromStarId,
      toStarId,
      origin: event.origin,
      destination: event.destination,
      timeOrigin: event.timeOrigin,
      timeArrival: event.timeArrival,
    };

    if (kind === 'probe') {
      this.inFlightProbes.set(flight.id, flight);
    } else {
      this.inFlightMissiles.set(flight.id, flight);
    }

    this.clock.schedule(event);
    this.log(
      `${originStar.name} launched a ${kind} toward ${targetStar.name}; arrival @ t=${event.timeArrival.toFixed(2)}`
    );

    return {
      ok: true,
      delayed: false,
      message: `${kind === 'probe' ? 'Probe' : 'Missile'} launched toward ${targetStar.name}.`,
      flight,
    };
  }

  private refreshAutomation() {
    this.updateAiDirectives();

    for (let safetyCounter = 0; safetyCounter < 100; safetyCounter += 1) {
      let changed = false;
      for (const starId of this.starOrder) {
        changed = this.tryExecuteProbePolicy(starId) || changed;
        changed = this.tryExecuteMissilePolicy(starId) || changed;
      }

      if (!changed) {
        break;
      }
    }
  }

  private updateAiDirectives() {
    const aiStarCount = this.countOwnedStarbases('ai');
    const playerStarCount = this.countOwnedStarbases('player');
    const aiStrength = this.calculateFleetStrength('ai');
    const playerStrength = this.calculateFleetStrength('player');
    const hasExpansionTargets = this.findAnyExpansionTarget() !== undefined;
    const attackAdvantage = aiStarCount > playerStarCount || aiStrength >= playerStrength + 3;

    for (const star of this.stars.values()) {
      const starbase = star.starbase;
      if (!starbase || starbase.owner !== 'ai') {
        continue;
      }

      if (hasExpansionTargets && aiStarCount < 5) {
        starbase.buildFocus = { upgrade: 1, defense: 1, probe: 3, missile: 1 };
        starbase.probePolicy = EXPAND_PROBE_POLICY;
      } else {
        starbase.buildFocus = attackAdvantage
          ? { upgrade: 1, defense: 1, probe: 1, missile: 3 }
          : { upgrade: 1, defense: 2, probe: 1, missile: 2 };
        starbase.probePolicy = hasExpansionTargets ? EXPAND_PROBE_POLICY : STOCKPILE_PROBE_POLICY;
      }

      starbase.missilePolicy = attackAdvantage
        ? aiStrength >= playerStrength + 6
          ? AUTO_OVERKILL_MISSILE_POLICY
          : AUTO_KILL_MISSILE_POLICY
        : STOCKPILE_MISSILE_POLICY;
    }
  }

  private tryExecuteProbePolicy(starId: string): boolean {
    const star = this.requireStar(starId);
    const starbase = star.starbase;
    if (!starbase || starbase.isBootstrapping || starbase.probeStock <= 0) {
      return false;
    }

    let targetStarId: string | undefined;
    switch (starbase.probePolicy.mode) {
      case 'stockpile':
        return false;
      case 'expand':
        targetStarId = this.findNearestExpansionTarget(starId);
        break;
      case 'target':
        targetStarId = starbase.probePolicy.targetStarId;
        break;
    }

    if (!targetStarId) {
      return false;
    }

    return this.launchProbeDirect(starId, targetStarId, starbase.owner).ok;
  }

  private tryExecuteMissilePolicy(starId: string): boolean {
    const star = this.requireStar(starId);
    const starbase = star.starbase;
    if (!starbase || starbase.isBootstrapping || starbase.missileStock <= 0) {
      return false;
    }

    let targetStarId: string | undefined;
    switch (starbase.missilePolicy.mode) {
      case 'stockpile':
        return false;
      case 'target':
        targetStarId = starbase.missilePolicy.targetStarId;
        break;
      case 'auto-kill': {
        targetStarId = this.findNearestEnemyTarget(starId, starbase.owner);
        if (!targetStarId) {
          return false;
        }

        const target = this.requireStar(targetStarId);
        const targetBase = target.starbase;
        if (!targetBase) {
          return false;
        }

        const requiredMissiles = estimateMissilesToKill(targetBase);
        const committedMissiles = this.countCommittedMissiles(starbase.owner, targetStarId);
        if (
          committedMissiles >= requiredMissiles ||
          starbase.missileStock + committedMissiles < requiredMissiles
        ) {
          return false;
        }
        break;
      }
      case 'auto-overkill':
        targetStarId = this.findNearestEnemyTarget(starId, starbase.owner);
        break;
    }

    if (!targetStarId) {
      return false;
    }

    return this.launchMissileDirect(starId, targetStarId, starbase.owner).ok;
  }

  private countCommittedMissiles(owner: PlayerId, toStarId: string): number {
    let committed = 0;
    for (const missile of this.inFlightMissiles.values()) {
      if (missile.owner === owner && missile.toStarId === toStarId) {
        committed += 1;
      }
    }

    return committed;
  }

  private findAnyExpansionTarget(): string | undefined {
    return this.starOrder.find((starId) => {
      const star = this.requireStar(starId);
      return !star.starbase && !star.homeworldOwner;
    });
  }

  private findNearestExpansionTarget(fromStarId: string): string | undefined {
    const origin = this.requireStar(fromStarId);
    let bestTargetId: string | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const starId of this.starOrder) {
      if (starId === fromStarId) {
        continue;
      }

      const star = this.requireStar(starId);
      if (star.starbase || star.homeworldOwner) {
        continue;
      }

      const alreadyTargeted = [...this.inFlightProbes.values()].some(
        (probe) => probe.toStarId === starId
      );
      if (alreadyTargeted) {
        continue;
      }

      const distance = Math.hypot(star.nx - origin.nx, star.ny - origin.ny);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTargetId = starId;
      }
    }

    return bestTargetId;
  }

  private findNearestEnemyTarget(fromStarId: string, owner: PlayerId): string | undefined {
    const origin = this.requireStar(fromStarId);
    let bestTargetId: string | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const starId of this.starOrder) {
      const star = this.requireStar(starId);
      if (!star.starbase || star.starbase.owner === owner) {
        continue;
      }

      const distance = Math.hypot(star.nx - origin.nx, star.ny - origin.ny);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTargetId = starId;
      }
    }

    return bestTargetId;
  }

  private countOwnedStarbases(owner: PlayerId): number {
    let count = 0;
    for (const star of this.stars.values()) {
      if (star.starbase?.owner === owner) {
        count += 1;
      }
    }

    return count;
  }

  private calculateFleetStrength(owner: PlayerId): number {
    let strength = 0;
    for (const star of this.stars.values()) {
      const starbase = star.starbase;
      if (!starbase || starbase.owner !== owner) {
        continue;
      }

      strength += starbase.level + starbase.probeStock + starbase.missileStock + starbase.defenseStock;
    }

    return strength;
  }

  private destroyStarbase(star: MutableStarState, attacker: PlayerId, reason: string) {
    const wasHomeworld = star.starbase?.isHomeworld ?? false;
    star.starbase = null;
    this.log(`${star.name}: ${reason}`);

    if (wasHomeworld) {
      this.winnerId = attacker;
      this.endReason =
        attacker === 'player'
          ? 'The AI homeworld was destroyed. Victory.'
          : 'Your homeworld was destroyed. Defeat.';
      this.log(this.endReason);
    }
  }

  private log(message: string) {
    this.eventLog.unshift({
      time: this.clock.time,
      message,
    });

    if (this.eventLog.length > 10) {
      this.eventLog.length = 10;
    }
  }

  private createEventId(prefix: string): string {
    this.nextEventId += 1;
    return `${prefix}-${this.nextEventId}`;
  }

  private requireStar(starId: string): MutableStarState {
    const star = this.stars.get(starId);
    if (!star) {
      throw new Error(`Unknown star "${starId}".`);
    }

    return star;
  }
}

export {
  describeBuildItem,
  describeMissilePolicy,
  describeProbePolicy,
  estimateMissilesToKill,
  getShotSpeed,
};
