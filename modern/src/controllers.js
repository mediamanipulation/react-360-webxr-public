// React 360's ControllerInfo: the controllers, hands or gaze of the VR
// session, plus any gamepads plugged into the computer.

import {DeviceEventEmitter} from './state.js';

const sources = new Map();
let nextIndex = 0;
let session = null;

const getGamepads = () =>
  typeof navigator !== 'undefined' && navigator.getGamepads
    ? Array.from(navigator.getGamepads()).filter(Boolean)
    : [];

const describeGamepad = gamepad => ({
  index: gamepad.index,
  id: gamepad.id,
  buttons: gamepad.buttons.length,
  axes: gamepad.axes.length,
  hand: gamepad.hand || null,
  source: `gamepad_${gamepad.index}`,
});

function connect(inputSource) {
  if (sources.has(inputSource)) {
    return;
  }
  const gamepad = inputSource.gamepad;
  const handedness = inputSource.handedness;
  const info = {
    // A WebXR gamepad's own index is always -1. This one is unique, and
    // stays the same for as long as the source is connected.
    index: 100 + nextIndex++,
    id: (inputSource.profiles && inputSource.profiles[0]) || inputSource.targetRayMode,
    buttons: gamepad ? gamepad.buttons.length : 0,
    axes: gamepad ? gamepad.axes.length : 0,
    hand: handedness === 'left' || handedness === 'right' ? handedness : null,
    source: `xr_${handedness}`,
  };
  sources.set(inputSource, info);
  DeviceEventEmitter.emit('controllerConnected', info);
}

function disconnect(inputSource) {
  const info = sources.get(inputSource);
  if (info) {
    sources.delete(inputSource);
    DeviceEventEmitter.emit('controllerDisconnected', info);
  }
}

function onInputSourcesChange(event) {
  Array.from(event.removed).forEach(disconnect);
  Array.from(event.added).forEach(connect);
}

/**
 * Follow the input sources of a VR session, or of none when it ends.
 */
export function followSession(next) {
  if (next === session) {
    return;
  }
  if (session) {
    session.removeEventListener('inputsourceschange', onInputSourcesChange);
    Array.from(sources.keys()).forEach(disconnect);
  }
  session = next || null;
  if (session) {
    session.addEventListener('inputsourceschange', onInputSourcesChange);
    Array.from(session.inputSources).forEach(connect);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('gamepadconnected', event =>
    DeviceEventEmitter.emit('controllerConnected', describeGamepad(event.gamepad)),
  );
  window.addEventListener('gamepaddisconnected', event =>
    DeviceEventEmitter.emit('controllerDisconnected', describeGamepad(event.gamepad)),
  );
}

export const ControllerInfo = {
  /** Resolves with the controllers connected right now. */
  getControllers: () =>
    Promise.resolve(getGamepads().map(describeGamepad).concat(Array.from(sources.values()))),
};
