import {heightForLines, layoutCity, PLAZA_RADIUS, STREET} from '../layout';

const files = [...Array(30).keys()].map(i => ({
  path: `f${i % 3}/file${i}.js`,
  folder: `f${i % 3}`,
  lines: 10 + i * 20,
}));

test('every file gets exactly one building', () => {
  const {buildings} = layoutCity(files);
  expect(buildings.map(b => b.path).sort()).toEqual(files.map(f => f.path).sort());
});

test('the plaza stays clear', () => {
  layoutCity(files).buildings.forEach(b =>
    expect(Math.hypot(b.x, b.z)).toBeGreaterThanOrEqual(PLAZA_RADIUS),
  );
});

test('districts do not overlap', () => {
  const {districts} = layoutCity(files);
  for (let i = 0; i < districts.length; i++) {
    for (let j = i + 1; j < districts.length; j++) {
      const a = districts[i];
      const b = districts[j];
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(
        a.radius + b.radius + STREET - 1e-9,
      );
    }
  }
});

test('heights grow with line count and stop at 4 m', () => {
  expect(heightForLines(100)).toBeLessThan(heightForLines(500));
  expect(heightForLines(100000)).toBe(4);
});

test('an empty file list lays out an empty city', () => {
  expect(layoutCity([])).toEqual({buildings: [], districts: []});
});
