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
