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

type Callback = (...any) => mixed;

const SESSION_MODE = 'immersive-vr';
// 'local' places the origin at the viewer's head when the session starts,
// matching the seated, head-centered coordinates React 360 content is laid out in.
const REFERENCE_SPACE = 'local';
// Asked for, but not required: a browser without them still starts the session.
// - 'hand-tracking': on a Meta Quest, tracked hands only appear among the
//   session's input sources if this was requested.
// - 'local-floor': lets an app ask the session for a floor-relative reference
//   space of its own. The runtime itself stays on REFERENCE_SPACE.
const OPTIONAL_FEATURES = ['hand-tracking', 'local-floor'];

/**
 * State management for the WebXR immersive session.
 *
 * WebXR has no display object to hold on to: instead we track whether the
 * browser can start an immersive VR session, and the session, its reference
 * space, and the XRFrame of the animation frame in progress while one runs.
 */

export default class VRState {
  supported: boolean;
  _displayChangeCallbacks: Array<Callback>;
  _enterCallbacks: Array<Callback>;
  _exitCallbacks: Array<Callback>;
  _frame: ?XRFrame;
  _referenceSpace: ?XRReferenceSpace;
  _resetCallbacks: Array<Callback>;
  _session: ?XRSession;

  constructor() {
    this.supported = false;
    this._displayChangeCallbacks = [];
    this._enterCallbacks = [];
    this._exitCallbacks = [];
    this._frame = null;
    this._referenceSpace = null;
    this._resetCallbacks = [];
    this._session = null;

    (this: any)._onReset = this._onReset.bind(this);
    (this: any)._onSessionEnd = this._onSessionEnd.bind(this);
    (this: any)._updateSupported = this._updateSupported.bind(this);

    const xr = navigator.xr;
    if (xr) {
      // Listen for headsets that connect / disconnect after the page has loaded
      xr.addEventListener('devicechange', this._updateSupported);
      this._updateSupported();
    }
  }

  _updateSupported() {
    const xr = navigator.xr;
    if (!xr) {
      return;
    }
    xr.isSessionSupported(SESSION_MODE).then(
      supported => this._setSupported(supported),
      () => this._setSupported(false),
    );
  }

  _setSupported(supported: boolean) {
    if (this.supported === supported) {
      return;
    }
    this.supported = supported;
    this._callDisplayChangeCallbacks();
  }

  _callEnterCallbacks() {
    for (let i = 0; i < this._enterCallbacks.length; i++) {
      this._enterCallbacks[i](this._session);
    }
  }

  _callExitCallbacks() {
    for (let i = 0; i < this._exitCallbacks.length; i++) {
      this._exitCallbacks[i]();
    }
  }

  _callDisplayChangeCallbacks() {
    for (let i = 0; i < this._displayChangeCallbacks.length; i++) {
      this._displayChangeCallbacks[i](this.supported);
    }
  }

  /**
   * Called with the XRSession once a session has started and is ready to render.
   */
  onEnter(cb: Callback) {
    this._enterCallbacks.push(cb);
  }

  /**
   * Called after the session ends, whether through `endSession` or externally
   * (like the headset's system menu).
   */
  onExit(cb: Callback) {
    this._exitCallbacks.push(cb);
  }

  /**
   * Called when the origin of the reference space moves during a session,
   * which is what happens when the viewer recenters from the headset (holding
   * the Meta button on a Quest). Poses read from then on are relative to the
   * new origin, so anything remembered from earlier poses is out of date.
   */
  onReset(cb: Callback) {
    this._resetCallbacks.push(cb);
  }

  /**
   * Called with a boolean whenever immersive VR support changes.
   */
  onDisplayChange(cb: Callback) {
    this._displayChangeCallbacks.push(cb);
  }

  isSupported(): boolean {
    return this.supported;
  }

  isPresenting(): boolean {
    return !!this._session;
  }

  getSession(): ?XRSession {
    return this._session;
  }

  getReferenceSpace(): ?XRReferenceSpace {
    return this._referenceSpace;
  }

  /**
   * The XRFrame of the animation frame currently being processed. Only set
   * while inside a session's requestAnimationFrame callback, since an XRFrame
   * is invalid outside of it.
   */
  getFrame(): ?XRFrame {
    return this._frame;
  }

  setFrame(frame: ?XRFrame) {
    this._frame = frame;
  }

  /**
   * Start an immersive VR session. Must be called from a user gesture.
   * `prepare` sets up rendering for the new session (its base layer) before
   * the session is reported as entered.
   */
  requestSession(prepare: XRSession => Promise<mixed>): Promise<XRSession> {
    const xr = navigator.xr;
    if (!xr) {
      return Promise.reject(new Error('WebXR is not available'));
    }
    return xr.requestSession(SESSION_MODE, {optionalFeatures: OPTIONAL_FEATURES}).then(session =>
      session
        .requestReferenceSpace(REFERENCE_SPACE)
        .then(space => prepare(session).then(() => space))
        .then(
          space => {
            this._session = session;
            this._referenceSpace = space;
            session.addEventListener('end', this._onSessionEnd);
            space.addEventListener('reset', this._onReset);
            this._callEnterCallbacks();
            return session;
          },
          err => {
            session.end();
            throw err;
          },
        ),
    );
  }

  endSession(): Promise<void> {
    const session = this._session;
    return session ? session.end() : Promise.resolve();
  }

  _onReset(event: Event) {
    for (let i = 0; i < this._resetCallbacks.length; i++) {
      this._resetCallbacks[i](event);
    }
  }

  _onSessionEnd() {
    if (this._session) {
      this._session.removeEventListener('end', this._onSessionEnd);
    }
    if (this._referenceSpace) {
      this._referenceSpace.removeEventListener('reset', this._onReset);
    }
    this._session = null;
    this._referenceSpace = null;
    this._frame = null;
    this._callExitCallbacks();
  }
}
