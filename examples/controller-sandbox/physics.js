/**
 * A small physics model for floating shapes: weak gravity, air drag, and
 * bounces off the floor, the ceiling and a round wall around the viewer.
 * Positions are in meters around the viewer's starting head position.
 */

export const GRAVITY = -0.6;
export const DRAG = 0.15;
export const RESTITUTION = 0.8;
export const MAX_SHAPES = 200;
export const LAUNCH_SPEED = 3;
export const BOUNDS = {floorY: -1.6, ceilingY: 2.4, wallRadius: 6};

// Longer steps would let fast shapes jump through the wall
const MAX_STEP_SECONDS = 0.1;

export function stepShapes(shapes, dtSeconds, bounds = BOUNDS) {
  const dt = Math.min(MAX_STEP_SECONDS, Math.max(0, dtSeconds));
  const damping = 1 - DRAG * dt;
  for (let i = 0; i < shapes.length; i++) {
    const {position: p, velocity: v} = shapes[i];
    v[1] += GRAVITY * dt;
    v[0] *= damping;
    v[1] *= damping;
    v[2] *= damping;
    p[0] += v[0] * dt;
    p[1] += v[1] * dt;
    p[2] += v[2] * dt;

    if (p[1] < bounds.floorY) {
      p[1] = bounds.floorY;
      if (v[1] < 0) {
        v[1] = -v[1] * RESTITUTION;
      }
    } else if (p[1] > bounds.ceilingY) {
      p[1] = bounds.ceilingY;
      if (v[1] > 0) {
        v[1] = -v[1] * RESTITUTION;
      }
    }

    const r = Math.hypot(p[0], p[2]);
    if (r > bounds.wallRadius) {
      const nx = p[0] / r;
      const nz = p[2] / r;
      p[0] = nx * bounds.wallRadius;
      p[2] = nz * bounds.wallRadius;
      // Reflect the outward part of the velocity
      const outward = v[0] * nx + v[2] * nz;
      if (outward > 0) {
        v[0] -= (1 + RESTITUTION) * outward * nx;
        v[2] -= (1 + RESTITUTION) * outward * nz;
      }
    }

    shapes[i].age += dt;
  }
}

// Adds a shape, and removes and returns the oldest one when there are too many
export function addShape(shapes, shape) {
  shapes.push(shape);
  return shapes.length > MAX_SHAPES ? shapes.shift() : undefined;
}
