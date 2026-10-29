/**
 * The music: a four-bar loop of sixteenth-note steps, worked out from the
 * mood and step number alone so it is the same every time. Notes are MIDI
 * numbers; scales are semitones above the mood's root.
 */

export const LOOP_STEPS = 64;

export const MOODS = {
  chill: {
    label: 'Chill',
    bpm: 84,
    root: 45,
    scale: [0, 3, 5, 7, 10],
    colors: ['#6cf0ff', '#7a5cff'],
    // One chord per bar, as scale degrees
    progression: [0, 2, 3, 1],
  },
  drive: {
    label: 'Drive',
    bpm: 118,
    root: 40,
    scale: [0, 2, 3, 5, 7, 8, 10],
    colors: ['#ff5c8a', '#ffb86c'],
    progression: [0, 5, 2, 6],
  },
  dream: {
    label: 'Dream',
    bpm: 70,
    root: 48,
    scale: [0, 2, 4, 7, 9],
    colors: ['#9cff9c', '#5cc8ff'],
    progression: [0, 3, 4, 2],
  },
};

export function midiToHz(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function stepSeconds(bpm) {
  return 60 / bpm / 4;
}

// A note `degree` steps up the scale (wrapping into higher octaves), plus
// `octave` octaves above the root
function scaleNote(mood, degree, octave) {
  const {root, scale} = mood;
  const wraps = Math.floor(degree / scale.length);
  return root + 12 * (octave + wraps) + scale[degree % scale.length];
}

// Integer hash, so the lead line varies from step to step without Math.random
function hash(n) {
  let h = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d);
  h ^= h >>> 15;
  return h >>> 0;
}

function kickAt(name, inBar) {
  if (name === 'drive') {
    return inBar % 4 === 0;
  }
  if (name === 'chill') {
    return inBar === 0 || inBar === 10;
  }
  return inBar === 0;
}

export function stepNotes(name, step) {
  const mood = MOODS[name];
  const s = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
  const bar = Math.floor(s / 16);
  const inBar = s % 16;
  const degree = mood.progression[bar];

  const chord = inBar === 0 ? [0, 2, 4].map(k => scaleNote(mood, degree + k, 1)) : null;
  // Root on most steps, the chord's fifth near the end of each half bar
  const bass = s % 2 === 0 ? scaleNote(mood, degree + (inBar % 8 === 6 ? 4 : 0), 0) : null;
  const h = hash(s + bar * 131);
  const lead =
    inBar % 4 === 2 && h % 3 !== 0
      ? scaleNote(mood, degree + (h % mood.scale.length), 2)
      : null;

  return {
    bass,
    chord,
    lead,
    kick: kickAt(name, inBar),
    // Off-beat eighths
    hat: inBar % 4 === 2,
  };
}
