// Minimal example of the screen interface (not used in the ad).
import * as K from './kit.js';

export const meta = { id: '_example', title: 'EXAMPLE QUEST', aspect: 16 / 9 };

export function create(w, h) {
  const s = w / 1280; // design at 1280x720, scale everything by s
  // Pre-render the logo once (shadows/glows are expensive per frame).
  const logo = K.makeCanvas(1100 * s, 260 * s);
  {
    const c = logo.getContext('2d');
    K.logoText(c, 'EXAMPLE QUEST', logo.width / 2, 170 * s, {
      font: K.font(400, 120 * s, 'Lilita One'),
      fill: (c2, top, bottom) => K.linGrad(c2, 0, top, 0, bottom, [[0, '#fff6c9'], [1, '#ffb13b']]),
      outlines: [[22 * s, '#3a1a52'], [10 * s, '#ffffff']],
      extrude: { dx: 0, dy: 12 * s, steps: 12, color: '#24103a' },
    });
  }
  return {
    bg(ctx) {
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, h, [[0, '#2b1a6b'], [0.6, '#e2668a'], [1, '#ffcf8a']]);
      ctx.fillRect(0, 0, w, h);
      K.stars(ctx, w, h * 0.5, { n: 120, seed: 4 });
      K.ridge(ctx, w, h, h * 0.78, 90 * s, '#3b2160', 9);
      K.ridge(ctx, w, h, h * 0.9, 60 * s, '#1c0f33', 12);
      K.vignette(ctx, w, h, 0.45);
    },
    fg(ctx, t) {
      const { logo: L, ui } = K.introPhases(t);
      ctx.save();
      ctx.translate(w / 2, h * 0.4);
      const sc = 0.6 + 0.4 * L;
      ctx.scale(sc, sc);
      ctx.globalAlpha = K.clamp(L * 2);
      ctx.drawImage(logo, -logo.width / 2, -logo.height / 2);
      ctx.restore();
      if (ui > 0 && K.blinkOn(t)) {
        ctx.globalAlpha = ui;
        ctx.font = K.font(400, 34 * s, 'Press Start 2P');
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS START', w / 2, h * 0.8);
      }
    },
  };
}
