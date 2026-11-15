/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/* eslint-disable import/no-commonjs */

jest.dontMock('../VRState');

const VRState = require('../VRState').default;

// Lets the promise chains inside VRState run to their end
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function listeners() {
  const byType = {};
  return {
    addEventListener: jest.fn((type, cb) => {
      byType[type] = cb;
    }),
    removeEventListener: jest.fn((type, cb) => {
      if (byType[type] === cb) {
        delete byType[type];
      }
    }),
    dispatch: type => byType[type] && byType[type]({type}),
    listening: type => Boolean(byType[type]),
  };
}

// An XRSession as far as VRState uses one. end() fires the 'end' event, as
// the browser does however a session ends.
function fakeSession(space = listeners()) {
  const session = {
    ...listeners(),
    requestReferenceSpace: jest.fn(() => Promise.resolve(space)),
    end: jest.fn(() => {
      session.dispatch('end');
      return Promise.resolve();
    }),
  };
  return session;
}

// navigator.xr with a headset that is, or isn't, there
function fakeXR(supported = true) {
  const xr = {
    ...listeners(),
    supported,
    session: fakeSession(),
    isSessionSupported: jest.fn(() => Promise.resolve(xr.supported)),
    requestSession: jest.fn(() => Promise.resolve(xr.session)),
  };
  return xr;
}

const prepared = () => jest.fn(() => Promise.resolve());

describe('VRState', () => {
  afterEach(() => {
    delete navigator.xr;
  });

  describe('without WebXR', () => {
    it('is unsupported and never presenting', async () => {
      const state = new VRState();
      const onChange = jest.fn();
      state.onDisplayChange(onChange);
      await settle();
      expect(state.isSupported()).toBe(false);
      expect(state.isPresenting()).toBe(false);
      expect(state.getSession()).toBeNull();
      expect(onChange).not.toBeCalled();
    });

    it('refuses to start a session', async () => {
      const state = new VRState();
      await expect(state.requestSession(prepared())).rejects.toThrow('WebXR is not available');
    });

    it('has nothing to end', async () => {
      await expect(new VRState().endSession()).resolves.toBeUndefined();
    });
  });

  describe('support', () => {
    it('asks whether immersive VR is supported', async () => {
      navigator.xr = fakeXR(true);
      const state = new VRState();
      const onChange = jest.fn();
      state.onDisplayChange(onChange);
      expect(state.isSupported()).toBe(false);
      await settle();
      expect(navigator.xr.isSessionSupported).toBeCalledWith('immersive-vr');
      expect(state.isSupported()).toBe(true);
      expect(onChange.mock.calls).toEqual([[true]]);
    });

    it('stays unsupported with no headset, without reporting a change', async () => {
      navigator.xr = fakeXR(false);
      const state = new VRState();
      const onChange = jest.fn();
      state.onDisplayChange(onChange);
      await settle();
      expect(state.isSupported()).toBe(false);
      expect(onChange).not.toBeCalled();
    });

    it('treats a failed check as unsupported', async () => {
      navigator.xr = fakeXR(true);
      navigator.xr.isSessionSupported = jest.fn(() => Promise.reject(new Error('blocked')));
      const state = new VRState();
      await settle();
      expect(state.isSupported()).toBe(false);
    });

    it('follows a headset being plugged in and unplugged', async () => {
      const xr = (navigator.xr = fakeXR(false));
      const state = new VRState();
      const onChange = jest.fn();
      state.onDisplayChange(onChange);
      await settle();

      xr.supported = true;
      xr.dispatch('devicechange');
      await settle();
      expect(state.isSupported()).toBe(true);

      // Another device change that leaves support as it was
      xr.dispatch('devicechange');
      await settle();

      xr.supported = false;
      xr.dispatch('devicechange');
      await settle();
      expect(state.isSupported()).toBe(false);
      expect(onChange.mock.calls).toEqual([[true], [false]]);
    });
  });

  describe('starting a session', () => {
    let xr;
    let state;

    beforeEach(async () => {
      xr = navigator.xr = fakeXR(true);
      state = new VRState();
      await settle();
    });

    it('requests immersive VR with hand tracking and the floor as optional', async () => {
      await state.requestSession(prepared());
      expect(xr.requestSession).toBeCalledWith('immersive-vr', {
        optionalFeatures: ['hand-tracking', 'local-floor'],
      });
      // Nothing is required, so a browser without them still starts
      expect(xr.requestSession.mock.calls[0][1].requiredFeatures).toBeUndefined();
    });

    it("uses the 'local' reference space", async () => {
      const space = listeners();
      xr.session = fakeSession(space);
      await state.requestSession(prepared());
      expect(xr.session.requestReferenceSpace).toBeCalledWith('local');
      expect(state.getReferenceSpace()).toBe(space);
    });

    it('resolves with the session and reports it as entered', async () => {
      const onEnter = jest.fn();
      state.onEnter(onEnter);
      const session = await state.requestSession(prepared());
      expect(session).toBe(xr.session);
      expect(state.getSession()).toBe(session);
      expect(state.isPresenting()).toBe(true);
      expect(onEnter.mock.calls).toEqual([[session]]);
    });

    it('prepares rendering before reporting the session as entered', async () => {
      const order = [];
      let finishPreparing;
      const prepare = jest.fn(() => {
        order.push('prepare');
        return new Promise(resolve => {
          finishPreparing = resolve;
        });
      });
      state.onEnter(() => order.push('enter'));

      const request = state.requestSession(prepare);
      await settle();
      expect(prepare).toBeCalledWith(xr.session);
      expect(state.isPresenting()).toBe(false);
      expect(order).toEqual(['prepare']);

      finishPreparing();
      await request;
      expect(state.isPresenting()).toBe(true);
      expect(order).toEqual(['prepare', 'enter']);
    });

    it('passes on a refusal, like a missing user gesture', async () => {
      const onEnter = jest.fn();
      state.onEnter(onEnter);
      xr.requestSession = jest.fn(() => Promise.reject(new Error('SecurityError')));
      await expect(state.requestSession(prepared())).rejects.toThrow('SecurityError');
      expect(state.isPresenting()).toBe(false);
      expect(onEnter).not.toBeCalled();
    });

    it('ends the session if its reference space is refused', async () => {
      const onEnter = jest.fn();
      const onExit = jest.fn();
      state.onEnter(onEnter);
      state.onExit(onExit);
      xr.session.requestReferenceSpace = jest.fn(() => Promise.reject(new Error('NotSupported')));
      const prepare = prepared();

      await expect(state.requestSession(prepare)).rejects.toThrow('NotSupported');

      expect(xr.session.end).toBeCalled();
      expect(prepare).not.toBeCalled();
      expect(state.isPresenting()).toBe(false);
      expect(state.getReferenceSpace()).toBeNull();
      expect(onEnter).not.toBeCalled();
      // It was never entered, so it isn't reported as exited
      expect(onExit).not.toBeCalled();
    });

    it('ends the session if rendering cannot be prepared', async () => {
      const onEnter = jest.fn();
      state.onEnter(onEnter);
      const prepare = jest.fn(() => Promise.reject(new Error('no layer')));

      await expect(state.requestSession(prepare)).rejects.toThrow('no layer');

      expect(xr.session.end).toBeCalled();
      expect(state.isPresenting()).toBe(false);
      expect(onEnter).not.toBeCalled();
    });
  });

  describe('ending a session', () => {
    let xr;
    let state;
    let session;
    let onExit;

    beforeEach(async () => {
      xr = navigator.xr = fakeXR(true);
      state = new VRState();
      onExit = jest.fn();
      state.onExit(onExit);
      session = await state.requestSession(prepared());
      state.setFrame({});
    });

    const expectEnded = () => {
      expect(state.isPresenting()).toBe(false);
      expect(state.getSession()).toBeNull();
      expect(state.getReferenceSpace()).toBeNull();
      expect(state.getFrame()).toBeNull();
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(session.listening('end')).toBe(false);
    };

    it('ends it on request', async () => {
      await state.endSession();
      expect(session.end).toBeCalled();
      expectEnded();
    });

    it('notices it ending by itself, like from the headset menu', () => {
      session.dispatch('end');
      expect(session.end).not.toBeCalled();
      expectEnded();
    });

    it('can start another one afterwards', async () => {
      const onEnter = jest.fn();
      state.onEnter(onEnter);
      await state.endSession();

      const next = (xr.session = fakeSession());
      await state.requestSession(prepared());

      expect(state.getSession()).toBe(next);
      expect(onEnter.mock.calls).toEqual([[next]]);
      // The session that ended has no more say
      session.dispatch('end');
      expect(state.isPresenting()).toBe(true);
      expect(onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('recentering', () => {
    it('reports the reference space being reset, until the session ends', async () => {
      const xr = (navigator.xr = fakeXR(true));
      const space = listeners();
      xr.session = fakeSession(space);
      const state = new VRState();
      const onReset = jest.fn();
      state.onReset(onReset);
      await state.requestSession(prepared());

      space.dispatch('reset');
      expect(onReset).toHaveBeenCalledTimes(1);

      await state.endSession();
      expect(space.listening('reset')).toBe(false);
    });
  });

  it('holds the frame being processed', () => {
    const state = new VRState();
    const frame = {};
    expect(state.getFrame()).toBeNull();
    state.setFrame(frame);
    expect(state.getFrame()).toBe(frame);
    state.setFrame(null);
    expect(state.getFrame()).toBeNull();
  });
});
