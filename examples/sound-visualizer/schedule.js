// How far ahead of the audio clock a fresh start is scheduled, in seconds
export const START_MARGIN_SECONDS = 0.05;

// When the next step should play, given when it was due (`nextTime`) and the
// audio clock (`now`). Steps already queued ahead of the clock keep their
// time, so playing after a pause carries on without doubling a step. A step
// that fell behind, after a stall longer than the scheduler's lookahead,
// moves up to now, so missed steps are skipped rather than all sounding at
// once.
export function resumeTime(nextTime, now) {
  return Math.max(nextTime, now + START_MARGIN_SECONDS);
}
