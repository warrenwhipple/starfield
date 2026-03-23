import './style.css';
import {
  Application,
  Circle,
  Container,
  Graphics,
  Rectangle,
  Text,
  type FederatedPointerEvent,
} from 'pixi.js';

import {
  StarfieldSimulation,
  describeBuildItem,
  type BuildFocus,
  type BuildItem,
  type GameEvent,
  type GameStarDefinition,
  type MissilePolicy,
  type ProbePolicy,
  type StarState,
} from './game/simulation';

type StarDefinition = GameStarDefinition & {
  color: number;
};

type BackgroundPoint = {
  nx: number;
  ny: number;
  radius: number;
  alpha: number;
};

type FocusControls = Record<
  BuildItem,
  {
    value: HTMLSpanElement;
    minus: HTMLButtonElement;
    plus: HTMLButtonElement;
  }
>;

type HudElements = {
  timeReadout: HTMLParagraphElement;
  queueSummary: HTMLParagraphElement;
  commandReadout: HTMLParagraphElement;
  status: HTMLParagraphElement;
  pauseButton: HTMLButtonElement;
  playButton: HTMLButtonElement;
  fastButton: HTMLButtonElement;
  nextEventButton: HTMLButtonElement;
  probeLaunchButton: HTMLButtonElement;
  missileLaunchButton: HTMLButtonElement;
  probeTargetButton: HTMLButtonElement;
  missileTargetButton: HTMLButtonElement;
  clearActionButton: HTMLButtonElement;
  probeStockpileButton: HTMLButtonElement;
  probeExpandButton: HTMLButtonElement;
  probeTargetPolicyButton: HTMLButtonElement;
  missileStockpileButton: HTMLButtonElement;
  missileAutoKillButton: HTMLButtonElement;
  missileAutoOverkillButton: HTMLButtonElement;
  missileTargetPolicyButton: HTMLButtonElement;
  title: HTMLHeadingElement;
  subtitle: HTMLParagraphElement;
  details: HTMLParagraphElement;
  stockpile: HTMLParagraphElement;
  build: HTMLParagraphElement;
  policySummary: HTMLParagraphElement;
  hint: HTMLParagraphElement;
  nextEvent: HTMLParagraphElement;
  activityList: HTMLUListElement;
  focusControls: FocusControls;
};

type LayoutElements = {
  starPane: HTMLDivElement;
  hudPane: HTMLDivElement;
  overlay: HTMLDivElement;
  overlayTitle: HTMLHeadingElement;
  overlayReason: HTMLParagraphElement;
  overlayButton: HTMLButtonElement;
};

type TimeMode = 'paused' | 'play' | 'fast';

type ArmedAction =
  | { kind: 'launch-probe'; sourceStarId: string }
  | { kind: 'launch-missile'; sourceStarId: string }
  | { kind: 'set-probe-target'; sourceStarId: string }
  | { kind: 'set-missile-target'; sourceStarId: string };

type VisualEffect = {
  starId: string;
  color: number;
  createdAt: number;
  durationMs: number;
  radius: number;
};

const STARS: StarDefinition[] = [
  { id: 'sol', name: 'Sol', nx: 0.08, ny: 0.2, buildRate: 1.3, color: 0xfff7c9 },
  { id: 'auriga', name: 'Auriga', nx: 0.17, ny: 0.47, buildRate: 1.1, color: 0xb8dfff },
  { id: 'vulpecula', name: 'Vulpecula', nx: 0.26, ny: 0.16, buildRate: 0.9, color: 0xd8b6ff },
  { id: 'draco', name: 'Draco', nx: 0.31, ny: 0.72, buildRate: 1.0, color: 0xb6ffe5 },
  { id: 'orion', name: 'Orion', nx: 0.4, ny: 0.37, buildRate: 1.4, color: 0xffc89f },
  { id: 'cygnus', name: 'Cygnus', nx: 0.48, ny: 0.6, buildRate: 1.2, color: 0xb8ecff },
  { id: 'lyra', name: 'Lyra', nx: 0.54, ny: 0.2, buildRate: 1.5, color: 0xf4dbff },
  { id: 'sirius', name: 'Sirius', nx: 0.62, ny: 0.43, buildRate: 1.6, color: 0xd5e9ff },
  { id: 'antares', name: 'Antares', nx: 0.69, ny: 0.25, buildRate: 1.1, color: 0xffb5a4 },
  { id: 'rigel', name: 'Rigel', nx: 0.74, ny: 0.66, buildRate: 1.0, color: 0xb7dbff },
  { id: 'vega', name: 'Vega', nx: 0.81, ny: 0.44, buildRate: 1.7, color: 0xdde5ff },
  { id: 'deneb', name: 'Deneb', nx: 0.88, ny: 0.22, buildRate: 1.2, color: 0xecffff },
  { id: 'arcturus', name: 'Arcturus', nx: 0.12, ny: 0.82, buildRate: 0.8, color: 0xffd7a8 },
  { id: 'capella', name: 'Capella', nx: 0.25, ny: 0.9, buildRate: 0.9, color: 0xffefbf },
  { id: 'aldebaran', name: 'Aldebaran', nx: 0.41, ny: 0.86, buildRate: 1.0, color: 0xffc6a6 },
  { id: 'canopus', name: 'Canopus', nx: 0.57, ny: 0.79, buildRate: 1.1, color: 0xfff0ce },
  { id: 'polaris', name: 'Polaris', nx: 0.73, ny: 0.88, buildRate: 0.9, color: 0xf2fbff },
  { id: 'altair', name: 'Altair', nx: 0.89, ny: 0.8, buildRate: 1.3, color: 0xe6ebff },
];

const BUILD_ITEMS: Array<{ key: BuildItem; label: string }> = [
  { key: 'upgrade', label: 'Upgrade' },
  { key: 'defense', label: 'Defense' },
  { key: 'probe', label: 'Probe' },
  { key: 'missile', label: 'Missile' },
];
const BACKGROUND_POINT_COUNT = 220;
const backgroundPoints: BackgroundPoint[] = Array.from({ length: BACKGROUND_POINT_COUNT }, () => ({
  nx: Math.random(),
  ny: Math.random(),
  radius: 0.4 + Math.random() * 1.4,
  alpha: 0.15 + Math.random() * 0.5,
}));

function createButton(text: string, small = false) {
  const button = document.createElement('button');
  button.className = `panel-button${small ? ' panel-button--small' : ''}`;
  button.textContent = text;
  return button;
}

function createSectionHeading(text: string) {
  const heading = document.createElement('p');
  heading.className = 'panel-section-heading';
  heading.textContent = text;
  return heading;
}

function createLayout(): LayoutElements {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const starPane = document.createElement('div');
  starPane.className = 'star-pane';

  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay';

  const overlayCard = document.createElement('div');
  overlayCard.className = 'game-over-card';

  const overlayTitle = document.createElement('h2');
  overlayTitle.className = 'game-over-title';

  const overlayReason = document.createElement('p');
  overlayReason.className = 'game-over-reason';

  const overlayButton = createButton('Restart match');
  overlayButton.classList.add('game-over-button');

  overlayCard.append(overlayTitle, overlayReason, overlayButton);
  overlay.appendChild(overlayCard);
  starPane.appendChild(overlay);

  const hudPane = document.createElement('div');
  hudPane.className = 'hud-pane';

  shell.append(starPane, hudPane);
  document.body.appendChild(shell);

  return {
    starPane,
    hudPane,
    overlay,
    overlayTitle,
    overlayReason,
    overlayButton,
  };
}

function createHud(parent: HTMLElement): HudElements {
  const panel = document.createElement('aside');
  panel.className = 'star-panel';

  const heading = document.createElement('p');
  heading.className = 'panel-heading';
  heading.textContent = 'Steps 7-10: missiles, AI, remote policies, polish';

  const timeReadout = document.createElement('p');
  timeReadout.className = 'panel-copy';

  const queueSummary = document.createElement('p');
  queueSummary.className = 'panel-copy panel-copy--muted';

  const commandReadout = document.createElement('p');
  commandReadout.className = 'panel-pill';

  const timeControls = document.createElement('div');
  timeControls.className = 'button-grid';
  const pauseButton = createButton('Pause');
  const playButton = createButton('Play');
  const fastButton = createButton('Fast');
  const nextEventButton = createButton('Next event');
  timeControls.append(pauseButton, playButton, fastButton, nextEventButton);

  const status = document.createElement('p');
  status.className = 'status-card';

  const actionHeading = createSectionHeading('Orders');
  const actionControls = document.createElement('div');
  actionControls.className = 'button-grid';
  const probeLaunchButton = createButton('Order probe');
  const missileLaunchButton = createButton('Order missile');
  const probeTargetButton = createButton('Set probe target');
  const missileTargetButton = createButton('Set missile target');
  const clearActionButton = createButton('Clear action');
  clearActionButton.classList.add('button-grid__wide');
  actionControls.append(
    probeLaunchButton,
    missileLaunchButton,
    probeTargetButton,
    missileTargetButton,
    clearActionButton
  );

  const title = document.createElement('h2');
  title.className = 'panel-title';

  const subtitle = document.createElement('p');
  subtitle.className = 'panel-subtitle';

  const details = document.createElement('p');
  details.className = 'panel-copy panel-copy--muted';

  const stockpile = document.createElement('p');
  stockpile.className = 'panel-copy';

  const build = document.createElement('p');
  build.className = 'panel-copy';

  const policySummary = document.createElement('p');
  policySummary.className = 'panel-copy';

  const focusHeading = createSectionHeading('Build focus');
  const focusGrid = document.createElement('div');
  focusGrid.className = 'focus-grid';
  const focusControls = {} as FocusControls;
  for (const item of BUILD_ITEMS) {
    const row = document.createElement('div');
    row.className = 'focus-row';

    const label = document.createElement('span');
    label.className = 'focus-row__label';
    label.textContent = item.label;

    const minus = createButton('-', true);
    const value = document.createElement('span');
    value.className = 'focus-row__value';
    value.textContent = '-';
    const plus = createButton('+', true);

    row.append(label, minus, value, plus);
    focusGrid.appendChild(row);
    focusControls[item.key] = { value, minus, plus };
  }

  const probeHeading = createSectionHeading('Probe policy');
  const probeControls = document.createElement('div');
  probeControls.className = 'button-grid';
  const probeStockpileButton = createButton('Stockpile');
  const probeExpandButton = createButton('Expand');
  const probeTargetPolicyButton = createButton('Target');
  probeTargetPolicyButton.classList.add('button-grid__wide');
  probeControls.append(probeStockpileButton, probeExpandButton, probeTargetPolicyButton);

  const missileHeading = createSectionHeading('Missile policy');
  const missileControls = document.createElement('div');
  missileControls.className = 'button-grid';
  const missileStockpileButton = createButton('Stockpile');
  const missileAutoKillButton = createButton('Auto kill');
  const missileAutoOverkillButton = createButton('Auto overkill');
  const missileTargetPolicyButton = createButton('Target');
  missileControls.append(
    missileStockpileButton,
    missileAutoKillButton,
    missileAutoOverkillButton,
    missileTargetPolicyButton
  );

  const hint = document.createElement('p');
  hint.className = 'panel-copy panel-copy--hint';

  const nextEvent = document.createElement('p');
  nextEvent.className = 'panel-copy';

  const activityHeading = createSectionHeading('Recent activity');
  const activityList = document.createElement('ul');
  activityList.className = 'activity-list';

  panel.append(
    heading,
    timeReadout,
    queueSummary,
    commandReadout,
    timeControls,
    status,
    actionHeading,
    actionControls,
    title,
    subtitle,
    details,
    stockpile,
    build,
    policySummary,
    focusHeading,
    focusGrid,
    probeHeading,
    probeControls,
    missileHeading,
    missileControls,
    hint,
    nextEvent,
    activityHeading,
    activityList
  );
  parent.appendChild(panel);

  return {
    timeReadout,
    queueSummary,
    commandReadout,
    status,
    pauseButton,
    playButton,
    fastButton,
    nextEventButton,
    probeLaunchButton,
    missileLaunchButton,
    probeTargetButton,
    missileTargetButton,
    clearActionButton,
    probeStockpileButton,
    probeExpandButton,
    probeTargetPolicyButton,
    missileStockpileButton,
    missileAutoKillButton,
    missileAutoOverkillButton,
    missileTargetPolicyButton,
    title,
    subtitle,
    details,
    stockpile,
    build,
    policySummary,
    hint,
    nextEvent,
    activityList,
    focusControls,
  };
}

function getMapPoint(nx: number, ny: number, width: number, height: number) {
  const horizontalPadding = Math.max(20, Math.min(90, width * 0.08));
  const verticalPadding = Math.max(20, Math.min(80, height * 0.08));
  return {
    x: horizontalPadding + nx * (width - horizontalPadding * 2),
    y: verticalPadding + ny * (height - verticalPadding * 2),
  };
}

function getStarPosition(star: StarDefinition, width: number, height: number) {
  return getMapPoint(star.nx, star.ny, width, height);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function formatOwner(owner: 'player' | 'ai') {
  return owner === 'player' ? 'Player' : 'AI';
}

function formatProbePolicy(policy: ProbePolicy, starsById: Map<string, StarDefinition>) {
  if (policy.mode !== 'target') {
    return policy.mode === 'expand' ? 'Expand' : 'Stockpile';
  }

  return `Target ${starsById.get(policy.targetStarId)?.name ?? policy.targetStarId}`;
}

function formatMissilePolicy(policy: MissilePolicy, starsById: Map<string, StarDefinition>) {
  switch (policy.mode) {
    case 'stockpile':
      return 'Stockpile';
    case 'auto-kill':
      return 'Auto kill';
    case 'auto-overkill':
      return 'Auto overkill';
    case 'target':
      return `Target ${starsById.get(policy.targetStarId)?.name ?? policy.targetStarId}`;
  }
}

function describeEvent(event: GameEvent, starsById: Map<string, StarDefinition>): string {
  switch (event.type) {
    case 'build-complete': {
      const star = starsById.get(event.payload.starId);
      return `${star?.name ?? event.payload.starId}: ${describeBuildItem(event.payload.item)} complete @ t=${event.timeArrival.toFixed(2)}`;
    }
    case 'probe-arrival': {
      const origin = starsById.get(event.payload.fromStarId);
      const destination = starsById.get(event.payload.toStarId);
      return `Probe ${origin?.name ?? event.payload.fromStarId} -> ${destination?.name ?? event.payload.toStarId}`;
    }
    case 'missile-arrival': {
      const origin = starsById.get(event.payload.fromStarId);
      const destination = starsById.get(event.payload.toStarId);
      return `Missile ${origin?.name ?? event.payload.fromStarId} -> ${destination?.name ?? event.payload.toStarId}`;
    }
    case 'instruction-arrival': {
      const destination = starsById.get(event.payload.starId);
      return `Instruction packet reached ${destination?.name ?? event.payload.starId}`;
    }
  }
}

function createEffect(starId: string, color: number, radius = 28, durationMs = 900): VisualEffect {
  return {
    starId,
    color,
    createdAt: performance.now(),
    durationMs,
    radius,
  };
}

function describeSelection(star: StarState) {
  if (!star.starbase) {
    return star.homeworldOwner
      ? `${star.name} is a ruined homeworld. It cannot be rebuilt.`
      : `${star.name} is unoccupied.`;
  }

  if (star.starbase.isBootstrapping) {
    return `${star.name} is bootstrapping a ${formatOwner(star.starbase.owner)} colony.`;
  }

  return `${star.name} is a ${formatOwner(star.starbase.owner)} ${star.starbase.isHomeworld ? 'homeworld' : 'starbase'}.`;
}

async function init() {
  const { starPane, hudPane, overlay, overlayTitle, overlayReason, overlayButton } = createLayout();
  const simulation = new StarfieldSimulation(STARS);
  const starsById = new Map(STARS.map((star) => [star.id, star]));

  const app = new Application();
  await app.init({
    backgroundColor: 0x070a12,
    antialias: true,
  });

  starPane.prepend(app.canvas);

  const hud = createHud(hudPane);
  const backgroundLayer = new Graphics();
  const travelLayer = new Graphics();
  const effectLayer = new Graphics();
  const starsLayer = new Container();
  const labelLayer = new Container();
  app.stage.addChild(backgroundLayer, travelLayer, effectLayer, starsLayer, labelLayer);

  let selectedStarId: string | null = simulation.playerHomeworldId;
  let timeMode: TimeMode = 'paused';
  let armedAction: ArmedAction | null = null;
  let statusMessage =
    'Select a player-controlled starbase, then issue launches or policies from the command buttons.';
  const visualEffects: VisualEffect[] = [];

  const starGraphics = new Map<string, Graphics>();
  const homeworldLabels = new Map<string, Text>();
  for (const star of STARS) {
    const graphic = new Graphics();
    graphic.eventMode = 'static';
    graphic.cursor = 'pointer';
    graphic.hitArea = new Circle(0, 0, 22);
    graphic.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      handleStarTap(star.id);
    });
    starGraphics.set(star.id, graphic);
    starsLayer.addChild(graphic);

    if (star.id === simulation.playerHomeworldId || star.id === simulation.aiHomeworldId) {
      const label = new Text({
        text: '',
        style: {
          fill: 0xffffff,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
        },
      });
      label.anchor.set(0.5, 0);
      homeworldLabels.set(star.id, label);
      labelLayer.addChild(label);
    }
  }

  app.stage.eventMode = 'static';
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
  app.stage.on('pointertap', () => {
    armedAction = null;
    selectedStarId = null;
    statusMessage = 'Selection cleared.';
    updateHud();
    redraw();
  });

  function getSelectedStar() {
    return selectedStarId ? simulation.getStar(selectedStarId) : undefined;
  }

  function getSelectedFriendlyStar() {
    const selected = getSelectedStar();
    return selected?.starbase?.owner === 'player' ? selected : undefined;
  }

  function setStatus(message: string) {
    statusMessage = message;
  }

  function pushFlightEffect(starId: string, color: number, radius = 20) {
    visualEffects.push(createEffect(starId, color, radius, 700));
  }

  function handleProcessedEvents(events: GameEvent[]) {
    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      switch (event.type) {
        case 'build-complete':
          visualEffects.push(
            createEffect(event.payload.starId, event.payload.item === 'bootstrap' ? 0x7bffb8 : 0x89b8ff, 22)
          );
          break;
        case 'probe-arrival':
          visualEffects.push(createEffect(event.payload.toStarId, 0x7fe4ff, 28, 900));
          break;
        case 'missile-arrival':
          visualEffects.push(createEffect(event.payload.toStarId, 0xffa561, 34, 1000));
          break;
        case 'instruction-arrival':
          visualEffects.push(createEffect(event.payload.starId, 0xffdf8a, 20, 650));
          break;
      }
    }

    setStatus(describeEvent(events[events.length - 1], starsById));
    if (simulation.isGameOver()) {
      timeMode = 'paused';
      updateOverlay();
    }
  }

  function setTimeMode(nextMode: TimeMode) {
    if (simulation.isGameOver()) {
      timeMode = 'paused';
      return;
    }

    timeMode = nextMode;
  }

  function handleCommandResult(result: ReturnType<StarfieldSimulation['launchProbe']>, color: number, sourceStarId: string) {
    if (!result.ok) {
      setStatus(result.reason);
      return;
    }

    pushFlightEffect(sourceStarId, color);
    setStatus(result.message);
    if (simulation.isGameOver()) {
      updateOverlay();
    }
  }

  function applyFocusDelta(item: BuildItem, delta: number) {
    const selected = getSelectedFriendlyStar();
    if (!selected?.starbase) {
      setStatus('Select a player-controlled starbase to adjust build focus.');
      return;
    }

    const nextFocus: BuildFocus = {
      ...selected.starbase.buildFocus,
      [item]: Math.max(1, selected.starbase.buildFocus[item] + delta),
    };
    const result = simulation.setBuildFocus(selected.id, nextFocus);
    handleCommandResult(result, 0xffdf8a, selected.id);
  }

  function applyProbePolicy(policy: ProbePolicy) {
    const selected = getSelectedFriendlyStar();
    if (!selected) {
      setStatus('Select a player-controlled starbase to change probe policy.');
      return;
    }

    const result = simulation.setProbePolicy(selected.id, policy);
    handleCommandResult(result, 0x7fe4ff, selected.id);
  }

  function applyMissilePolicy(policy: MissilePolicy) {
    const selected = getSelectedFriendlyStar();
    if (!selected) {
      setStatus('Select a player-controlled starbase to change missile policy.');
      return;
    }

    const result = simulation.setMissilePolicy(selected.id, policy);
    handleCommandResult(result, 0xffb06f, selected.id);
  }

  function armAction(kind: ArmedAction['kind']) {
    const selected = getSelectedFriendlyStar();
    if (!selected) {
      setStatus('Select a player-controlled starbase first.');
      return;
    }

    armedAction = {
      kind,
      sourceStarId: selected.id,
    };
    const verb =
      kind === 'launch-probe'
        ? 'one-time probe order'
        : kind === 'launch-missile'
          ? 'one-time missile order'
          : kind === 'set-probe-target'
            ? 'probe target policy'
            : 'missile target policy';
    setStatus(`Select a target star for ${selected.name}'s ${verb}.`);
  }

  function executeTargetedAction(targetStarId: string) {
    if (!armedAction) {
      return;
    }

    if (armedAction.sourceStarId === targetStarId) {
      setStatus('Select a different target star.');
      return;
    }

    switch (armedAction.kind) {
      case 'launch-probe':
        handleCommandResult(simulation.launchProbe(armedAction.sourceStarId, targetStarId), 0x7fe4ff, armedAction.sourceStarId);
        break;
      case 'launch-missile':
        handleCommandResult(
          simulation.launchMissile(armedAction.sourceStarId, targetStarId),
          0xffa561,
          armedAction.sourceStarId
        );
        break;
      case 'set-probe-target':
        applyProbePolicy({ mode: 'target', targetStarId });
        break;
      case 'set-missile-target':
        applyMissilePolicy({ mode: 'target', targetStarId });
        break;
    }

    armedAction = null;
  }

  function handleStarTap(starId: string) {
    if (armedAction) {
      executeTargetedAction(starId);
      selectedStarId = starId;
      updateHud();
      redraw();
      return;
    }

    selectedStarId = starId;
    const selected = simulation.getStar(starId);
    if (selected) {
      setStatus(describeSelection(selected));
    }
    updateHud();
    redraw();
  }

  function updateOverlay() {
    if (!simulation.isGameOver()) {
      overlay.dataset.visible = 'false';
      return;
    }

    overlay.dataset.visible = 'true';
    overlayTitle.textContent = simulation.winner === 'player' ? 'Victory' : 'Defeat';
    overlayReason.textContent = simulation.gameOverReason ?? 'The match is over.';
  }

  function setButtonActive(button: HTMLButtonElement, active: boolean) {
    button.dataset.active = String(active);
  }

  function setButtonEnabled(button: HTMLButtonElement, enabled: boolean) {
    button.disabled = !enabled;
  }

  function updateHud() {
    const nextEvent = simulation.getNextEvent();
    const selected = getSelectedStar();
    const selectedFriendly = getSelectedFriendlyStar();

    hud.timeReadout.textContent = `Simulation time: t=${simulation.time.toFixed(2)}`;
    hud.queueSummary.textContent = nextEvent
      ? `${simulation.pendingEventCount} queued events - next: ${describeEvent(nextEvent, starsById)}`
      : 'No queued events.';

    hud.commandReadout.textContent = armedAction
      ? `Command armed: ${armedAction.kind.replaceAll('-', ' ')} from ${starsById.get(armedAction.sourceStarId)?.name ?? armedAction.sourceStarId}`
      : 'Command mode: inspect';
    hud.status.textContent = statusMessage;

    setButtonActive(hud.pauseButton, timeMode === 'paused');
    setButtonActive(hud.playButton, timeMode === 'play');
    setButtonActive(hud.fastButton, timeMode === 'fast');

    const commandsEnabled = Boolean(selectedFriendly) && !simulation.isGameOver();
    setButtonEnabled(hud.probeLaunchButton, commandsEnabled);
    setButtonEnabled(hud.missileLaunchButton, commandsEnabled);
    setButtonEnabled(hud.probeTargetButton, commandsEnabled);
    setButtonEnabled(hud.missileTargetButton, commandsEnabled);
    setButtonEnabled(hud.clearActionButton, Boolean(armedAction));
    setButtonEnabled(hud.nextEventButton, !simulation.isGameOver());
    setButtonEnabled(hud.playButton, !simulation.isGameOver());
    setButtonEnabled(hud.fastButton, !simulation.isGameOver());

    setButtonActive(hud.probeLaunchButton, armedAction?.kind === 'launch-probe');
    setButtonActive(hud.missileLaunchButton, armedAction?.kind === 'launch-missile');
    setButtonActive(hud.probeTargetButton, armedAction?.kind === 'set-probe-target');
    setButtonActive(hud.missileTargetButton, armedAction?.kind === 'set-missile-target');

    if (!selected) {
      hud.title.textContent = 'No star selected';
      hud.subtitle.textContent = 'Select a star to inspect it or issue commands from a friendly base.';
      hud.details.textContent = 'Homeworlds are ringed in cyan and rose. Neutral stars are free to colonize.';
      hud.stockpile.textContent = 'Stockpiles: n/a';
      hud.build.textContent = 'Build queue: n/a';
      hud.policySummary.textContent = 'Policies: n/a';
      hud.hint.textContent =
        'Use Order probe or Order missile from a selected player starbase. Remote colonies receive orders by delayed instruction packet.';
      hud.nextEvent.textContent = nextEvent
        ? `Upcoming event: ${describeEvent(nextEvent, starsById)}`
        : 'Upcoming event: none';
      for (const item of BUILD_ITEMS) {
        hud.focusControls[item.key].value.textContent = '-';
        setButtonEnabled(hud.focusControls[item.key].minus, false);
        setButtonEnabled(hud.focusControls[item.key].plus, false);
      }
      for (const button of [
        hud.probeStockpileButton,
        hud.probeExpandButton,
        hud.probeTargetPolicyButton,
        hud.missileStockpileButton,
        hud.missileAutoKillButton,
        hud.missileAutoOverkillButton,
        hud.missileTargetPolicyButton,
      ]) {
        setButtonEnabled(button, false);
        setButtonActive(button, false);
      }
      renderActivity();
      updateOverlay();
      return;
    }

    hud.title.textContent = selected.name;
    hud.subtitle.textContent = `Build rate ${selected.buildRate.toFixed(1)}x`;

    if (!selected.starbase) {
      hud.details.textContent = selected.homeworldOwner
        ? `${formatOwner(selected.homeworldOwner)} homeworld ruins`
        : 'Status: unoccupied star';
      hud.stockpile.textContent = 'Stockpiles: none';
      hud.build.textContent = selected.homeworldOwner
        ? 'Build queue: destroyed homeworlds cannot be rebuilt'
        : 'Build queue: begins after a successful bootstrap';
      hud.policySummary.textContent = 'Policies: none';
      hud.hint.textContent = selected.homeworldOwner
        ? 'Homeworld ruins are permanent. Destroying the opposing homeworld ends the match.'
        : 'Select a friendly starbase, arm an order, then click this neutral star as the destination.';
    } else {
      const { starbase } = selected;
      const starbaseType = starbase.isHomeworld ? 'homeworld' : starbase.isBootstrapping ? 'bootstrapping colony' : 'starbase';
      hud.details.textContent = `${formatOwner(starbase.owner)} ${starbaseType} - level ${starbase.level}`;
      hud.stockpile.textContent = `Stockpiles: probes ${starbase.probeStock}, missiles ${starbase.missileStock}, defense ${starbase.defenseStock}`;
      hud.build.textContent = starbase.activeBuild
        ? `Build queue: ${describeBuildItem(starbase.activeBuild.item)} completes @ t=${starbase.activeBuild.completesAt.toFixed(2)}`
        : 'Build queue: idle';
      hud.policySummary.textContent = `Policies: probes ${formatProbePolicy(starbase.probePolicy, starsById)} - missiles ${formatMissilePolicy(starbase.missilePolicy, starsById)}`;
      hud.hint.textContent =
        starbase.owner === 'player'
          ? selected.id === simulation.playerHomeworldId
            ? 'Homeworld commands apply instantly. Remote colonies receive command packets traveling at light speed.'
            : 'This colony obeys remote policies and launch orders sent from Sol.'
          : 'Watch the AI expand and attack once it has the advantage.';
    }

    hud.nextEvent.textContent = nextEvent
      ? `Upcoming event: ${describeEvent(nextEvent, starsById)}`
      : 'Upcoming event: none';

    for (const item of BUILD_ITEMS) {
      const row = hud.focusControls[item.key];
      const value = selected.starbase ? String(selected.starbase.buildFocus[item.key]) : '-';
      row.value.textContent = value;
      setButtonEnabled(row.minus, commandsEnabled);
      setButtonEnabled(row.plus, commandsEnabled);
    }

    setButtonEnabled(hud.probeStockpileButton, commandsEnabled);
    setButtonEnabled(hud.probeExpandButton, commandsEnabled);
    setButtonEnabled(hud.probeTargetPolicyButton, commandsEnabled);
    setButtonEnabled(hud.missileStockpileButton, commandsEnabled);
    setButtonEnabled(hud.missileAutoKillButton, commandsEnabled);
    setButtonEnabled(hud.missileAutoOverkillButton, commandsEnabled);
    setButtonEnabled(hud.missileTargetPolicyButton, commandsEnabled);

    if (selectedFriendly?.starbase) {
      setButtonActive(hud.probeStockpileButton, selectedFriendly.starbase.probePolicy.mode === 'stockpile');
      setButtonActive(hud.probeExpandButton, selectedFriendly.starbase.probePolicy.mode === 'expand');
      setButtonActive(hud.probeTargetPolicyButton, selectedFriendly.starbase.probePolicy.mode === 'target');
      setButtonActive(hud.missileStockpileButton, selectedFriendly.starbase.missilePolicy.mode === 'stockpile');
      setButtonActive(hud.missileAutoKillButton, selectedFriendly.starbase.missilePolicy.mode === 'auto-kill');
      setButtonActive(
        hud.missileAutoOverkillButton,
        selectedFriendly.starbase.missilePolicy.mode === 'auto-overkill'
      );
      setButtonActive(hud.missileTargetPolicyButton, selectedFriendly.starbase.missilePolicy.mode === 'target');
    } else {
      for (const button of [
        hud.probeStockpileButton,
        hud.probeExpandButton,
        hud.probeTargetPolicyButton,
        hud.missileStockpileButton,
        hud.missileAutoKillButton,
        hud.missileAutoOverkillButton,
        hud.missileTargetPolicyButton,
      ]) {
        setButtonActive(button, false);
      }
    }

    renderActivity();
    updateOverlay();
  }

  function renderActivity() {
    hud.activityList.textContent = '';
    for (const entry of simulation.getRecentLog()) {
      const item = document.createElement('li');
      item.textContent = `t=${entry.time.toFixed(2)} - ${entry.message}`;
      hud.activityList.appendChild(item);
    }
  }

  function drawTravelDot(
    layer: Graphics,
    color: number,
    width: number,
    alpha: number,
    radius: number,
    from: { x: number; y: number },
    to: { x: number; y: number },
    progress: number
  ) {
    const x = lerp(from.x, to.x, progress);
    const y = lerp(from.y, to.y, progress);

    layer
      .moveTo(from.x, from.y)
      .lineTo(to.x, to.y)
      .stroke({ color, width, alpha })
      .circle(x, y, radius)
      .fill({ color, alpha: 0.95 });
  }

  function redraw() {
    const width = app.screen.width;
    const height = app.screen.height;
    const now = performance.now();
    app.stage.hitArea = new Rectangle(0, 0, width, height);

    backgroundLayer.clear();
    for (const point of backgroundPoints) {
      backgroundLayer
        .circle(point.nx * width, point.ny * height, point.radius)
        .fill({ color: 0xffffff, alpha: point.alpha });
    }

    travelLayer.clear();
    effectLayer.clear();

    for (const instruction of simulation.getInFlightInstructions()) {
      const start = getMapPoint(instruction.origin.x, instruction.origin.y, width, height);
      const end = getMapPoint(instruction.destination.x, instruction.destination.y, width, height);
      const progress = clamp(
        (simulation.time - instruction.timeOrigin) / (instruction.timeArrival - instruction.timeOrigin),
        0,
        1
      );
      drawTravelDot(travelLayer, 0xffdf8a, 1.1, 0.2, 3, start, end, progress);
    }

    for (const flight of simulation.getInFlightProbes()) {
      const start = getMapPoint(flight.origin.x, flight.origin.y, width, height);
      const end = getMapPoint(flight.destination.x, flight.destination.y, width, height);
      const progress = clamp(
        (simulation.time - flight.timeOrigin) / (flight.timeArrival - flight.timeOrigin),
        0,
        1
      );
      const color = flight.owner === 'player' ? 0x7fe4ff : 0xff93a6;
      drawTravelDot(travelLayer, color, 1.5, 0.22, 4, start, end, progress);
    }

    for (const flight of simulation.getInFlightMissiles()) {
      const start = getMapPoint(flight.origin.x, flight.origin.y, width, height);
      const end = getMapPoint(flight.destination.x, flight.destination.y, width, height);
      const progress = clamp(
        (simulation.time - flight.timeOrigin) / (flight.timeArrival - flight.timeOrigin),
        0,
        1
      );
      const color = flight.owner === 'player' ? 0xffb06f : 0xff6f8f;
      drawTravelDot(travelLayer, color, 2.2, 0.26, 4.5, start, end, progress);
    }

    for (let index = visualEffects.length - 1; index >= 0; index -= 1) {
      const effect = visualEffects[index];
      const star = starsById.get(effect.starId);
      if (!star) {
        visualEffects.splice(index, 1);
        continue;
      }

      const elapsed = now - effect.createdAt;
      const progress = elapsed / effect.durationMs;
      if (progress >= 1) {
        visualEffects.splice(index, 1);
        continue;
      }

      const { x, y } = getStarPosition(star, width, height);
      effectLayer
        .circle(x, y, effect.radius * (0.5 + progress))
        .stroke({ color: effect.color, width: 2, alpha: 0.5 * (1 - progress) });
    }

    for (const star of STARS) {
      const graphic = starGraphics.get(star.id);
      if (!graphic) {
        continue;
      }

      const state = simulation.getStar(star.id);
      const starbase = state?.starbase;
      const isSelected = selectedStarId === star.id;
      const isCommandSource = armedAction?.sourceStarId === star.id;
      const { x, y } = getStarPosition(star, width, height);
      const ownershipColor =
        starbase?.owner === 'player'
          ? 0x7fe4ff
          : starbase?.owner === 'ai'
            ? 0xff93a6
            : state?.homeworldOwner
              ? 0x9da8bf
              : 0xffffff;

      graphic.clear();

      if (starbase) {
        graphic
          .circle(0, 0, starbase.isHomeworld ? 24 : 18)
          .stroke({
            color: ownershipColor,
            width: starbase.isHomeworld ? 3 : 2,
            alpha: starbase.isBootstrapping ? 0.4 : 0.7,
          });

        if (starbase.isBootstrapping) {
          graphic.circle(0, 0, 11).stroke({ color: ownershipColor, width: 1.5, alpha: 0.45 });
        }
      } else if (state?.homeworldOwner) {
        graphic.circle(0, 0, 18).stroke({ color: ownershipColor, width: 2, alpha: 0.35 });
      }

      graphic
        .circle(0, 0, isSelected ? 20 : 16)
        .fill({ color: star.color, alpha: isSelected ? 0.34 : 0.18 })
        .circle(0, 0, isSelected ? 11 : 8)
        .fill({ color: star.color, alpha: starbase?.isBootstrapping ? 0.28 : isSelected ? 0.72 : 0.48 })
        .circle(0, 0, 3)
        .fill(0xffffff);

      if (isSelected || isCommandSource) {
        graphic.circle(0, 0, isCommandSource ? 27 : 25).stroke({
          color: isCommandSource ? 0xffdf8a : 0xffffff,
          width: 1.6,
          alpha: 0.56,
        });
      }

      graphic.position.set(x, y);

      const label = homeworldLabels.get(star.id);
      if (label) {
        label.position.set(x, y + 24);
        if (!state?.starbase) {
          label.text = state?.homeworldOwner === 'player' ? 'PLAYER RUINS' : 'AI RUINS';
          label.style.fill = 0xb6c1d9;
        } else if (star.id === simulation.playerHomeworldId) {
          label.text = 'PLAYER HOME';
          label.style.fill = 0x7fe4ff;
        } else {
          label.text = 'AI HOME';
          label.style.fill = 0xff93a6;
        }
      }
    }
  }

  hud.pauseButton.addEventListener('click', () => {
    setTimeMode('paused');
    setStatus('Simulation paused.');
    updateHud();
  });
  hud.playButton.addEventListener('click', () => {
    setTimeMode('play');
    setStatus('Simulation running at 1x speed.');
    updateHud();
  });
  hud.fastButton.addEventListener('click', () => {
    setTimeMode('fast');
    setStatus('Simulation running at fast-forward speed.');
    updateHud();
  });
  hud.nextEventButton.addEventListener('click', () => {
    const event = simulation.advanceToNextEvent();
    if (event) {
      handleProcessedEvents([event]);
    } else {
      setStatus('No events are queued.');
    }
    updateHud();
    redraw();
  });

  hud.probeLaunchButton.addEventListener('click', () => {
    armAction('launch-probe');
    updateHud();
  });
  hud.missileLaunchButton.addEventListener('click', () => {
    armAction('launch-missile');
    updateHud();
  });
  hud.probeTargetButton.addEventListener('click', () => {
    armAction('set-probe-target');
    updateHud();
  });
  hud.missileTargetButton.addEventListener('click', () => {
    armAction('set-missile-target');
    updateHud();
  });
  hud.clearActionButton.addEventListener('click', () => {
    armedAction = null;
    setStatus('Command mode cleared.');
    updateHud();
  });

  hud.probeStockpileButton.addEventListener('click', () => {
    applyProbePolicy({ mode: 'stockpile' });
    updateHud();
  });
  hud.probeExpandButton.addEventListener('click', () => {
    applyProbePolicy({ mode: 'expand' });
    updateHud();
  });
  hud.probeTargetPolicyButton.addEventListener('click', () => {
    armAction('set-probe-target');
    updateHud();
  });

  hud.missileStockpileButton.addEventListener('click', () => {
    applyMissilePolicy({ mode: 'stockpile' });
    updateHud();
  });
  hud.missileAutoKillButton.addEventListener('click', () => {
    applyMissilePolicy({ mode: 'auto-kill' });
    updateHud();
  });
  hud.missileAutoOverkillButton.addEventListener('click', () => {
    applyMissilePolicy({ mode: 'auto-overkill' });
    updateHud();
  });
  hud.missileTargetPolicyButton.addEventListener('click', () => {
    armAction('set-missile-target');
    updateHud();
  });

  for (const item of BUILD_ITEMS) {
    hud.focusControls[item.key].minus.addEventListener('click', () => {
      applyFocusDelta(item.key, -1);
      updateHud();
    });
    hud.focusControls[item.key].plus.addEventListener('click', () => {
      applyFocusDelta(item.key, 1);
      updateHud();
    });
  }

  overlayButton.addEventListener('click', () => {
    window.location.reload();
  });

  const resizeRendererToPane = () => {
    const width = Math.max(1, Math.floor(starPane.clientWidth));
    const height = Math.max(1, Math.floor(starPane.clientHeight));
    app.renderer.resize(width, height);
    redraw();
  };

  const resizeObserver = new ResizeObserver(resizeRendererToPane);
  resizeObserver.observe(starPane);

  updateOverlay();
  updateHud();
  resizeRendererToPane();

  app.ticker.add((ticker) => {
    const speedMultiplier = timeMode === 'play' ? 1 : timeMode === 'fast' ? 6 : 0;
    if (speedMultiplier > 0) {
      const processed = simulation.advanceBy((ticker.deltaMS / 1000) * speedMultiplier);
      handleProcessedEvents(processed);
    }

    updateHud();
    redraw();
  });
}

init();
