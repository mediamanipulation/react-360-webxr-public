// The longest frame the demos simulate. The first frame after a hidden tab
// comes back can be seconds long, which would make orbits jump and send
// shapes through walls.
export const MAX_DELTA_MS = 100;

export function clampDeltaMs(deltaMs) {
  return Math.min(MAX_DELTA_MS, Math.max(0, deltaMs));
}
