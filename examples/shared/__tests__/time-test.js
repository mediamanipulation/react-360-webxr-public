import {clampDeltaMs} from '../time';

test('clampDeltaMs keeps deltas between 0 and 100 ms', () => {
  expect(clampDeltaMs(16)).toBe(16);
  expect(clampDeltaMs(5000)).toBe(100);
  expect(clampDeltaMs(-3)).toBe(0);
});
