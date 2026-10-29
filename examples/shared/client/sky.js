/**
 * Paints an equirectangular sky, a vertical gradient with scattered stars,
 * and returns it as a data URL for `r360.compositor.setBackground`.
 */

const WIDTH = 2048;
const HEIGHT = 1024;

// Small seeded random number generator (mulberry32), so a sky's stars are the
// same on every load
function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function skyDataURL({top, bottom, stars}) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  // The top row of an equirectangular image is straight up, the bottom row
  // straight down
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const next = random(1);
  for (let i = 0; i < stars; i++) {
    const x = next() * WIDTH;
    // Mostly above the horizon, thinning out towards it
    const y = Math.pow(next(), 1.6) * HEIGHT * 0.62;
    const radius = 0.4 + next() * 1.3;
    ctx.globalAlpha = 0.35 + next() * 0.65;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/png');
}
