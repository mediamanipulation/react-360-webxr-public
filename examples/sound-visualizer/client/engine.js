/**
 * Plays the generated music with Web Audio on the main thread. Every voice is
 * an oscillator or a burst of noise; together they feed an analyser (which
 * the columns read) and a panner at the orb, so the music comes from there.
 */

import * as THREE from 'three';
import {LOOP_STEPS, midiToHz, MOODS, stepNotes, stepSeconds} from '../pattern';
import {resumeTime} from '../schedule';

export const ORB_POSITION = [0, 0.2, -3];

// The scheduler wakes up every 25 ms and queues anything due in the next
// 100 ms, so timing stays steady even when a frame runs long
const TICK_MS = 25;
const LOOKAHEAD_SECONDS = 0.1;
// The lowest frequency bins, up to about 3 kHz, where the bass and kick are
const LEVEL_BINS = 16;

let ctx = null;
let master = null;
let analyser = null;
let noise = null;
let timer = null;
let step = 0;
let nextTime = 0;
let mood = 'chill';
let volume = 0.7;
const frequencyData = new Uint8Array(128);

const headOrientation = new THREE.Quaternion();
const forward = new THREE.Vector3();
const up = new THREE.Vector3();

function setup() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = volume;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.75;
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 2;
  panner.setPosition(...ORB_POSITION);
  master.connect(analyser);
  analyser.connect(panner);
  panner.connect(ctx.destination);

  noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.random() * 2 - 1;
  }
}

// A gain envelope: rise to `peak` over `attack`, then decay over `decay`
function envelope(t, peak, attack, decay) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  gain.connect(master);
  return gain;
}

function tone(type, note, t, peak, attack, decay, filterHz) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = midiToHz(note);
  let out = envelope(t, peak, attack, decay);
  if (filterHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    filter.Q.value = 4;
    filter.connect(out);
    out = filter;
  }
  osc.connect(out);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

function kick(t) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  osc.connect(envelope(t, 0.9, 0.005, 0.3));
  osc.start(t);
  osc.stop(t + 0.35);
}

function hat(t) {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  filter.connect(envelope(t, 0.12, 0.002, 0.05));
  source.connect(filter);
  source.start(t);
  source.stop(t + 0.08);
}

function playStep(notes, t, stepLength) {
  if (notes.bass != null) {
    tone('sawtooth', notes.bass, t, 0.22, 0.01, stepLength * 1.8, 650);
  }
  if (notes.chord) {
    notes.chord.forEach(note => tone('triangle', note, t, 0.07, 0.4, stepLength * 14));
  }
  if (notes.lead != null) {
    tone('sine', notes.lead, t, 0.1, 0.01, 0.4);
  }
  if (notes.kick) {
    kick(t);
  }
  if (notes.hat) {
    hat(t);
  }
}

function schedule() {
  const stepLength = stepSeconds(MOODS[mood].bpm);
  // Entering VR or a garbage collection can stall the main thread past the
  // lookahead; skip what was missed rather than play it all at once
  if (nextTime < ctx.currentTime) {
    nextTime = resumeTime(nextTime, ctx.currentTime);
  }
  while (nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
    playStep(stepNotes(mood, step), nextTime, stepLength);
    nextTime += stepLength;
    step = (step + 1) % LOOP_STEPS;
  }
}

export const engine = {
  // Creates and starts the audio context. Browsers only allow that during a
  // user gesture, so client.js also calls this on the first click or tap.
  unlock() {
    if (!ctx) {
      setup();
    }
    if (ctx.state === 'suspended' && timer !== null) {
      ctx.resume();
    }
  },

  play() {
    this.unlock();
    ctx.resume();
    // Already playing: a second scheduler would double the tempo
    if (timer !== null) {
      return;
    }
    // Carries on from the steps queued before a pause
    nextTime = resumeTime(nextTime, ctx.currentTime);
    timer = setInterval(schedule, TICK_MS);
  },

  pause() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (ctx) {
      ctx.suspend();
    }
  },

  isPlaying() {
    return timer !== null;
  },

  // For checking from the console that only one scheduler runs, and where
  // the listener faces
  get _timer() {
    return timer;
  },

  get _context() {
    return ctx;
  },

  setMood(name) {
    if (MOODS[name]) {
      mood = name;
    }
  },

  setVolume(value) {
    volume = Math.min(1, Math.max(0, value));
    if (master) {
      master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    }
  },

  // Zeros until the music starts
  getFrequencyData() {
    if (analyser && timer !== null) {
      analyser.getByteFrequencyData(frequencyData);
    } else {
      frequencyData.fill(0);
    }
    return frequencyData;
  },

  // Loudness of the bass and beat from 0 to 1, from the last
  // getFrequencyData call
  getLevel() {
    let sum = 0;
    for (let i = 0; i < LEVEL_BINS; i++) {
      sum += frequencyData[i];
    }
    return sum / LEVEL_BINS / 255;
  },

  // Keeps the listener at the viewer's head, so turning changes what you hear.
  // `position` is [x, y, z] and `orientation` a quaternion [x, y, z, w].
  updateListener(position, orientation) {
    if (!ctx) {
      return;
    }
    const listener = ctx.listener;
    headOrientation.fromArray(orientation);
    forward.set(0, 0, -1).applyQuaternion(headOrientation);
    up.set(0, 1, 0).applyQuaternion(headOrientation);
    const [x, y, z] = position;
    if (listener.positionX) {
      listener.positionX.value = x;
      listener.positionY.value = y;
      listener.positionZ.value = z;
      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;
      listener.upX.value = up.x;
      listener.upY.value = up.y;
      listener.upZ.value = up.z;
    } else {
      listener.setPosition(x, y, z);
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  },
};
