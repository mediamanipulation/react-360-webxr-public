# React 360, on a modern stack

A new runtime for React 360 apps, built on today's tools instead of the 2019
ones the original runtime is tied to:

| | Original runtime (`../React360`) | This one |
| --- | --- | --- |
| React | 16.8, through React Native 0.59 | 19 |
| three.js | r87 (2017) | r187 |
| Bundler | Metro, with patches to run on current Node | Vite |
| Rendering | Its own renderer in a web worker | [react-three-fiber](https://github.com/pmndrs/react-three-fiber) |
| Panels and text | Its own layout and text engine | [uikit](https://github.com/pmndrs/uikit): flexbox panels drawn in three.js |
| VR | Its own WebXR code | [@react-three/xr](https://github.com/pmndrs/xr) |

It keeps React 360's API. The demo here is the same app as
[`../webxr-demo`](../webxr-demo/README.md), with the same `index.js`: `View`,
`Text`, `Image`, `VrButton`, `StyleSheet`, `Animated`, `asset()`,
`Environment`, `AudioModule`, `VideoModule` and `ControllerInfo`, imported from
`react-360` as before.

This is a first slice, not a finished replacement. See
[what's not here yet](#whats-not-here-yet).

## Run it

```bash
npm install
npm start
```

Then open http://localhost:8083/index.html. Click a scene button to switch the
panorama, and drag to look around.

- **Without a headset:** open http://localhost:8083/index.html?emulate. Meta's
  WebXR emulator loads as a virtual Quest 3, and "View in VR" starts a real
  session. The device is `window.xrDevice`, as in `webxr-demo`.
- **On a Meta Quest:** connect it over USB, run
  `adb reverse tcp:8083 tcp:8083`, and open `http://localhost:8083/index.html`
  in the Quest browser.

`npm run build` writes a production build to `dist/`, and `npm run preview`
serves it.

## Tests

```bash
npm test        # unit tests
npm run smoke   # the demo in a headless browser, on the page and in emulated VR
```

The smoke test clicks a scene button with the mouse, enters VR, clicks another
with the controller's ray and trigger, swaps the controllers for hands, and
leaves again.

## Moving an app onto it

App code needs three small changes, which are all the demo needed:

1. **ES modules.** `module.exports = Thing` becomes `export default Thing`,
   and components are imported by path (`./components/Thing.jsx`) rather than
   by bare name.
2. **No Flow types.** Vite doesn't strip them.
3. **`client.js` imports the app.** There is no separate bundle to load, so
   the file that calls `AppRegistry.registerComponent` is imported directly,
   and `new ReactInstance(parent, options)` takes no bundle name. The old
   three-argument form still works, and ignores the first.

`vite.config.js` maps the names React 360 apps import (`react-360`,
`react-360-web`, `react-native` and `VideoModule`) onto `src/`.

## What's here

| React 360 | State |
| --- | --- |
| `View`, `Text`, `Image` | Flexbox layout, borders, radii, colors, padding and margins, from the same style objects |
| `VrButton` | `onClick`, `onEnter`, `onExit` and the click sounds, for mouse, controllers, hands and gaze |
| `StyleSheet`, style arrays | Yes |
| `Animated` | `Value`, `timing`, `spring`, `sequence`, `parallel`, `interpolate`, and animated `View`, `Text` and `Image` |
| `asset()` | Yes |
| `Environment` | 360 photo and video backgrounds |
| `AudioModule` | Environmental sound and one-shots |
| `VideoModule` | Players with play, pause, seek and status events |
| `ControllerInfo` | Controllers and hands of the VR session, and gamepads |
| `ReactInstance` | `createRoot`, `renderToSurface`, `getDefaultSurface`, `getAssetURL`, `enterVR`, `exitVR`, `vrState`, `scene`, and the `xr` options |
| `Surface` | Size, angle and radius |

## What's not here yet

- **Curved panels.** Cylinder surfaces are drawn flat.
- **3D content from React:** `Entity`, `Model`, the primitives (`Box`,
  `Sphere`…), lights, and `renderToLocation`. With react-three-fiber
  underneath, these are the next thing to add.
- **`axis` input events** and the full `onInput` event stream. `onInput`
  reports presses only.
- **Stereo panoramas**, spatial audio, the gaze cursor and the compass.
- **Custom native modules and custom views** written for the old runtime.
  Those were written against its internals and need rewriting as ordinary
  React components or modules.
- A few styles (`tintColor`, shadows) are ignored, with a console warning.

It has been checked on the page and in the emulator, not yet on a headset.
