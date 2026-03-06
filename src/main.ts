import './style.css';
import { Application, Graphics } from 'pixi.js';

const STAR_COUNT = 200;
const STAR_COLOR = 0xffffff;

async function init() {
  const app = new Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0a0a12,
    antialias: true,
    resizeTo: window,
  });

  const stars = new Graphics();
  for (let i = 0; i < STAR_COUNT; i++) {
    stars
      .circle(
        Math.random() * app.screen.width,
        Math.random() * app.screen.height,
        1
      )
      .fill(STAR_COLOR);
  }
  app.stage.addChild(stars);

  document.body.appendChild(app.canvas);
}

init();
