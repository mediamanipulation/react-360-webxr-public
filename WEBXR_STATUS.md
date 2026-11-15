# WebXR port: status

Status as of 2026-11-14, against `facebookarchive/react-360` master (archived Dec 2020).

This began as a gap analysis of the port. The gaps it found are listed below as they were written, each marked with what has happened since.

| Gap | State |
| --- | --- |
| 1. Hand tracking never turns on | **Closed.** The session requests `hand-tracking` and `local-floor` as optional features. |
| 2. `ControllerInfo` doesn't see XR controllers | **Closed.** It follows the session's input sources. |
| 3. No thumbstick / axis events | **Closed.** Gamepad axes are sent as `axis` input events. |
| 4. Reference-space `reset` not handled | **Closed in code.** Reported as a `recenter` event. What content does on a real recenter still needs a headset check. |
| 5. The other `packages/` are still WebVR | **Decided.** Kept, and marked as unported in their README. |
| 6. Nothing installable yet | **Open.** The README now describes building from a checkout. Publishing to npm is still to do. |
| 7. Test coverage | **Closed.** Unit tests for `VRState`, `ControllerRaycaster`, `ControllerInfo` and axis events, and an emulator smoke test (`npm test` and `npm run smoke` in `webxr-demo`). `Compositor.renderXR` is covered only by the smoke test. |
| 8. Smaller items | **Partly.** `fixedFoveation` and `framebufferScaleFactor` are options. Haptics, Vision Pro and the AudioContext note are unchanged. |

Still unverified on a physical headset: the two layer options (the emulator ignores them), content after a real recenter, stereo panorama alignment, and audio panning.

Details of each are in [`React360/README.md`](React360/README.md).

## Summary

The port moves the `react-360-web` runtime (`React360/`) from WebVR to the WebXR Device API, and the core path works. It changes eight files: `VRState`, `Compositor`, `ReactInstance`, `GamepadInputChannel`, `ControllerRaycaster`, `GuiSys`, one test file and the README. Everything else in the runtime is untouched upstream code.

This analysis comes from a diff against upstream, a read of the remaining runtime for WebVR leftovers, and a run of `webxr-demo` on current tooling:

- `npm ci` and `npm run bundle` succeed on **Node 22.23**, so the toolchain patches hold.
- In **headless Chrome with IWER** (`?emulate`, emulated Quest 3), the "View in VR" button appears and `enterVR` starts an `immersive-vr` session with 2 input sources. Both eyes render, including the stereo layout, the right-controller beam and the cursor. `exitVR` ends the session, restores the window render loop and resets the button to "View in VR".
- At the time of writing it had **not** been run on a physical headset. Every item marked *headset* below needed that.

## What the port covers

| Area | Upstream (WebVR) | Port (WebXR) |
| --- | --- | --- |
| Device / support detection | `getVRDisplays`, `vrdisplayconnect` | `navigator.xr.isSessionSupported('immersive-vr')`, `devicechange` |
| Session lifecycle | `requestPresent` / `vrdisplaypresentchange` | `requestSession`, `local` reference space, `end` event (also catches system-menu exits) |
| Render loop | `display.requestAnimationFrame` | `session.requestAnimationFrame`, handed off cleanly on enter/exit |
| Rendering | Fixed left/right split + `submitFrame` | Per-`XRView` cameras and viewports into `XRWebGLLayer` |
| three.js r87 compatibility | n/a | `gl.bindFramebuffer(null)` redirected to the XR layer's framebuffer while presenting |
| Stereo panoramas / screens | eye `'left'`/`'right'` | Same, from `view.eye` (mono `'none'` → `null`) |
| Head pose | `VRFrameData.pose` | `getViewerPose`; keeps last pose on tracking loss |
| Controller ray | Gamepad `pose` + arm model fallback | `targetRaySpace` pose; follows last source to `selectstart`; prefers right hand → any pointer → gaze; no beam for gaze |
| Buttons | `getGamepads()` polling | Same polling over `session.inputSources[].gamepad`, `xr-standard` mapping, overrides by input profile name; `select` events for gamepad-less sources |
| GuiSys billboarding flag | `vrdisplaypresentchange` | `setVRPresenting()` from enter/exit |
| Spatial audio | Listener follows camera | Unchanged; still follows the head pose |
| Exit from desktop page | n/a | VR button switches to "Exit VR" while presenting |

## Gaps, as first written

Ordered by how likely they are to bite someone running an existing React 360 app.

### 1. Hand tracking never turns on (Quest) — *small fix, headset*

`VRState.requestSession` calls `xr.requestSession('immersive-vr')` with no options. On Quest, tracked hands appear as input sources only if `'hand-tracking'` is requested as an optional feature. The raycaster and the `select` handling already support hands, but they never get any. Fix:

```js
xr.requestSession(SESSION_MODE, {optionalFeatures: ['hand-tracking', 'local-floor']})
```

`local-floor` is only worth requesting if content should ever be floor-relative. The current `local` choice (head-centered) is correct for React 360 layouts, so keep `REFERENCE_SPACE = 'local'` either way.

### 2. `ControllerInfo` doesn't see XR controllers — *medium*

`React360/js/Modules/ControllerInfo.js` still enumerates `navigator.getGamepads()`. WebXR controllers aren't listed there, so apps that use `ControllerInfo` or listen for its `controllerConnected` / `controllerDisconnected` events see no controllers in VR. It needs to read `session.inputSources` and listen for `inputsourceschange`, reporting `handedness` as `hand` and `profiles[0]` as `id`.

### 3. No thumbstick / axis events — *medium, inherited*

`GamepadInputChannel` still has upstream's `// TODO: consider fetching axes change events`. React 360 never exposed axes. Quest users will expect the thumbstick to snap-turn or scroll, which it can't do without that. This is new API surface, not a port bug, so decide whether it's in scope.

### 4. Reference-space `reset` not handled — *small, headset*

When the user recenters (holding the Meta button), the browser fires `reset` on the `XRReferenceSpace`. Nothing listens for it. In `local` space the browser moves the origin itself, so content likely stays correct, but cursor smoothing, `Surface.recenter` and anything that caches the head pose should be checked on a headset.

### 5. The other `packages/` are still WebVR — *scope decision*

`packages/react-360` (`Container.js`, `WebVRCameraController.js`), `packages/vr-state` and `packages/vr-input-source` are Meta's unreleased next-gen runtime, and they still use `VRDisplay` throughout. Nothing in `React360/` or `webxr-demo` depends on them. Either mark them as unported in the README or delete them, so nobody assumes the whole repo is WebXR.

### 6. Distribution: nothing installable yet — *biggest adoption gap*

- The ported runtime isn't published. `react-360-web@1.1.0` on npm is still the WebVR build, and `react-360 init` scaffolds against it.
- Using the port today means copying the `webxr-demo/metro.config.js` approach, which resolves `react-360-web` from `../React360` because Metro 0.51 doesn't follow symlinks or `file:` dependencies.
- The root README's "Getting Started" still describes the 2018 CLI and "Node.js 6.0.0 or higher".

To make existing apps upgradeable with one change: publish `React360/` under a new scoped name, and either ship `patch-toolchain.js` as a standalone postinstall or document the steps.

### 7. Test coverage — *medium*

The only new tests are two `xrMappingLookup` cases. `VRState`, `Compositor.renderXR`, the render-loop handoff and `ControllerRaycaster` are untested. Two cheap additions:

- **Jest unit tests with a mocked `navigator.xr`** (session, input sources, select events) for `VRState` and the raycaster's source selection.
- **A headless smoke test using IWER.** The run described above takes about 40 lines with Playwright: start the packager, load `?emulate`, click "View in VR", assert `r360.vrState.isPresenting()` and 2 input sources, pull the trigger, `r360.exitVR()`, then assert the button is back. That fits in CI and catches session-lifecycle regressions without a headset.

### 8. Smaller items

- **Haptics.** Not exposed (`gamepad.hapticActuators`). New feature, not a regression.
- **Performance knobs.** No `framebufferScaleFactor` or `fixedFoveation` on the `XRWebGLLayer`. On Quest, `fixedFoveation` (e.g. `0.5`) is a cheap frame-rate win for panorama-heavy apps.
- **Apple Vision Pro.** Its `transient-pointer` input (gaze + pinch) exists only during a pinch. `_onSelectStart` accepts it, so clicks should work, but there's no hover on that device by design. Worth a check in the visionOS simulator.
- **AudioContext resume.** Browsers start it suspended until a user gesture. The "View in VR" click counts as one, but a 2D-only session with no click may still be silent (upstream behavior).
- **Framebuffer redirect.** The `bindFramebuffer(null)` trick relies on r87 binding `null` for the default framebuffer. It's sound for this version but becomes a liability with any three.js upgrade (see below).

## Modernization path (beyond the port)

> The last option below has since been started: [`modern/`](modern/README.md) is a React-360-style API on `@react-three/fiber` and `@react-three/xr`, beside the port.

The port restores old apps but keeps React 16.8, React Native 0.59, Metro 0.51 and three.js r87. If the goal grows from "React 360 runs again" to "React 360 worth choosing for new work", the order is:

1. **three.js r87 → current.** Delete the `bindFramebuffer` redirect and `renderXR`, and use `renderer.xr.setSession()` / `renderer.xr.getCamera()`. This also brings current loaders and color management. Watch for: `Geometry` removal (r125) in OVRUI/UIView and the custom materials, `getInverse` → `invert`, and color-space and tone-mapping defaults.
2. **Metro / React Native toolchain.** Replace the RN-0.59 bridge and worker bundling with a standard bundler (Vite or esbuild). This is the largest piece, because `Runtime/` and `Bridge/` assume the RN module system.
3. **React 16.8 → 18/19.** Comes with step 2, since the RN renderer pins the React version.

Steps 2 and 3 amount to a rewrite of the runtime layer. If that's the goal, compare it against building a React-360-style API (Surfaces, `asset()`, `VrButton`, `Environment`) on top of `@react-three/fiber` + `@react-three/xr`.

## Next steps

1. On-headset pass: recenter, the layer options, stereo panorama alignment, audio panning.
2. Publish the runtime and components to npm under a new name, with the toolchain patches as a standalone postinstall, so apps can upgrade without a checkout (gap 6).
3. Haptics, and a check in the visionOS simulator (gap 8).
