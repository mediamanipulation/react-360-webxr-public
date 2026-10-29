import {addShape, BOUNDS, MAX_SHAPES, stepShapes} from '../physics';

const shape = (p, v) => ({
  position: p,
  velocity: v,
  spin: [0, 0, 0],
  kind: 'cube',
  color: '#fff',
  age: 0,
});

test('shapes bounce off the floor and lose energy', () => {
  const s = shape([0, -1.59, 0], [0, -2, 0]);
  stepShapes([s], 0.02);
  expect(s.position[1]).toBeGreaterThanOrEqual(BOUNDS.floorY);
  expect(s.velocity[1]).toBeGreaterThan(0);
  expect(s.velocity[1]).toBeLessThan(2);
});

test('a long frame cannot push a shape through the wall', () => {
  const s = shape([5.9, 0, 0], [50, 0, 0]);
  stepShapes([s], 10);
  expect(Math.hypot(s.position[0], s.position[2])).toBeLessThanOrEqual(BOUNDS.wallRadius);
  expect(s.velocity[0]).toBeLessThan(0);
});

test('drag slows a shape down', () => {
  const s = shape([0, 0, 0], [1, 0, 0]);
  stepShapes([s], 0.1);
  expect(s.velocity[0]).toBeLessThan(1);
});

test('adding past the limit evicts the oldest shape', () => {
  const shapes = [];
  for (let i = 0; i < MAX_SHAPES; i++) {
    expect(addShape(shapes, shape([i, 0, 0], [0, 0, 0]))).toBeUndefined();
  }
  const evicted = addShape(shapes, shape([999, 0, 0], [0, 0, 0]));
  expect(evicted.position[0]).toBe(0);
  expect(shapes).toHaveLength(MAX_SHAPES);
});
