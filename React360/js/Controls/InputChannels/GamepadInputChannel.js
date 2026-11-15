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

import type VRState from '../../Compositor/VRState';
import type {AxisEvent, ButtonEvent, InputEvent, InputChannel} from './Types';

type GamepadEvent = {gamepad: Gamepad};

type GamepadState = {
  axes: Array<number>,
  buttons: Array<{pressed: boolean, startTime: number}>,
};

type Mapping = Array<?string>;

const getGamepads = (navigator.getGamepads
  ? navigator.getGamepads
  : navigator.webkitGetGamepads
    ? navigator.webkitGetGamepads
    : () => []
).bind(navigator);

const LONG_PRESS_TIME = 500;
// A stick at rest rarely reads exactly 0. Anything this close to the center
// counts as the center.
const AXIS_DEADZONE = 0.1;
// How far an axis has to move from the value last reported to be reported
// again, so a stick held still doesn't send an event every frame.
const AXIS_STEP = 0.01;

// Touch controller buttons: thumbstick, trigger, grip, A/X, B/Y
const MAPPING_SHARED_TOUCH = [
  undefined,
  'confirm',
  undefined,
  'confirm',
  'back',
];
// MS Mixed Reality controller buttons: thumbstick, trigger, grip, menu, trackpad
const MAPPING_SHARED_MSMR = [
  undefined,
  'confirm',
  undefined,
  undefined,
  'confirm',
];
const WELL_KNOWN_MAPPINGS = {
  // Gear VR HMD Touchpad
  'Gear VR Touchpad': ['confirm'],
  // Gear VR Controller
  'Gear VR Controller': ['confirm', 'confirm'],
  // Oculus Go Controller
  'Oculus Go Controller': ['confirm', 'confirm'],
  // Daydream Controller
  'Daydream Controller': ['confirm'],
  // Oculus Touch
  'Oculus Touch (Left)': MAPPING_SHARED_TOUCH,
  'Oculus Touch (Right)': MAPPING_SHARED_TOUCH,
  // Standard MS Mixed Reality
  'Spatial Controller (Spatial Interaction Source) 045E-065B': MAPPING_SHARED_MSMR,
  // Samsung Odyssey
  'Spatial Controller (Spatial Interaction Source) 045E-065D': MAPPING_SHARED_MSMR,
  // TODO: Vive Wand mapping
};

export const STANDARD_MAPPING = [
  'confirm',
  'back',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  'up',
  'down',
  'left',
  'right',
];

// WebXR controller buttons ('xr-standard'): trigger, squeeze, touchpad, thumbstick, A/X, B/Y
export const XR_STANDARD_MAPPING = [
  'confirm',
  undefined,
  'confirm',
  undefined,
  'confirm',
  'back',
];

const DEFAULT_MAPPING = ['confirm'];

// Names for the axes of the two gamepad layouts browsers define. Other
// gamepads still send axis events, with only the axis number.
export const STANDARD_AXES = ['leftX', 'leftY', 'rightX', 'rightY'];
export const XR_STANDARD_AXES = ['touchpadX', 'touchpadY', 'thumbstickX', 'thumbstickY'];
const AXES_BY_MAPPING = {
  standard: STANDARD_AXES,
  'xr-standard': XR_STANDARD_AXES,
};
const NO_AXIS_NAMES = [];

export default class GamepadInputChannel implements InputChannel {
  _customMapping: {[id: string]: Mapping};
  _mappingCache: Array<?Mapping>;
  _previousState: Array<GamepadState>;
  _vrState: ?VRState;
  _xrPreviousState: {[source: string]: GamepadState};
  _xrSelectEvents: Array<ButtonEvent>;

  /**
   * `customMapping` is keyed by Gamepad id for regular gamepads, and by input
   * profile name (like 'oculus-touch-v3') for WebXR controllers.
   */
  constructor(customMapping: {[id: string]: Mapping} = {}, vrState?: VRState) {
    this._mappingCache = [];
    this._previousState = [];
    this._customMapping = customMapping;
    this._vrState = vrState || null;
    this._xrPreviousState = {};
    this._xrSelectEvents = [];

    (this: any)._onGamepadConnected = this._onGamepadConnected.bind(this);
    (this: any)._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);
    (this: any)._onXRSelect = this._onXRSelect.bind(this);

    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);

    if (vrState) {
      vrState.onEnter(session => {
        session.addEventListener('selectstart', this._onXRSelect);
        session.addEventListener('selectend', this._onXRSelect);
      });
      vrState.onExit(() => {
        this._xrPreviousState = {};
        this._xrSelectEvents.length = 0;
      });
    }
  }

  mappingLookup(gamepad: Gamepad): Mapping {
    let mapping = this._customMapping[gamepad.id];
    if (mapping) {
      return mapping;
    }
    if (gamepad.mapping === 'standard') {
      return STANDARD_MAPPING;
    }
    mapping = WELL_KNOWN_MAPPINGS[gamepad.id];
    if (mapping) {
      return mapping;
    }
    return DEFAULT_MAPPING;
  }

  xrMappingLookup(inputSource: XRInputSource, gamepad: Gamepad): Mapping {
    const profiles = inputSource.profiles;
    for (let i = 0; i < profiles.length; i++) {
      const mapping = this._customMapping[profiles[i]];
      if (mapping) {
        return mapping;
      }
    }
    if (gamepad.mapping === 'xr-standard') {
      return XR_STANDARD_MAPPING;
    }
    return DEFAULT_MAPPING;
  }

  _updateCacheEntry(gamepad: Gamepad): Mapping {
    const mapping = this.mappingLookup(gamepad);
    const cacheEntry = new Array(mapping.length);
    for (let btn = 0, len = mapping.length; btn < len; btn++) {
      if (mapping[btn]) {
        cacheEntry[btn] = mapping[btn];
      }
    }
    this._mappingCache[gamepad.index] = cacheEntry;
    return cacheEntry;
  }

  _onGamepadConnected(e: GamepadEvent) {
    this._updateCacheEntry(e.gamepad);
  }

  _onGamepadDisconnected(e: GamepadEvent) {
    const gamepad = e.gamepad;
    this._mappingCache[gamepad.index] = null;
  }

  /**
   * Input sources without a gamepad, like tracked hands or gaze, only report
   * select events (a pinch or tap). Those become 'confirm' button events.
   */
  _onXRSelect(event: XRInputSourceEvent) {
    const inputSource = event.inputSource;
    if (inputSource.gamepad) {
      // Its buttons are polled in getEvents
      return;
    }
    this._xrSelectEvents.push({
      type: 'button',
      button: 0,
      buttonClass: 'confirm',
      action: event.type === 'selectstart' ? 'down' : 'up',
      source: `xr_${inputSource.handedness}`,
    });
  }

  _fillButtonEvents(
    acc: Array<InputEvent>,
    now: number,
    source: string,
    state: GamepadState,
    buttons: $ReadOnlyArray<GamepadButton | number>,
    mapping: Mapping,
  ) {
    for (let btn = 0; btn < buttons.length; btn++) {
      let buttonState = state.buttons[btn];
      if (!buttonState) {
        buttonState = {
          pressed: false,
          startTime: -1,
        };
        state.buttons[btn] = buttonState;
      }
      const button = buttons[btn];
      const pressed = typeof button === 'object' ? button.pressed : button === 1.0;
      let action = null;
      if (buttonState.pressed !== pressed) {
        buttonState.pressed = pressed;
        if (pressed) {
          buttonState.startTime = now;
          action = 'down';
        } else {
          action = 'up';
        }
      } else if (pressed && now - buttonState.startTime > LONG_PRESS_TIME) {
        action = 'repeat';
      }
      if (action) {
        const event: ButtonEvent = {
          type: 'button',
          button: btn,
          action: action,
          source: source,
        };
        const buttonClass = mapping[btn];
        if (buttonClass) {
          event.buttonClass = buttonClass;
        }
        acc.push(event);
      }
    }
  }

  /**
   * Sticks and touchpads: an 'axis' event each time one moves, with a value
   * from -1 to 1 (left to right, and up to down), and a last one with value
   * 0 when it is let go.
   */
  _fillAxisEvents(
    acc: Array<InputEvent>,
    source: string,
    state: GamepadState,
    axes: $ReadOnlyArray<number>,
    names: Array<string>,
  ) {
    for (let axis = 0; axis < axes.length; axis++) {
      const raw = axes[axis];
      const value = Math.abs(raw) < AXIS_DEADZONE ? 0 : raw;
      const previous = state.axes[axis] || 0;
      if (value === previous || (value !== 0 && Math.abs(value - previous) < AXIS_STEP)) {
        continue;
      }
      state.axes[axis] = value;
      const event: AxisEvent = {
        type: 'axis',
        axis: axis,
        value: value,
        source: source,
      };
      if (names[axis]) {
        event.axisClass = names[axis];
      }
      acc.push(event);
    }
  }

  getEvents(acc: Array<InputEvent>): void {
    const now = Date.now();
    const gamepads = getGamepads();
    for (let id = 0; id < gamepads.length; id++) {
      const gamepad = gamepads[id];
      if (gamepad) {
        if (!this._previousState[id]) {
          this._previousState[id] = {
            buttons: [],
            axes: [],
          };
        }
        const mapping = this._mappingCache[gamepad.index] || this._updateCacheEntry(gamepad);
        this._fillButtonEvents(
          acc,
          now,
          `gamepad_${id}`,
          this._previousState[id],
          gamepad.buttons,
          mapping,
        );
        this._fillAxisEvents(
          acc,
          `gamepad_${id}`,
          this._previousState[id],
          gamepad.axes,
          AXES_BY_MAPPING[gamepad.mapping] || NO_AXIS_NAMES,
        );
      } else {
        if (this._previousState[id]) {
          delete this._previousState[id];
        }
      }
    }

    // WebXR controllers are not listed by navigator.getGamepads(); their
    // gamepads are only reachable through the session's input sources
    const session = this._vrState ? this._vrState.getSession() : null;
    if (session) {
      const inputSources = session.inputSources;
      for (let i = 0; i < inputSources.length; i++) {
        const inputSource = inputSources[i];
        const gamepad = inputSource.gamepad;
        if (gamepad) {
          const source = `xr_${inputSource.handedness}`;
          let state = this._xrPreviousState[source];
          if (!state) {
            state = {
              buttons: [],
              axes: [],
            };
            this._xrPreviousState[source] = state;
          }
          this._fillButtonEvents(
            acc,
            now,
            source,
            state,
            gamepad.buttons,
            this.xrMappingLookup(inputSource, gamepad),
          );
          this._fillAxisEvents(
            acc,
            source,
            state,
            gamepad.axes,
            AXES_BY_MAPPING[gamepad.mapping] || NO_AXIS_NAMES,
          );
        }
      }
    }
    for (let i = 0; i < this._xrSelectEvents.length; i++) {
      acc.push(this._xrSelectEvents[i]);
    }
    this._xrSelectEvents.length = 0;
  }
}
