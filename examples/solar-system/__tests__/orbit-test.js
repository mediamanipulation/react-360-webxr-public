import {
  advanceSimDays,
  compressDistance,
  compressSize,
  orbitPosition,
  spinAngle,
} from '../orbit';

test('a full period returns a planet to its start', () => {
  const start = orbitPosition(2, 365, 0.5, 0);
  const later = orbitPosition(2, 365, 0.5, 365);
  later.forEach((v, i) => expect(v).toBeCloseTo(start[i], 6));
});

test('a quarter period turns a quarter circle', () => {
  const [x, y, z] = orbitPosition(2, 100, 0, 25);
  expect(x).toBeCloseTo(0, 6);
  expect(y).toBe(0);
  expect(z).toBeCloseTo(-2, 6);
});

test('advanceSimDays scales by speed and ignores long frames', () => {
  expect(advanceSimDays(0, 1000, 1)).toBeCloseTo(2, 6); // 100 ms cap × 20 days/s
  expect(advanceSimDays(0, 50, 2)).toBeCloseTo(2, 6);
  expect(advanceSimDays(7, 16, 0)).toBe(7);
});

test('retrograde planets spin backwards', () => {
  expect(spinAngle(-5832.5, 10)).toBeLessThan(0);
  expect(spinAngle(23.9, 10)).toBeGreaterThan(0);
});

test('compressed sizes and distances keep their order', () => {
  expect(compressDistance(0.39)).toBeLessThan(compressDistance(1));
  expect(compressDistance(30.1)).toBeLessThan(9);
  expect(compressSize(4879)).toBeLessThan(compressSize(142984));
});
