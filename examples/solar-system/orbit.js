import {clampDeltaMs} from '../shared/time';

// At speed 1, simulated time runs 20 days per second: Earth orbits in about
// 18 seconds.
export const SIM_DAYS_PER_SECOND = 20;
// Spins are slowed down by this factor on top of that, so at speed 1 Earth
// turns about once every 10 seconds, and fast spinners like Jupiter don't
// strobe at the top speed.
export const SPIN_SCALE = 200;

export function advanceSimDays(simDays, deltaMs, speed) {
  return simDays + (clampDeltaMs(deltaMs) / 1000) * SIM_DAYS_PER_SECOND * speed;
}

// Counter-clockwise seen from above, starting `phase` radians around
export function orbitPosition(orbitRadius, periodDays, phase, simDays) {
  const angle = phase + (2 * Math.PI * simDays) / periodDays;
  return [orbitRadius * Math.cos(angle), 0, -orbitRadius * Math.sin(angle)];
}

// Negative day lengths (Venus, Uranus) spin backwards
export function spinAngle(dayLengthHours, simDays) {
  return (2 * Math.PI * simDays * 24) / dayLengthHours / SPIN_SCALE;
}

// The real solar system is mostly empty space, so distances (in AU) and
// diameters (in km) go through logarithms to fit around a room, in meters.
export function compressDistance(au) {
  return 1 + 1.5 * Math.log2(1 + au);
}

export function compressSize(diameterKm) {
  return 0.05 + 0.03 * Math.log2(1 + diameterKm / 1000);
}
