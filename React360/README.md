# `react-360-web`

`react-360-web` is the runtime environment for React 360 that allows applications
to render in a web browser. It renders to a web canvas, and uses the WebXR Device
API in supporting browsers to communicate with VR headsets.

The runtime contains code for initializing a React application in a Web Worker,
handles asynchronous communication between the window and that application, and
implements the primitives needed to render React 360 applications.

## React Native version

The runtime tells the React app it is React Native 0.59.10, matching the
React 16.8 version of React 360's components in [`../Libraries`](../Libraries).
React Native's JavaScript checks this at startup and logs an error if the
versions differ.

## WebXR

The runtime originally targeted WebVR, which browsers have since removed. It now
starts an `immersive-vr` WebXR session from the "View in VR" button, renders each
view of the viewer pose into the session's `XRWebGLLayer`, and reads controllers,
hands and gaze from the session's input sources. WebXR needs a secure context, so
serve your app over HTTPS (or from `localhost`).

Sessions use the `local` reference space, whose origin is the viewer's head when
the session starts, so content keeps the same head-centered layout it had under
WebVR. three.js stays at r87: it predates WebXR, so the compositor drives the XR
cameras and framebuffer itself.

The session asks for two optional features, and starts without them where a
browser doesn't have them. `hand-tracking` is what makes a Meta Quest report
tracked hands as input sources, so pointing and pinching works with the
controllers put down. `local-floor` is there for apps that want a floor-relative
reference space of their own from the session; the runtime doesn't use it.

`ControllerInfo` lists the session's input sources while in VR, alongside any
gamepads plugged into the computer. A headset's controllers, tracked hands and
gaze aren't in the Gamepad API, so `getControllers()` reads them from the
session, and `controllerConnected` / `controllerDisconnected` fire as the
session starts and ends and as controllers are picked up and put down. For an
input source:

- `id` is its most specific input profile, like `oculus-touch-v3` or
  `generic-hand` (`gaze` for gaze, which has none)
- `hand` is `'left'`, `'right'` or `null`
- `buttons` and `axes` count those of its gamepad, and are 0 if it has none
- `index` is unique among the connected controllers and stays the same while
  the source is connected. It isn't the gamepad's own index, which WebXR
  fixes at -1.
- `source` is the `source` of the input events its buttons produce, like
  `xr_right`, so the two can be matched up. Gamepads have it too, as
  `gamepad_0`.

Thumbsticks and touchpads send `axis` input events, to the `onInput` of the
component under the pointer like button events. This is new: React 360 never
reported axes, for WebVR controllers or plain gamepads.

```js
<View onInput={e => {
  const event = e.nativeEvent.inputEvent;
  if (event.type === 'axis' && event.axisClass === 'thumbstickX') {
    turn(event.value); // -1 (left) to 1 (right), 0 when let go
  }
}} />
```

- `value` runs from -1 to 1, left to right and up to down. Within 0.1 of the
  center it is reported as 0, and an event is only sent when it changes.
- `axis` is the axis number on the gamepad, and `source` matches the
  `source` of button events and of `ControllerInfo`.
- `axisClass` names it where the layout is known: `touchpadX`, `touchpadY`,
  `thumbstickX` and `thumbstickY` for WebXR controllers, and `leftX`, `leftY`,
  `rightX` and `rightY` for standard gamepads.

The session lifecycle, the pointer's choice of controller and `ControllerInfo`
have unit tests beside them in `__tests__` folders, and there is a smoke test
that runs a whole session against an emulated headset. Both run from
[`../webxr-demo`](../webxr-demo/README.md#tests) with `npm test` and
`npm run smoke`.

If your `client.js` used the VR internals directly, these changed:

- `r360.vrState` tracks the WebXR session instead of a `VRDisplay`:
  `isSupported()`, `isPresenting()`, `getSession()`, `getReferenceSpace()` and
  `endSession()` replace `getCurrentDisplay()`. `onDisplayChange` callbacks
  receive whether immersive VR is supported, and `onEnter` callbacks receive the
  `XRSession`.
- `r360.exitVR()` ends the session. While presenting, the overlay button turns
  into "Exit VR" for desktop headsets, where the page stays visible.
- `compositor.renderVR(display, frameData)` is now
  `compositor.renderXR(session, viewerPose)`, alongside `startXR(session)` and
  `stopXR()`.
- `ControllerRaycaster` and `GamepadInputChannel` take the `VRState` as an extra
  constructor argument. Custom gamepad mappings for WebXR controllers are keyed
  by input profile name, like `'oculus-touch-v3'`, since WebXR gamepads have no id.
