import {isClick} from '../input';

test('a press and release in place is a click', () => {
  expect(isClick([100, 100], [102, 103])).toBe(true);
});

test('dragging to look around is not a click', () => {
  expect(isClick([100, 100], [180, 110])).toBe(false);
});

test('a release without a recorded press is not a click', () => {
  expect(isClick(null, [100, 100])).toBe(false);
});
