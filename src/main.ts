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
  type GameEvent,
  type GameStarDefinition,
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

type HudElements = {
  timeReadout: HTMLParagraphElement;
  queueSummary: HTMLParagraphElement;
  status: HTMLParagraphElement;
  pauseButton: HTMLButtonElement;
  playButton: HTMLButtonElement;
  fastButton: HTMLButtonElement;
  nextEventButton: HTMLButtonElement;
  title: HTMLHeadingElement;
  subtitle: HTMLParagraphElement;
  details: HTMLParagraphElement;
  stockpile: HTMLParagraphElement;
  build: HTMLParagraphElement;
  hint: HTMLParagraphElement;
  nextEvent: HTMLParagraphElement;
  activityList: HTMLUListElement;
};

type LayoutElements = {
  starPane: HTMLDivElement;
  hudPane: HTMLDivElement;
};

type TimeMode = 'paused' | 'play' | 'fast';

const STARS: StarDefinition[] = [
  { id: 'sol', name: 'Sol', nx: 0.08, ny: 0.2, buildRate: 1.3, color: 0xfff7c9 },
  {
    id: 'auriga',
    name: 'Auriga',
    nx: 0.17,
    ny: 0.47,
    buildRate: 1.1,
    color: 0xb8dfff,
  },
  {
    id: 'vulpecula',
    name: 'Vulpecula',
    nx: 0.26,
    ny: 0.16,
    buildRate: 0.9,
    color: 0xd8b6ff,
  },
  {
    id: 'draco',
    name: 'Draco',
    nx: 0.31,
    ny: 0.72,
    buildRate: 1.0,
    color: 0xb6ffe5,
  },
  {
    id: 'orion',
    name: 'Orion',
    nx: 0.4,
    ny: 0.37,
    buildRate: 1.4,
    color: 0xffc89f,
  },
  {
    id: 'cygnus',
    name: 'Cygnus',
    nx: 0.48,
    ny: 0.6,
    buildRate: 1.2,
    color: 0xb8ecff,
  },
  {
    id: 'lyra',
    name: 'Lyra',
    nx: 0.54,
    ny: 0.2,
    buildRate: 1.5,
    color: 0xf4dbff,
  },
  {
    id: 'sirius',
    name: 'Sirius',
    nx: 0.62,
    ny: 0.43,
    buildRate: 1.6,
    color: 0xd5e9ff,
  },
  {
    id: 'antares',
    name: 'Antares',
    nx: 0.69,
    ny: 0.25,
    buildRate: 1.1,
    color: 0xffb5a4,
  },
  {
    id: 'rigel',
    name: 'Rigel',
    nx: 0.74,
    ny: 0.66,
    buildRate: 1.0,
    color: 0xb7dbff,
  },
  {
    id: 'vega',
    name: 'Vega',
    nx: 0.81,
    ny: 0.44,
    buildRate: 1.7,
    color: 0xdde5ff,
  },
  {
    id: 'deneb',
    name: 'Deneb',
    nx: 0.88,
    ny: 0.22,
    buildRate: 1.2,
    color: 0xecffff,
  },
  {
    id: 'arcturus',
    name: 'Arcturus',
    nx: 0.12,
    ny: 0.82,
    buildRate: 0.8,
    color: 0xffd7a8,
  },
  {
    id: 'capella',
    name: 'Capella',
    nx: 0.25,
    ny: 0.9,
    buildRate: 0.9,
    color: 0xffefbf,
  },
  {
    id: 'aldebaran',
    name: 'Aldebaran',
    nx: 0.41,
    ny: 0.86,
    buildRate: 1.0,
    color: 0xffc6a6,
  },
  {
    id: 'canopus',
    name: 'Canopus',
    nx: 0.57,
    ny: 0.79,
    buildRate: 1.1,
    color: 0xfff0ce,
  },
  {
    id: 'polaris',
    name: 'Polaris',
    nx: 0.73,
    ny: 0.88,
    buildRate: 0.9,
    color: 0xf2fbff,
  },
  {
    id: 'altair',
    name: 'Altair',
    nx: 0.89,
    ny: 0.8,
    buildRate: 1.3,
    color: 0xe6ebff,
  },
];

const BACKGROUND_POINT_COUNT = 220;
const backgroundPoints: BackgroundPoint[] = Array.from(
  { length: BACKGROUND_POINT_COUNT },
  () => ({
    nx: Math.random(),
    ny: Math.random(),
    radius: 0.4 + Math.random() * 1.4,
    alpha: 0.15 + Math.random() * 0.5,
  })
);

function createLayout(): LayoutElements {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const starPane = document.createElement('div');
  starPane.className = 'star-pane';

  const hudPane = document.createElement('div');
  hudPane.className = 'hud-pane';

  shell.append(starPane, hudPane);
  document.body.appendChild(shell);

  return { starPane, hudPane };
}

function createHud(parent: HTMLElement): HudElements {
  const panel = document.createElement('aside');
  panel.className = 'star-panel';

  const heading = document.createElement('p');
  heading.className = 'star-panel__heading';
  heading.textContent = 'Steps 4-6: homeworlds, build loop, probe launch';

  const timeReadout = document.createElement('p');
  timeReadout.className = 'star-panel__time';

  const queueSummary = document.createElement('p');
  queueSummary.className = 'star-panel__queue';

  const controls = document.createElement('div');
  controls.className = 'star-panel__controls';

  const pauseButton = document.createElement('button');
  pauseButton.className = 'star-panel__button';
  pauseButton.textContent = 'Pause';

  const playButton = document.createElement('button');
  playButton.className = 'star-panel__button';
  playButton.textContent = 'Play';

  const fastButton = document.createElement('button');
  fastButton.className = 'star-panel__button';
  fastButton.textContent = 'Fast';

  const nextEventButton = document.createElement('button');
  nextEventButton.className = 'star-panel__button';
  nextEventButton.textContent = 'Next event';

  controls.append(pauseButton, playButton, fastButton, nextEventButton);

  const status = document.createElement('p');
  status.className = 'star-panel__status';

  const title = document.createElement('h2');
  title.className = 'star-panel__title';

  const subtitle = document.createElement('p');
  subtitle.className = 'star-panel__subtitle';

  const details = document.createElement('p');
  details.className = 'star-panel__details';

  const stockpile = document.createElement('p');
  stockpile.className = 'star-panel__stockpile';

  const build = document.createElement('p');
  build.className = 'star-panel__build';

  const hint = document.createElement('p');
  hint.className = 'star-panel__hint';

  const nextEvent = document.createElement('p');
  nextEvent.className = 'star-panel__engine-summary';

  const activityHeading = document.createElement('p');
  activityHeading.className = 'star-panel__section-heading';
  activityHeading.textContent = 'Recent activity';

  const activityList = document.createElement('ul');
  activityList.className = 'star-panel__activity-list';

  panel.append(
    heading,
    timeReadout,
    queueSummary,
    controls,
    status,
    title,
    subtitle,
    details,
    stockpile,
    build,
    hint,
    nextEvent,
    activityHeading,
    activityList
  );
  parent.appendChild(panel);

  return {
    timeReadout,
    queueSummary,
    status,
    pauseButton,
    playButton,
    fastButton,
    nextEventButton,
    title,
    subtitle,
    details,
    stockpile,
    build,
    hint,
    nextEvent,
    activityList,
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

function formatOwner(owner: 'player' | 'ai') {
  return owner === 'player' ? 'Player' : 'AI';
}

function describeEvent(event: GameEvent, starsById: Map<string, StarDefinition>): string {
  switch (event.type) {
    case 'build-complete': {
      const star = starsById.get(event.payload.starId);
      return `${star?.name ?? event.payload.starId}: ${describeBuildItem(event.payload.item)} completes @ t=${event.timeArrival.toFixed(2)}`;
    }
    case 'probe-arrival': {
      const origin = starsById.get(event.payload.fromStarId);
      const destination = starsById.get(event.payload.toStarId);
      return `Probe ${origin?.name ?? event.payload.fromStarId} -> ${destination?.name ?? event.payload.toStarId} @ t=${event.timeArrival.toFixed(2)}`;
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

async function init() {
  const { starPane, hudPane } = createLayout();
  const simulation = new StarfieldSimulation(STARS);
  const starsById = new Map(STARS.map((star) => [star.id, star]));

  const app = new Application();
  await app.init({
    backgroundColor: 0x0a0a12,
    antialias: true,
  });

  starPane.appendChild(app.canvas);

  const hud = createHud(hudPane);
  const backgroundLayer = new Graphics();
  const routeLayer = new Graphics();
  const starsLayer = new Container();
  const labelLayer = new Container();
  app.stage.addChild(backgroundLayer, routeLayer, starsLayer, labelLayer);

  let selectedStarId: string | null = simulation.playerHomeworldId;
  let timeMode: TimeMode = 'paused';
  let statusMessage =
    'Click a star to inspect it. Click the same non-homeworld star again to launch a probe from Sol once one is ready.';

  const starGraphics = new Map<string, Graphics>();
  const homeworldLabels = new Map<string, Text>();
  for (const star of STARS) {
    const graphic = new Graphics();
    graphic.eventMode = 'static';
    graphic.cursor = 'pointer';
    graphic.hitArea = new Circle(0, 0, 22);
    graphic.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      const wasSelected = selectedStarId === star.id;
      selectedStarId = star.id;

      if (wasSelected && star.id !== simulation.playerHomeworldId) {
        const launchResult = simulation.launchProbe(simulation.playerHomeworldId, star.id);
        statusMessage = launchResult.ok
          ? `Probe launched toward ${star.name}. Watch the cyan marker travel across the map.`
          : launchResult.reason;
      } else {
        const starState = simulation.getStar(star.id);
        if (!starState?.starbase) {
          statusMessage = `Selected ${star.name}. Click it again to send a probe from Sol when one is available.`;
        } else if (starState.starbase.owner === 'player') {
          statusMessage = `${star.name} is under player control.`;
        } else {
          statusMessage = `${star.name} is enemy-controlled. Probes will not colonize it.`;
        }
      }

      redraw();
      updateHud();
    });
    starGraphics.set(star.id, graphic);
    starsLayer.addChild(graphic);
  }

  for (const [starId, labelText, color] of [
    [simulation.playerHomeworldId, 'PLAYER HOME', 0x7fe4ff],
    [simulation.aiHomeworldId, 'AI HOME', 0xff93a6],
  ] as const) {
    const label = new Text({
      text: labelText,
      style: {
        fill: color,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
      },
    });
    label.anchor.set(0.5, 0);
    homeworldLabels.set(starId, label);
    labelLayer.addChild(label);
  }

  app.stage.eventMode = 'static';
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
  app.stage.on('pointertap', () => {
    selectedStarId = null;
    statusMessage = 'Selection cleared.';
    redraw();
    updateHud();
  });

  const setTimeMode = (nextMode: TimeMode) => {
    timeMode = nextMode;
    syncControls();
    updateHud();
  };

  const syncControls = () => {
    hud.pauseButton.dataset.active = String(timeMode === 'paused');
    hud.playButton.dataset.active = String(timeMode === 'play');
    hud.fastButton.dataset.active = String(timeMode === 'fast');
  };

  hud.pauseButton.addEventListener('click', () => {
    setTimeMode('paused');
    statusMessage = 'Simulation paused.';
    updateHud();
  });
  hud.playButton.addEventListener('click', () => {
    setTimeMode('play');
    statusMessage = 'Simulation running at 1x speed.';
    updateHud();
  });
  hud.fastButton.addEventListener('click', () => {
    setTimeMode('fast');
    statusMessage = 'Simulation running at fast-forward speed.';
    updateHud();
  });
  hud.nextEventButton.addEventListener('click', () => {
    const event = simulation.advanceToNextEvent();
    statusMessage = event
      ? `Advanced to ${describeEvent(event, starsById)}.`
      : 'No events are queued.';
    redraw();
    updateHud();
  });

  const updateHud = () => {
    hud.timeReadout.textContent = `Simulation time: t=${simulation.time.toFixed(2)}`;
    const nextEvent = simulation.getNextEvent();
    hud.queueSummary.textContent = nextEvent
      ? `${simulation.pendingEventCount} queued events - next: ${describeEvent(nextEvent, starsById)}`
      : 'No queued events.';
    hud.status.textContent = statusMessage;

    const selected = selectedStarId ? simulation.getStar(selectedStarId) : undefined;
    if (!selected) {
      hud.title.textContent = 'No star selected';
      hud.subtitle.textContent = 'Tap or click a star to inspect it.';
      hud.details.textContent = 'Homeworlds are ringed in cyan and rose.';
      hud.stockpile.textContent = 'Stockpiles: n/a';
      hud.build.textContent = 'Build queue: n/a';
      hud.hint.textContent =
        'Click a non-homeworld star twice to launch a probe from Sol when a probe is in stock.';
      hud.nextEvent.textContent = nextEvent
        ? `Upcoming event: ${describeEvent(nextEvent, starsById)}`
        : 'Upcoming event: none';
      renderActivity();
      return;
    }

    hud.title.textContent = selected.name;
    hud.subtitle.textContent = `Build rate ${selected.buildRate.toFixed(1)}x`;

    if (!selected.starbase) {
      hud.details.textContent = 'Status: unoccupied star';
      hud.stockpile.textContent = 'Stockpiles: none';
      hud.build.textContent = 'Build queue: starts after the first probe arrival';
      hud.hint.textContent =
        selected.id === simulation.playerHomeworldId
          ? 'The player homeworld is already occupied.'
          : `Click ${selected.name} again to launch one probe from Sol when available.`;
    } else {
      const { starbase } = selected;
      hud.details.textContent = `${formatOwner(starbase.owner)} ${starbase.isHomeworld ? 'homeworld' : 'starbase'} - level ${starbase.level}`;
      hud.stockpile.textContent = `Stockpiles: probes ${starbase.probeStock}, missiles ${starbase.missileStock}, defense ${starbase.defenseStock}`;
      hud.build.textContent = starbase.activeBuild
        ? `Build queue: ${describeBuildItem(starbase.activeBuild.item)} completes @ t=${starbase.activeBuild.completesAt.toFixed(2)}`
        : 'Build queue: idle';

      if (selected.id === simulation.playerHomeworldId) {
        hud.hint.textContent =
          'Sol builds automatically. Click an empty or friendly star twice to dispatch a probe.';
      } else if (starbase.owner === 'player') {
        hud.hint.textContent = 'Friendly colony. Incoming probes are stored here.';
      } else {
        hud.hint.textContent = 'Enemy-held star. Probes are lost when they arrive.';
      }
    }

    hud.nextEvent.textContent = nextEvent
      ? `Upcoming event: ${describeEvent(nextEvent, starsById)}`
      : 'Upcoming event: none';
    renderActivity();
  };

  const renderActivity = () => {
    hud.activityList.textContent = '';
    for (const entry of simulation.getRecentLog()) {
      const item = document.createElement('li');
      item.textContent = `t=${entry.time.toFixed(2)} - ${entry.message}`;
      hud.activityList.appendChild(item);
    }
  };

  const redraw = () => {
    const width = app.screen.width;
    const height = app.screen.height;
    app.stage.hitArea = new Rectangle(0, 0, width, height);

    backgroundLayer.clear();
    for (const point of backgroundPoints) {
      backgroundLayer
        .circle(point.nx * width, point.ny * height, point.radius)
        .fill({ color: 0xffffff, alpha: point.alpha });
    }

    routeLayer.clear();
    const selectedTarget =
      selectedStarId && selectedStarId !== simulation.playerHomeworldId
        ? starsById.get(selectedStarId)
        : undefined;
    const playerHomeworld = starsById.get(simulation.playerHomeworldId);
    if (selectedTarget && playerHomeworld) {
      const start = getStarPosition(playerHomeworld, width, height);
      const end = getStarPosition(selectedTarget, width, height);
      routeLayer
        .moveTo(start.x, start.y)
        .lineTo(end.x, end.y)
        .stroke({ color: 0x7fe4ff, width: 1, alpha: 0.18 });
    }

    for (const flight of simulation.getInFlightProbes()) {
      const start = getMapPoint(flight.origin.x, flight.origin.y, width, height);
      const end = getMapPoint(flight.destination.x, flight.destination.y, width, height);
      const progress = clamp(
        (simulation.time - flight.timeOrigin) / (flight.timeArrival - flight.timeOrigin),
        0,
        1
      );
      const x = lerp(start.x, end.x, progress);
      const y = lerp(start.y, end.y, progress);
      const color = flight.owner === 'player' ? 0x7fe4ff : 0xff93a6;

      routeLayer
        .moveTo(start.x, start.y)
        .lineTo(end.x, end.y)
        .stroke({ color, width: 1.5, alpha: 0.22 })
        .circle(x, y, 4)
        .fill({ color, alpha: 0.95 });
    }

    for (const star of STARS) {
      const graphic = starGraphics.get(star.id);
      if (!graphic) {
        continue;
      }

      const isSelected = selectedStarId === star.id;
      const starState = simulation.getStar(star.id);
      const starbase = starState?.starbase;
      const { x, y } = getStarPosition(star, width, height);
      const ownershipColor =
        starbase?.owner === 'player'
          ? 0x7fe4ff
          : starbase?.owner === 'ai'
            ? 0xff93a6
            : 0xffffff;
      graphic.clear();
      if (starbase) {
        graphic
          .circle(0, 0, starbase.isHomeworld ? 24 : 18)
          .stroke({
            color: ownershipColor,
            width: starbase.isHomeworld ? 3 : 2,
            alpha: starbase.isHomeworld ? 0.75 : 0.45,
          });
      }

      graphic
        .circle(0, 0, isSelected ? 20 : 16)
        .fill({ color: star.color, alpha: isSelected ? 0.34 : 0.18 })
        .circle(0, 0, isSelected ? 11 : 8)
        .fill({ color: star.color, alpha: isSelected ? 0.72 : 0.48 })
        .circle(0, 0, 3)
        .fill(0xffffff);
      if (isSelected) {
        graphic
          .circle(0, 0, 25)
          .stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
      }
      graphic.position.set(x, y);

      const label = homeworldLabels.get(star.id);
      if (label) {
        label.position.set(x, y + 24);
      }
    }
  };

  syncControls();
  updateHud();
  redraw();

  const resizeRendererToPane = () => {
    const width = Math.max(1, Math.floor(starPane.clientWidth));
    const height = Math.max(1, Math.floor(starPane.clientHeight));
    app.renderer.resize(width, height);
    redraw();
  };

  const resizeObserver = new ResizeObserver(resizeRendererToPane);
  resizeObserver.observe(starPane);
  resizeRendererToPane();

  app.ticker.add((ticker) => {
    const speedMultiplier = timeMode === 'play' ? 1 : timeMode === 'fast' ? 6 : 0;
    if (speedMultiplier > 0) {
      simulation.advanceBy((ticker.deltaMS / 1000) * speedMultiplier);
    }

    redraw();
    updateHud();
  });
}

init();
