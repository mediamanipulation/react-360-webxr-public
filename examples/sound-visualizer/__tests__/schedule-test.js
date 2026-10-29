import {resumeTime, START_MARGIN_SECONDS} from '../schedule';

test('the first play starts just after now', () => {
  expect(resumeTime(0, 10)).toBeCloseTo(10 + START_MARGIN_SECONDS, 9);
});

test('after a stall, missed steps are skipped instead of played at once', () => {
  expect(resumeTime(9.2, 10)).toBeCloseTo(10 + START_MARGIN_SECONDS, 9);
});

test('playing again after a pause carries on from the queued steps', () => {
  // Steps up to 10.1 were queued before the pause
  expect(resumeTime(10.1, 10)).toBe(10.1);
});
