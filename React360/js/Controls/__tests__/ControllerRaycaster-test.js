/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/* eslint-disable import/no-commonjs */

jest.dontMock('../Raycasters/ControllerRaycaster');
jest.dontMock('../../Utils/Math');

const ControllerRaycaster = require('../Raycasters/ControllerRaycaster').default;
const ControllerRenderer = require('../Utils/ControllerRenderer');

// A VRState with a session in progress: `sources` are its input sources, and
// each one's `pose` is where its ray is this frame
function fakeVRState(sources) {
  const enter = [];
  const exit = [];
  const selectListeners = [];
  const session = {
    inputSources: sources,
    addEventListener: (type, cb) => type === 'selectstart' && selectListeners.push(cb),
  };
  const frame = {
    session,
    getPose: jest.fn(space => space.pose),
  };
  const state = {
    frame,
    space: {},
    onEnter: cb => enter.push(cb),
    onExit: cb => exit.push(cb),
    getFrame: () => state.frame,
    getReferenceSpace: () => state.space,
    enter: () => enter.forEach(cb => cb(session)),
    exit: () => exit.forEach(cb => cb()),
    select: inputSource => selectListeners.forEach(cb => cb({inputSource})),
  };
  return state;
}

// Each source points along its own direction, so the ray tells them apart
const AHEAD = {x: 0, y: 0, z: 0, w: 1};
const BEHIND = {x: 0, y: 1, z: 0, w: 0};
const LEFTWARD = {x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2};

const source = (targetRayMode, handedness, orientation, position = {x: 0, y: 0, z: 0}) => ({
  targetRayMode,
  handedness,
  targetRaySpace: {pose: {transform: {orientation, position}}},
});

describe('ControllerRaycaster', () => {
  let mesh;
  let scene;

  const start = sources => {
    const vrState = fakeVRState(sources);
    const raycaster = new ControllerRaycaster(scene, vrState);
    vrState.enter();
    return {vrState, raycaster};
  };

  // The direction of this frame's ray, rounded, or null if there is none
  const direction = raycaster => {
    const result = [0, 0, 0];
    if (!raycaster.fillDirection(result)) {
      return null;
    }
    return result.map(n => Math.round(n) + 0);
  };

  beforeEach(() => {
    mesh = {
      visible: true,
      quaternion: {set: jest.fn()},
      position: {set: jest.fn()},
    };
    ControllerRenderer.createControllerMesh.mockReturnValue(mesh);
    scene = {add: jest.fn()};
  });

  it('adds its beam to the scene, hidden', () => {
    start([]);
    expect(scene.add).toBeCalledWith(mesh);
    expect(mesh.visible).toBe(false);
  });

  it('has no ray outside a session', () => {
    const {vrState, raycaster} = start([source('tracked-pointer', 'right', AHEAD)]);
    vrState.frame = null;
    expect(direction(raycaster)).toBeNull();
    expect(raycaster.fillOrigin([0, 0, 0])).toBe(false);
    expect(mesh.visible).toBe(false);
  });

  it('has no ray with no input sources', () => {
    const {raycaster} = start([]);
    expect(direction(raycaster)).toBeNull();
  });

  it('prefers the right hand until a source is used', () => {
    const {raycaster} = start([
      source('tracked-pointer', 'left', LEFTWARD),
      source('tracked-pointer', 'right', AHEAD),
    ]);
    expect(direction(raycaster)).toEqual([0, 0, -1]);
    expect(mesh.visible).toBe(true);
  });

  it('uses the left hand if it is the only pointer', () => {
    const {raycaster} = start([source('tracked-pointer', 'left', LEFTWARD)]);
    expect(direction(raycaster)).toEqual([-1, 0, 0]);
  });

  it('prefers a pointer to gaze', () => {
    const {raycaster} = start([
      source('gaze', 'none', BEHIND),
      source('tracked-pointer', 'left', LEFTWARD),
    ]);
    expect(direction(raycaster)).toEqual([-1, 0, 0]);
  });

  it('follows gaze without drawing a beam', () => {
    const {raycaster} = start([source('gaze', 'none', BEHIND)]);
    expect(direction(raycaster)).toEqual([0, 0, 1]);
    expect(mesh.visible).toBe(false);
  });

  it('switches to the source that last started a select', () => {
    const left = source('tracked-pointer', 'left', LEFTWARD);
    const right = source('tracked-pointer', 'right', AHEAD);
    const {vrState, raycaster} = start([left, right]);

    vrState.select(left);
    expect(direction(raycaster)).toEqual([-1, 0, 0]);

    vrState.select(right);
    expect(direction(raycaster)).toEqual([0, 0, -1]);
  });

  it('ignores selects from the screen', () => {
    // A tap on the page while the session shows there too. It is among the
    // session's sources for as long as the finger is down.
    const tap = source('screen', 'none', BEHIND);
    const {vrState, raycaster} = start([tap, source('tracked-pointer', 'right', AHEAD)]);
    vrState.select(tap);
    expect(direction(raycaster)).toEqual([0, 0, -1]);
  });

  it('falls back when the source in use goes away', () => {
    const left = source('tracked-pointer', 'left', LEFTWARD);
    const right = source('tracked-pointer', 'right', AHEAD);
    const sources = [left, right];
    const {vrState, raycaster} = start(sources);
    vrState.select(left);
    expect(direction(raycaster)).toEqual([-1, 0, 0]);

    // The left controller is put down
    sources.splice(0, 1);
    expect(direction(raycaster)).toEqual([0, 0, -1]);

    // Picking it up again doesn't take the ray back until it is used
    sources.unshift(left);
    expect(direction(raycaster)).toEqual([0, 0, -1]);
  });

  it('forgets the source in use when the session ends', () => {
    const left = source('tracked-pointer', 'left', LEFTWARD);
    const right = source('tracked-pointer', 'right', AHEAD);
    const {vrState, raycaster} = start([left, right]);
    vrState.select(left);
    vrState.exit();
    expect(direction(raycaster)).toEqual([0, 0, -1]);
  });

  it('has no ray while a source is not tracked', () => {
    const right = source('tracked-pointer', 'right', AHEAD);
    right.targetRaySpace.pose = null;
    const {raycaster} = start([right]);
    expect(direction(raycaster)).toBeNull();
    expect(mesh.visible).toBe(false);
  });

  it('starts the ray at the source and moves the beam there', () => {
    const {raycaster} = start([
      source('tracked-pointer', 'right', AHEAD, {x: 0.2, y: -0.3, z: -0.1}),
    ]);
    const origin = [0, 0, 0];
    direction(raycaster);
    expect(raycaster.fillOrigin(origin)).toBe(true);
    expect(origin).toEqual([0.2, -0.3, -0.1]);
    expect(mesh.position.set).toBeCalledWith(0.2, -0.3, -0.1);
    expect(mesh.quaternion.set).toBeCalledWith(0, 0, 0, 1);
  });

  it('can be disabled, and have its beam hidden', () => {
    const {raycaster} = start([source('tracked-pointer', 'right', AHEAD)]);

    raycaster.setRayRenderingEnabled(false);
    expect(direction(raycaster)).toEqual([0, 0, -1]);
    expect(mesh.visible).toBe(false);

    raycaster.disable();
    expect(direction(raycaster)).toBeNull();
    expect(raycaster.fillOrigin([0, 0, 0])).toBe(false);

    raycaster.enable();
    raycaster.setRayRenderingEnabled(true);
    expect(direction(raycaster)).toEqual([0, 0, -1]);
    expect(mesh.visible).toBe(true);
  });
});
