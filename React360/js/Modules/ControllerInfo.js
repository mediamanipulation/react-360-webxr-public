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

import Module from './Module';

import type VRState from '../Compositor/VRState';
import type {ReactNativeContext} from '../ReactNativeContext';

type Info = {
  index: number,
  id: string,
  buttons: number,
  axes: number,
  hand: ?string,
  source: string,
};

const getGamepads = (navigator.getGamepads
  ? navigator.getGamepads
  : navigator.webkitGetGamepads ? navigator.webkitGetGamepads : () => []).bind(navigator);

function extractInfo(gamepad): ?Info {
  if (!gamepad) {
    return null;
  }

  return {
    index: gamepad.index,
    id: gamepad.id,
    buttons: gamepad.buttons.length,
    axes: gamepad.axes.length,
    hand: gamepad.hand || null,
    // The `source` of the input events this gamepad's buttons produce
    source: `gamepad_${gamepad.index}`,
  };
}

/**
 * ControllerInfo exposes information about connected gamepads and controllers.
 * It should be used to respond to controller connect / disconnect events, and
 * extracting static information about controllers (unique identifiers, button
 * and axis counts, left vs right hand, etc).
 * For controller button states and poses, rely on React VR's input events and
 * ray caster systems.
 *
 * Gamepads plugged into the computer come from the Gamepad API. In VR, the
 * headset's controllers, tracked hands and gaze are not listed there: they
 * are the input sources of the WebXR session, which come and go as the
 * session starts and ends, and as controllers are picked up and put down.
 */
export default class ControllerInfo extends Module {
  _rnctx: ReactNativeContext;
  _session: ?XRSession;
  _xrIndex: number;
  _xrSources: Map<XRInputSource, Info>;

  constructor(rnctx: ReactNativeContext) {
    super('ControllerInfo');
    this._rnctx = rnctx;
    this._session = null;
    this._xrIndex = 0;
    this._xrSources = new Map();
    (this: any)._onInputSourcesChange = this._onInputSourcesChange.bind(this);

    window.addEventListener('gamepadconnected', e => {
      this._emit('controllerConnected', extractInfo(e.gamepad));
    });

    window.addEventListener('gamepaddisconnected', e => {
      this._emit('controllerDisconnected', extractInfo(e.gamepad));
    });
  }

  _emit(type: string, info: ?Info) {
    this._rnctx.callFunction('RCTDeviceEventEmitter', 'emit', [type, info]);
  }

  /**
   * Follow the input sources of the VR sessions that `vrState` starts.
   */
  _setVRState(vrState: VRState) {
    vrState.onEnter((session: XRSession) => {
      this._session = session;
      session.addEventListener('inputsourceschange', this._onInputSourcesChange);
      // Sources already there when the session starts. A browser may also
      // announce them with an inputsourceschange event: _connect ignores
      // sources it has already reported.
      const inputSources = session.inputSources;
      for (let i = 0; i < inputSources.length; i++) {
        this._connect(inputSources[i]);
      }
    });
    vrState.onExit(() => {
      if (this._session) {
        this._session.removeEventListener('inputsourceschange', this._onInputSourcesChange);
        this._session = null;
      }
      // Leaving VR takes its controllers with it
      this._xrSources.forEach((info, inputSource) => this._disconnect(inputSource));
    });
  }

  _onInputSourcesChange(event: XRInputSourcesChangeEvent) {
    for (let i = 0; i < event.removed.length; i++) {
      this._disconnect(event.removed[i]);
    }
    for (let i = 0; i < event.added.length; i++) {
      this._connect(event.added[i]);
    }
  }

  _connect(inputSource: XRInputSource) {
    if (this._xrSources.has(inputSource)) {
      return;
    }
    const gamepad = inputSource.gamepad;
    const handedness = inputSource.handedness;
    const info = {
      // A WebXR gamepad's own index is always -1. This one is unique among
      // controllers, past the slots the Gamepad API has, and stays the same
      // for as long as the source is connected.
      index: getGamepads().length + this._xrIndex++,
      // The most specific input profile, like 'oculus-touch-v3' or
      // 'generic-hand'. Gaze has none.
      id: (inputSource.profiles && inputSource.profiles[0]) || inputSource.targetRayMode,
      buttons: gamepad ? gamepad.buttons.length : 0,
      axes: gamepad ? gamepad.axes.length : 0,
      hand: handedness === 'left' || handedness === 'right' ? handedness : null,
      // The `source` of the input events this controller's buttons produce
      source: `xr_${handedness}`,
    };
    this._xrSources.set(inputSource, info);
    this._emit('controllerConnected', info);
  }

  _disconnect(inputSource: XRInputSource) {
    const info = this._xrSources.get(inputSource);
    if (!info) {
      return;
    }
    this._xrSources.delete(inputSource);
    this._emit('controllerDisconnected', info);
  }

  /**
   * Get the current information from all connected controllers.
   * Resolves with an array of controller information objects.
   */
  $getControllers(success: number) {
    const controllers = [];
    const gamepads = getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (gamepad) {
        controllers.push(extractInfo(gamepads[i]));
      }
    }
    this._xrSources.forEach(info => controllers.push(info));
    this._rnctx.invokeCallback(success, [controllers]);
  }
}
