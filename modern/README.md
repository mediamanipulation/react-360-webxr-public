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

It runs the demo and all four examples. See [what's not here
yet](#whats-not-here-yet) for the gaps that remain.

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

## The examples

All four demos in [`../examples`](../examples/README.md) run on this runtime,
loaded from there:

| Demo | Address | What is new here |
| --- | --- | --- |
| Code city | http://localhost:8083/examples/code-city/index.html | Only its client file |
| Solar system | http://localhost:8083/examples/solar-system/index.html | Its client file, and its planet view rewritten as a react-three-fiber component ([`Planet.jsx`](examples/solar-system/Planet.jsx)), about half the length of the original |
| Controller sandbox | http://localhost:8083/examples/controller-sandbox/index.html | Only its client file. Its custom view class and native module run as they are |
| Sound visualizer | http://localhost:8083/examples/sound-visualizer/index.html | Only its client file. Its custom view class, native module and synthesizer run as they are |

A client file is the short file that creates the `ReactInstance` and places
the roots. Add `?emulate` to any address for the virtual headset.

## Tests

```bash
npm test        # unit tests
npm run smoke   # the demo and the examples in a headless browser
```

The smoke test clicks a scene button with the mouse, enters VR in the
emulator, clicks another with the controller's ray and trigger, pushes a
thumbstick, swaps the controllers for hands, and leaves again. Then it runs
each example: it filters the code city, watches the planets move, launches
and clears a shape in the sandbox, and starts the music.

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
| `VrButton` | `onClick`, `onEnter`, `onExit` and the click sounds, for mouse, touch, controllers, hands and gaze |
| `onInput` | Button presses and `axis` events from thumbsticks and touchpads, sent to what the pointer is over |
| `StyleSheet`, style arrays | Yes |
| `Animated` | `Value`, `timing`, `spring`, `sequence`, `parallel`, `interpolate`, and animated `View`, `Text` and `Image` |
| `asset()` | Yes |
| `Environment` | 360 photo and video backgrounds, mono or stereo (`3DTB`, `3DBT`, `3DLR`) |
| `AudioModule` | Environmental sound, one-shots and named sounds. With `is3d` and a `position`, a sound is heard from its place in the world as you turn your head |
| `VideoModule` | Players with play, pause, seek and status events |
| `ControllerInfo` | Controllers and hands of the VR session, and gamepads |
| `Surface` | Curved (cylinder) and flat panels, with size, angle, radius and density |
| `Location`, `renderToLocation` | 3D content placed in the world |
| `Box`, `Plane`, `Sphere`, `Cylinder` | With `lit`, `wireframe`, color, opacity, style transforms and pointer events |
| `Entity` / `Model` | glTF 2 and OBJ (with MTL) models |
| `AmbientLight`, `PointLight`, `DirectionalLight`, `SpotLight` | Yes. Intensities are scaled to look as they did on three.js r87 |
| `View` and `VrButton` in a location | Groups that place and catch clicks for their 3D children |
| Custom views | The `customViews` option takes React components, usually react-three-fiber ones, and also classes written for the original runtime (`RCTBaseView` with a `UIView`). `requireNativeComponent(name)` draws them |
| Native modules | The `nativeModules` option takes objects with a `name`, or the original runtime's `Module` classes. The app calls them through `NativeModules`, and they send events through `DeviceEventEmitter` |
| `ReactInstance` | `createRoot`, `renderToSurface`, `renderToLocation`, `getAssetURL`, `enterVR`, `exitVR`, `whenReady`, `scene`, the `frame` and `xr` options, and the parts of `vrState`, `compositor` and `runtime` that client code uses |

### How it differs underneath

- **One thread.** The original ran the React app in a web worker and talked to
  the three.js side over a bridge. Here they share a thread, so custom views
  and native modules are called directly, and `NativeModules` methods return
  their values instead of promises of them (`ControllerInfo.getControllers()`
  still returns a promise).
- **Curved panels are textures.** A cylinder surface's UI is drawn into a
  texture each frame and shown on a curved mesh. Flat surfaces are drawn
  straight into the scene, which is sharper and cheaper, so prefer them for
  panels with a lot of text.
- **The floor is the origin in VR.** Content is still laid out around the
  viewer's head: the runtime moves it there when a session starts, and
  `vrState.getReferenceSpace()` gives a space with its origin at that point.
- **Clicks are timed.** A press held for more than 1.5 seconds is not a click.

## What's not here yet

- **Custom views that reach into the old runtime.** A view class runs here if
  it draws with three.js through `this.view` and `frame()`, as the examples
  do. One that relied on the old layout engine or on `THREE.Geometry`, which
  three.js has since removed, needs updating.
- **The gaze cursor and compass.** Controllers and hands show a ray and a dot
  where it lands; there is no reticle for head-gaze-only headsets.
- **`Pano`, `VideoPano`, `Scene` and `LiveEnvCamera`**, the older
  component forms of what `Environment` does.
- A few styles (`tintColor`, shadows) are ignored, with a console warning.
- The built-in font lacks some characters, such as `×` and `¼`. They are
  drawn with plain ones (`x`, `1/4`).

It has been checked on the page and in the emulator, not yet on a headset.
