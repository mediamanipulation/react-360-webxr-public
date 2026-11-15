/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

/* eslint-disable import/no-commonjs */

jest.dontMock('../InputChannels/GamepadInputChannel');

const GamepadInputChannel = require('../InputChannels/GamepadInputChannel')
  .default;

describe('GamepadInputChannel', () => {
  it('uses the standard mapping for standard gamepads', () => {
    const channel = new GamepadInputChannel();
    const mapping = channel.mappingLookup({id: 'pad', mapping: 'standard'});
    expect(mapping[0]).toBe('confirm');
    expect(mapping[1]).toBe('back');
    expect(mapping[12]).toBe('up');
    expect(mapping[13]).toBe('down');
    expect(mapping[14]).toBe('left');
    expect(mapping[15]).toBe('right');
  });

  it('allows overrides by gamepad id', () => {
    const channel = new GamepadInputChannel({
      gamemaster: ['confirm', 'back', '', '', 'up', 'down', 'left', 'right'],
    });
    const mapping = channel.mappingLookup({id: 'gamemaster'});
    expect(mapping[0]).toBe('confirm');
    expect(mapping[1]).toBe('back');
    expect(mapping[4]).toBe('up');
    expect(mapping[5]).toBe('down');
    expect(mapping[6]).toBe('left');
    expect(mapping[7]).toBe('right');

    // fallback to standard mapping otherwise
    const mapping2 = channel.mappingLookup({id: 'generic'});
    expect(mapping2).toEqual(['confirm']);
  });

  it('uses the xr-standard mapping for WebXR controllers', () => {
    const channel = new GamepadInputChannel();
    const mapping = channel.xrMappingLookup(
      {profiles: ['oculus-touch-v3', 'generic-trigger-squeeze-thumbstick']},
      {id: '', mapping: 'xr-standard'},
    );
    expect(mapping[0]).toBe('confirm'); // trigger
    expect(mapping[1]).toBe(undefined); // squeeze
    expect(mapping[4]).toBe('confirm'); // A / X
    expect(mapping[5]).toBe('back'); // B / Y

    const mapping2 = channel.xrMappingLookup({profiles: []}, {id: '', mapping: ''});
    expect(mapping2).toEqual(['confirm']);
  });

  it('allows overrides of WebXR controllers by input profile', () => {
    const channel = new GamepadInputChannel({
      'generic-trigger-squeeze-thumbstick': ['confirm', 'back'],
    });
    const mapping = channel.xrMappingLookup(
      {profiles: ['oculus-touch-v3', 'generic-trigger-squeeze-thumbstick']},
      {id: '', mapping: 'xr-standard'},
    );
    expect(mapping).toEqual(['confirm', 'back']);
  });
});

describe('GamepadInputChannel axis events', () => {
  let pads;
  let getGamepads;

  // The channel looks up navigator.getGamepads when it is first loaded
  beforeEach(() => {
    pads = [];
    getGamepads = navigator.getGamepads;
    navigator.getGamepads = () => pads;
    jest.resetModules();
  });

  afterEach(() => {
    navigator.getGamepads = getGamepads;
  });

  const load = () => require('../InputChannels/GamepadInputChannel').default;

  const axisEvents = channel => {
    const events = [];
    channel.getEvents(events);
    return events.filter(event => event.type === 'axis');
  };

  // A VRState with a session in progress, as far as the channel uses one
  const vrStateWith = inputSources => ({
    onEnter: () => {},
    onExit: () => {},
    getSession: () => ({inputSources}),
  });

  const touch = (handedness, axes) => ({
    handedness,
    profiles: ['oculus-touch-v3'],
    gamepad: {index: -1, id: '', mapping: 'xr-standard', buttons: [], axes},
  });

  it('reports a thumbstick moving, and coming back to rest', () => {
    const right = touch('right', [0, 0, 0, 0]);
    const channel = new (load())({}, vrStateWith([right]));
    expect(axisEvents(channel)).toEqual([]);

    right.gamepad.axes = [0, 0, 0.5, -1];
    expect(axisEvents(channel)).toEqual([
      {type: 'axis', axis: 2, axisClass: 'thumbstickX', value: 0.5, source: 'xr_right'},
      {type: 'axis', axis: 3, axisClass: 'thumbstickY', value: -1, source: 'xr_right'},
    ]);

    // Held still: nothing more to say
    expect(axisEvents(channel)).toEqual([]);

    right.gamepad.axes = [0, 0, 0, -1];
    expect(axisEvents(channel)).toEqual([
      {type: 'axis', axis: 2, axisClass: 'thumbstickX', value: 0, source: 'xr_right'},
    ]);
  });

  it('treats a stick near its center as centered', () => {
    const right = touch('right', [0, 0, 0.04, -0.09]);
    const channel = new (load())({}, vrStateWith([right]));
    expect(axisEvents(channel)).toEqual([]);

    right.gamepad.axes = [0, 0, 0.6, 0];
    expect(axisEvents(channel)).toHaveLength(1);
    // Let go, it settles a little off center
    right.gamepad.axes = [0, 0, 0.03, 0];
    expect(axisEvents(channel).map(event => event.value)).toEqual([0]);
  });

  it('ignores jitter smaller than a step', () => {
    const right = touch('right', [0, 0, 0.5, 0]);
    const channel = new (load())({}, vrStateWith([right]));
    axisEvents(channel);
    right.gamepad.axes = [0, 0, 0.505, 0];
    expect(axisEvents(channel)).toEqual([]);
    right.gamepad.axes = [0, 0, 0.52, 0];
    expect(axisEvents(channel).map(event => event.value)).toEqual([0.52]);
  });

  it('keeps the two hands apart', () => {
    const left = touch('left', [0, 0, -0.7, 0]);
    const right = touch('right', [0, 0, 0.7, 0]);
    const channel = new (load())({}, vrStateWith([left, right]));
    expect(axisEvents(channel).map(event => [event.source, event.value])).toEqual([
      ['xr_left', -0.7],
      ['xr_right', 0.7],
    ]);
  });

  it('reports the sticks of a gamepad plugged into the computer', () => {
    pads.push({index: 0, id: 'pad', mapping: 'standard', buttons: [], axes: [0, 0.8, 0, 0]});
    const channel = new (load())();
    expect(axisEvents(channel)).toEqual([
      {type: 'axis', axis: 1, axisClass: 'leftY', value: 0.8, source: 'gamepad_0'},
    ]);
  });

  it('numbers the axes of a gamepad whose layout it does not know', () => {
    pads.push({index: 0, id: 'odd', mapping: '', buttons: [], axes: [1]});
    const channel = new (load())();
    expect(axisEvents(channel)).toEqual([{type: 'axis', axis: 0, value: 1, source: 'gamepad_0'}]);
  });
});
