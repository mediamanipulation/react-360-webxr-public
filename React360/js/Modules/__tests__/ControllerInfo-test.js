/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/* eslint-disable import/no-commonjs */

jest.dontMock('../ControllerInfo');
jest.dontMock('../Module');

const ControllerInfo = require('../ControllerInfo').default;

// A VRState as far as ControllerInfo uses one: it collects the callbacks,
// and enter() and exit() call them the way a session starting and ending would
function fakeVRState() {
  const enter = [];
  const exit = [];
  return {
    onEnter: cb => enter.push(cb),
    onExit: cb => exit.push(cb),
    enter: session => enter.forEach(cb => cb(session)),
    exit: () => exit.forEach(cb => cb()),
  };
}

function fakeSession(inputSources = []) {
  const listeners = {};
  return {
    inputSources,
    addEventListener: jest.fn((type, cb) => {
      listeners[type] = cb;
    }),
    removeEventListener: jest.fn((type, cb) => {
      if (listeners[type] === cb) {
        delete listeners[type];
      }
    }),
    // What the browser does when controllers are picked up or put down
    change(added, removed) {
      for (const source of removed) {
        inputSources.splice(inputSources.indexOf(source), 1);
      }
      inputSources.push(...added);
      listeners.inputsourceschange({added, removed});
    },
    listening: type => Boolean(listeners[type]),
  };
}

const touch = handedness => ({
  handedness,
  targetRayMode: 'tracked-pointer',
  profiles: ['oculus-touch-v3', 'generic-trigger-squeeze-thumbstick'],
  gamepad: {index: -1, buttons: [{}, {}, {}, {}, {}, {}], axes: [0, 0, 0, 0]},
});

const hand = handedness => ({
  handedness,
  targetRayMode: 'tracked-pointer',
  profiles: ['generic-hand'],
  hand: {},
});

const gaze = () => ({handedness: 'none', targetRayMode: 'gaze', profiles: []});

describe('ControllerInfo', () => {
  let rnctx;
  let info;
  let vrState;

  // The events sent to React, as [type, controller] pairs
  const events = () => rnctx.callFunction.mock.calls.map(call => call[2]);
  const controllers = () => {
    info.$getControllers(7);
    const calls = rnctx.invokeCallback.mock.calls;
    expect(calls[calls.length - 1][0]).toBe(7);
    return calls[calls.length - 1][1][0];
  };

  beforeEach(() => {
    rnctx = {callFunction: jest.fn(), invokeCallback: jest.fn()};
    info = new ControllerInfo(rnctx);
    vrState = fakeVRState();
    info._setVRState(vrState);
  });

  it('has no controllers outside VR', () => {
    expect(controllers()).toEqual([]);
    expect(events()).toEqual([]);
  });

  it('reports the controllers a session starts with', () => {
    vrState.enter(fakeSession([touch('left'), touch('right')]));

    const [left, right] = controllers();
    expect(left).toEqual({
      index: left.index,
      id: 'oculus-touch-v3',
      buttons: 6,
      axes: 4,
      hand: 'left',
      source: 'xr_left',
    });
    expect(right.hand).toBe('right');
    expect(right.source).toBe('xr_right');
    expect(right.index).not.toBe(left.index);
    expect(events()).toEqual([['controllerConnected', left], ['controllerConnected', right]]);
    expect(rnctx.callFunction.mock.calls[0].slice(0, 2)).toEqual(['RCTDeviceEventEmitter', 'emit']);
  });

  it('reports each controller once, even if the browser also announces it', () => {
    const left = touch('left');
    const session = fakeSession([left]);
    vrState.enter(session);
    session.change([left], []);
    expect(events()).toHaveLength(1);
    expect(controllers()).toHaveLength(1);
  });

  it('follows controllers being put down for hands', () => {
    const left = touch('left');
    const right = touch('right');
    const session = fakeSession([left, right]);
    vrState.enter(session);
    const before = controllers();
    rnctx.callFunction.mockClear();

    session.change([hand('left'), hand('right')], [left, right]);

    const after = controllers();
    expect(after.map(c => c.id)).toEqual(['generic-hand', 'generic-hand']);
    expect(after.map(c => c.hand)).toEqual(['left', 'right']);
    // A hand has no gamepad: it only pinches, which arrives as a select event
    expect(after.map(c => c.buttons)).toEqual([0, 0]);
    expect(after.map(c => c.axes)).toEqual([0, 0]);
    expect(events()).toEqual([
      ['controllerDisconnected', before[0]],
      ['controllerDisconnected', before[1]],
      ['controllerConnected', after[0]],
      ['controllerConnected', after[1]],
    ]);
    // Indices aren't handed out twice
    const indices = before.concat(after).map(c => c.index);
    expect(new Set(indices).size).toBe(4);
  });

  it('describes gaze, which has no hand and no profile', () => {
    vrState.enter(fakeSession([gaze()]));
    const [only] = controllers();
    expect(only.id).toBe('gaze');
    expect(only.hand).toBeNull();
    expect(only.source).toBe('xr_none');
    expect(only.buttons).toBe(0);
  });

  it('disconnects everything when the session ends', () => {
    const session = fakeSession([touch('left'), touch('right')]);
    vrState.enter(session);
    const connected = controllers();
    rnctx.callFunction.mockClear();

    vrState.exit();

    expect(events()).toEqual([
      ['controllerDisconnected', connected[0]],
      ['controllerDisconnected', connected[1]],
    ]);
    expect(controllers()).toEqual([]);
    expect(session.listening('inputsourceschange')).toBe(false);
  });

  it('starts afresh with the next session', () => {
    vrState.enter(fakeSession([touch('right')]));
    vrState.exit();
    rnctx.callFunction.mockClear();

    vrState.enter(fakeSession([touch('right')]));

    expect(events()).toHaveLength(1);
    expect(events()[0][0]).toBe('controllerConnected');
    expect(controllers()).toHaveLength(1);
  });

  it('ignores a source it never reported going away', () => {
    const session = fakeSession([]);
    vrState.enter(session);
    session.inputSources.push(touch('left'));
    session.change([], [session.inputSources[0]]);
    expect(events()).toEqual([]);
  });
});
