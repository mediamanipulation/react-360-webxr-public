// React 360's input events: button presses and thumbstick movements, sent to
// the onInput of whatever the pointer is over.

import {useEffect, useMemo, useRef} from 'react';

// A stick at rest rarely reads exactly 0
const AXIS_DEADZONE = 0.1;
// How far an axis has to move from the value last reported to be reported again
const AXIS_STEP = 0.01;
const LONG_PRESS_MS = 500;

// WebXR controller buttons ('xr-standard'): trigger, squeeze, touchpad, thumbstick, A/X, B/Y
const XR_BUTTONS = ['confirm', undefined, 'confirm', undefined, 'confirm', 'back'];
const XR_AXES = ['touchpadX', 'touchpadY', 'thumbstickX', 'thumbstickY'];
// Standard gamepads
const PAD_BUTTONS = ['confirm', 'back'];
PAD_BUTTONS[12] = 'up';
PAD_BUTTONS[13] = 'down';
PAD_BUTTONS[14] = 'left';
PAD_BUTTONS[15] = 'right';
const PAD_AXES = ['leftX', 'leftY', 'rightX', 'rightY'];

// The onInput handlers of the components the pointer is over right now
const hovered = new Set();

export function addInputTarget(handler) {
  hovered.add(handler);
}

export function removeInputTarget(handler) {
  hovered.delete(handler);
}

function send(inputEvent) {
  hovered.forEach(handler => handler({nativeEvent: {inputEvent}}));
}

const states = new Map();

function stateOf(source) {
  if (!states.has(source)) {
    states.set(source, {buttons: [], axes: []});
  }
  return states.get(source);
}

/**
 * The events for one gamepad since the last call. Exported for testing.
 */
export function gamepadEvents(source, gamepad, buttonNames, axisNames, state, now) {
  const events = [];
  gamepad.buttons.forEach((button, index) => {
    const pressed = typeof button === 'object' ? button.pressed : button === 1;
    const previous = state.buttons[index] || (state.buttons[index] = {pressed: false, since: 0});
    let action = null;
    if (pressed !== previous.pressed) {
      previous.pressed = pressed;
      previous.since = now;
      action = pressed ? 'down' : 'up';
    } else if (pressed && now - previous.since > LONG_PRESS_MS) {
      action = 'repeat';
    }
    if (action) {
      const event = {type: 'button', button: index, action, source};
      if (buttonNames[index]) {
        event.buttonClass = buttonNames[index];
      }
      events.push(event);
    }
  });
  gamepad.axes.forEach((raw, axis) => {
    const value = Math.abs(raw) < AXIS_DEADZONE ? 0 : raw;
    const previous = state.axes[axis] || 0;
    if (value === previous || (value !== 0 && Math.abs(value - previous) < AXIS_STEP)) {
      return;
    }
    state.axes[axis] = value;
    const event = {type: 'axis', axis, value, source};
    if (axisNames[axis]) {
      event.axisClass = axisNames[axis];
    }
    events.push(event);
  });
  return events;
}

/**
 * Called every frame: reads the session's controllers and any gamepads, and
 * sends what changed to the components under the pointer.
 */
export function pollInput(session) {
  const now = Date.now();
  const seen = new Set();
  const read = (source, gamepad, buttons, axes) => {
    seen.add(source);
    gamepadEvents(source, gamepad, buttons, axes, stateOf(source), now).forEach(send);
  };
  if (session) {
    for (const inputSource of session.inputSources) {
      const gamepad = inputSource.gamepad;
      if (gamepad) {
        const standard = gamepad.mapping === 'xr-standard';
        read(`xr_${inputSource.handedness}`, gamepad, standard ? XR_BUTTONS : ['confirm'], standard ? XR_AXES : []);
      }
    }
  }
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gamepad of pads) {
    if (gamepad) {
      const standard = gamepad.mapping === 'standard';
      read(`gamepad_${gamepad.index}`, gamepad, standard ? PAD_BUTTONS : ['confirm'], standard ? PAD_AXES : []);
    }
  }
  // A controller that went away starts afresh if it comes back
  Array.from(states.keys()).forEach(source => {
    if (!seen.has(source)) {
      states.delete(source);
    }
  });
}

/**
 * The pointer handlers for a component with React 360's events: onEnter,
 * onExit, onMove, onClick and onInput. While the pointer is over it, the
 * component's onInput gets the controllers' button and stick events; a mouse
 * or finger press counts as the confirm button.
 */
export function useInputHandlers({onEnter, onExit, onMove, onClick, onInput}) {
  const latest = useRef(onInput);
  latest.current = onInput;
  // One handler for the life of the component, whatever onInput is this render
  const target = useMemo(() => event => latest.current && latest.current(event), []);
  useEffect(() => () => removeInputTarget(target), [target]);

  const props = {};
  if (onEnter || onInput) {
    props.onPointerEnter = event => {
      if (latest.current) {
        addInputTarget(target);
      }
      if (onEnter) {
        onEnter(event);
      }
    };
  }
  if (onExit || onInput) {
    props.onPointerLeave = event => {
      removeInputTarget(target);
      if (onExit) {
        onExit(event);
      }
    };
  }
  if (onMove) {
    props.onPointerMove = onMove;
  }
  if (onClick) {
    props.onClick = onClick;
  }
  if (onInput) {
    // Controllers report their own buttons. The mouse and touch do not.
    const press = action => event => {
      if (String(event.pointerType).startsWith('screen')) {
        onInput({
          nativeEvent: {
            inputEvent: {type: 'button', button: 0, buttonClass: 'confirm', action, source: event.pointerType},
          },
        });
      }
    };
    props.onPointerDown = press('down');
    props.onPointerUp = press('up');
  }
  return props;
}
