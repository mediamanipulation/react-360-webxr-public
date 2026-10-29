import {SPEEDS} from '../constants';
import {PLANETS} from '../planets';
import {SIM_DAYS_PER_SECOND, SPIN_SCALE} from '../orbit';

// Sim days that pass in one 60 Hz frame at the fastest speed button
const fastest = Math.max(...SPEEDS.map(s => s.value));
const daysPerFrame = (SIM_DAYS_PER_SECOND * fastest) / 60;

test('no speed button moves a planet more than 15° a frame', () => {
  PLANETS.forEach(planet => {
    expect((360 * daysPerFrame) / planet.orbitalPeriodDays).toBeLessThanOrEqual(15);
  });
});

test('no speed button spins a planet more than 20° a frame', () => {
  PLANETS.forEach(planet => {
    const turns = (daysPerFrame * 24) / Math.abs(planet.dayLengthHours) / SPIN_SCALE;
    expect(360 * turns).toBeLessThanOrEqual(20);
  });
});

test('there is a speed slower than real time', () => {
  expect(SPEEDS.some(s => s.value > 0 && s.value < 1)).toBe(true);
});
