import {describe, expect, it} from 'vitest';
import {gamepadEvents} from '../src/input.js';

const BUTTONS = ['confirm', undefined, 'confirm', undefined, 'confirm', 'back'];
const AXES = ['touchpadX', 'touchpadY', 'thumbstickX', 'thumbstickY'];

const pad = (pressed = [], axes = [0, 0, 0, 0]) => ({
  buttons: [0, 1, 2, 3, 4, 5].map(index => ({pressed: pressed.includes(index)})),
  axes,
});

describe('gamepadEvents', () => {
  const read = (state, gamepad, now = 0) =>
    gamepadEvents('xr_right', gamepad, BUTTONS, AXES, state, now);

  it('reports nothing for a controller at rest', () => {
    expect(read({buttons: [], axes: []}, pad())).toEqual([]);
  });

  it('reports a trigger pull and release as the confirm button', () => {
    const state = {buttons: [], axes: []};
    expect(read(state, pad([0]), 1000)).toEqual([
      {type: 'button', button: 0, buttonClass: 'confirm', action: 'down', source: 'xr_right'},
    ]);
    expect(read(state, pad([0]), 1100)).toEqual([]);
    expect(read(state, pad(), 1200)).toEqual([
      {type: 'button', button: 0, buttonClass: 'confirm', action: 'up', source: 'xr_right'},
    ]);
  });

  it('repeats a button held for more than half a second', () => {
    const state = {buttons: [], axes: []};
    read(state, pad([5]), 1000);
    expect(read(state, pad([5]), 1400)).toEqual([]);
    expect(read(state, pad([5]), 1600)).toEqual([
      {type: 'button', button: 5, buttonClass: 'back', action: 'repeat', source: 'xr_right'},
    ]);
  });

  it('leaves buttons with no meaning unnamed', () => {
    const [event] = read({buttons: [], axes: []}, pad([1]));
    expect(event).toEqual({type: 'button', button: 1, action: 'down', source: 'xr_right'});
  });

  it('reports a thumbstick moving, holding still, and coming back to rest', () => {
    const state = {buttons: [], axes: []};
    expect(read(state, pad([], [0, 0, 0.5, -1]))).toEqual([
      {type: 'axis', axis: 2, axisClass: 'thumbstickX', value: 0.5, source: 'xr_right'},
      {type: 'axis', axis: 3, axisClass: 'thumbstickY', value: -1, source: 'xr_right'},
    ]);
    expect(read(state, pad([], [0, 0, 0.5, -1]))).toEqual([]);
    expect(read(state, pad([], [0, 0, 0.03, -1]))).toEqual([
      {type: 'axis', axis: 2, axisClass: 'thumbstickX', value: 0, source: 'xr_right'},
    ]);
  });

  it('ignores a stick near its center, and jitter smaller than a step', () => {
    const state = {buttons: [], axes: []};
    expect(read(state, pad([], [0, 0, 0.09, 0]))).toEqual([]);
    read(state, pad([], [0, 0, 0.5, 0]));
    expect(read(state, pad([], [0, 0, 0.505, 0]))).toEqual([]);
    expect(read(state, pad([], [0, 0, 0.52, 0])).map(event => event.value)).toEqual([0.52]);
  });
});
