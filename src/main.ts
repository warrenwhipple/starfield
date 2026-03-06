import './style.css';
import {
  Application,
  Circle,
  Container,
  Graphics,
  Rectangle,
  type FederatedPointerEvent,
} from 'pixi.js';

type StarDefinition = {
  id: string;
  name: string;
  nx: number;
  ny: number;
  buildRate: number;
  color: number;
};

type BackgroundPoint = {
  nx: number;
  ny: number;
  radius: number;
  alpha: number;
};

type HudElements = {
  title: HTMLHeadingElement;
  subtitle: HTMLParagraphElement;
  details: HTMLParagraphElement;
};

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

function createHud(totalStars: number): HudElements {
  const panel = document.createElement('aside');
  panel.className = 'star-panel';

  const heading = document.createElement('p');
  heading.className = 'star-panel__heading';
  heading.textContent = `Step 2: Stars with names (${totalStars})`;

  const title = document.createElement('h2');
  title.className = 'star-panel__title';

  const subtitle = document.createElement('p');
  subtitle.className = 'star-panel__subtitle';

  const details = document.createElement('p');
  details.className = 'star-panel__details';

  panel.append(heading, title, subtitle, details);
  document.body.appendChild(panel);

  return { title, subtitle, details };
}

function getStarPosition(star: StarDefinition, width: number, height: number) {
  const horizontalPadding = Math.max(20, Math.min(90, width * 0.08));
  const verticalPadding = Math.max(20, Math.min(80, height * 0.08));
  return {
    x: horizontalPadding + star.nx * (width - horizontalPadding * 2),
    y: verticalPadding + star.ny * (height - verticalPadding * 2),
  };
}

async function init() {
  const app = new Application();
  await app.init({
    backgroundColor: 0x0a0a12,
    antialias: true,
    resizeTo: window,
  });

  document.body.appendChild(app.canvas);

  const hud = createHud(STARS.length);
  const backgroundLayer = new Graphics();
  const starsLayer = new Container();
  app.stage.addChild(backgroundLayer);
  app.stage.addChild(starsLayer);

  let selectedStarId: string | null = null;

  const starGraphics = new Map<string, Graphics>();
  for (const star of STARS) {
    const graphic = new Graphics();
    graphic.eventMode = 'static';
    graphic.cursor = 'pointer';
    graphic.hitArea = new Circle(0, 0, 22);
    graphic.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      selectedStarId = star.id;
      redraw();
      updateHud();
    });
    starGraphics.set(star.id, graphic);
    starsLayer.addChild(graphic);
  }

  app.stage.eventMode = 'static';
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
  app.stage.on('pointertap', () => {
    selectedStarId = null;
    redraw();
    updateHud();
  });

  const updateHud = () => {
    const selected = STARS.find((star) => star.id === selectedStarId);
    if (!selected) {
      hud.title.textContent = 'No star selected';
      hud.subtitle.textContent = 'Tap or click a star to inspect it.';
      hud.details.textContent = 'Status: unoccupied';
      return;
    }

    hud.title.textContent = selected.name;
    hud.subtitle.textContent = `Build rate: ${selected.buildRate.toFixed(1)}x`;
    hud.details.textContent = 'Status: unoccupied (v1)';
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

    for (const star of STARS) {
      const graphic = starGraphics.get(star.id);
      if (!graphic) {
        continue;
      }

      const isSelected = selectedStarId === star.id;
      const { x, y } = getStarPosition(star, width, height);
      graphic.clear();
      graphic
        .circle(0, 0, isSelected ? 20 : 16)
        .fill({ color: star.color, alpha: isSelected ? 0.34 : 0.2 })
        .circle(0, 0, isSelected ? 11 : 8)
        .fill({ color: star.color, alpha: isSelected ? 0.64 : 0.44 })
        .circle(0, 0, 3)
        .fill(0xffffff);
      if (isSelected) {
        graphic
          .circle(0, 0, 25)
          .stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
      }
      graphic.position.set(x, y);
    }
  };

  window.addEventListener('resize', redraw);
  updateHud();
  redraw();
}

init();
