/**
 * Paints a planet's surface on a canvas: bands for the gas giants, speckled
 * rock for the others, oceans and continents for Earth, and a mottled glow for
 * the Sun. Each texture is seeded by the planet's name, so it looks the same
 * on every load.
 */

import * as THREE from 'three';

const GIANTS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune'];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// mulberry32
function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lightens (amount > 0) or darkens (amount < 0) a #rrggbb color
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channel = shift => {
    const c = (n >> shift) & 0xff;
    const target = amount > 0 ? 255 : 0;
    return Math.round(c + (target - c) * Math.abs(amount));
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function paintBands(ctx, w, h, color, next) {
  let y = 0;
  while (y < h) {
    const band = 6 + next() * 22;
    ctx.fillStyle = shade(color, (next() - 0.5) * 0.45);
    ctx.fillRect(0, y, w, band + 1);
    y += band;
  }
}

function paintSpeckles(ctx, w, h, color, next, count) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = shade(color, (next() - 0.5) * 0.5);
    ctx.globalAlpha = 0.25 + next() * 0.5;
    ctx.beginPath();
    ctx.arc(next() * w, next() * h, 1 + next() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintEarth(ctx, w, h, next) {
  ctx.fillStyle = '#1d4f9c';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = next() < 0.6 ? '#3d8a3f' : '#8a7a4a';
    ctx.beginPath();
    ctx.ellipse(
      next() * w,
      h * (0.2 + next() * 0.6),
      12 + next() * 46,
      8 + next() * 26,
      next() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = '#f2f6ff';
  ctx.fillRect(0, 0, w, h * 0.07);
  ctx.fillRect(0, h * 0.93, w, h * 0.07);
}

export function planetTexture(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const next = random(hash(name));

  if (name === 'Earth') {
    paintEarth(ctx, canvas.width, canvas.height, next);
  } else if (GIANTS.indexOf(name) >= 0) {
    paintBands(ctx, canvas.width, canvas.height, color, next);
    if (name === 'Jupiter') {
      ctx.fillStyle = '#b5523a';
      ctx.beginPath();
      ctx.ellipse(canvas.width * 0.3, canvas.height * 0.62, 28, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    paintSpeckles(ctx, canvas.width, canvas.height, color, next, name === 'Sun' ? 900 : 500);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// A soft radial glow for the Sun's halo sprite
export function glowTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, 'rgba(255, 180, 60, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 140, 40, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
