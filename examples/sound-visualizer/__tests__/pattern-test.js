import {LOOP_STEPS, midiToHz, MOODS, stepNotes} from '../pattern';

test('midiToHz tunes A4 to 440 Hz', () => {
  expect(midiToHz(69)).toBe(440);
  expect(midiToHz(57)).toBeCloseTo(220, 6);
});

test('drive kicks four on the floor', () => {
  const kicks = [...Array(16).keys()].filter(s => stepNotes('drive', s).kick);
  expect(kicks).toEqual([0, 4, 8, 12]);
});

test('every note stays in its mood scale', () => {
  for (const name of Object.keys(MOODS)) {
    const {root, scale} = MOODS[name];
    for (let s = 0; s < LOOP_STEPS; s++) {
      const {bass, chord, lead} = stepNotes(name, s);
      [bass, lead, ...(chord || [])]
        .filter(n => n != null)
        .forEach(n => expect(scale).toContain((((n - root) % 12) + 12) % 12));
    }
  }
});

test('the pattern loops and is deterministic', () => {
  expect(stepNotes('chill', 5)).toEqual(stepNotes('chill', 5 + LOOP_STEPS));
  expect(stepNotes('dream', 9)).toEqual(stepNotes('dream', 9));
});
