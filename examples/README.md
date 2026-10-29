# React 360 examples

Four showcase demos of this fork of React 360: React 16.8 with hooks for the
UI, three.js effects written as React components, all running on WebXR. Each
demo works with a mouse on desktop, on a WebXR headset, and in a VR emulator
in the browser.

| Demo | What you do | What it shows |
| --- | --- | --- |
| [Solar system](solar-system) | Point at the Sun or a planet and click to read its facts; change the speed of time. | A three.js custom view (`Planet`) that animates itself, wrapped in `VrButton` for pointing and clicks; two React roots sharing state. |
| [Controller sandbox](controller-sandbox) | Pull the trigger, or click empty space, to launch glowing shapes that float and bounce. | WebXR controller poses and `select` events, per-frame physics on the main thread, and a native module that reports back to React. |
| [Sound visualizer](sound-visualizer) | Play music generated live in the browser; turn your head to hear it move. | Web Audio with an HRTF panner, a listener that follows the head from the WebXR viewer pose, and columns driven by the analyser. |
| [Code city](code-city) | Walk around React 360's own source code: one building per file, as tall as the file is long. | Hundreds of React 360 `Box` primitives laid out in React with `useMemo` and `React.memo`, with hover on each. |

## Run them

```bash
npm install
npm start
```

Then open http://localhost:8081/index.html, a landing page that links to each
demo. Add `?emulate` to a demo's address (the landing page has a link for
each) to load [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime),
Meta's WebXR emulator, as a virtual Quest 3, so "View in VR" works without a
headset. The emulated device is `window.xrDevice`, which you can drive from
the console, as [webxr-demo's README](../webxr-demo/README.md) shows.

WebXR only runs in a secure context. For a Meta Quest, either connect it over
USB, run `adb reverse tcp:8081 tcp:8081`, and open
`http://localhost:8081/index.html` in the Quest browser, or run
`npm start -- --https` and open `https://<your computer's IP>:8081/index.html`.
The `--https` option needs `openssl` on your PATH, and the browser will ask you
to accept its self-signed certificate.

## How they're built

Each demo folder has the same shape:

- `index.html` loads `../shared/emulate.js`, then the demo's `client.js`
  bundle, then starts the React app.
- `client.js` runs on the main thread. It creates the `ReactInstance`,
  registers the demo's three.js custom views and native modules, and places
  the React roots: the 3D scene in a `Location` and the panel on a flat
  `Surface`.
- `index.js` registers the React roots. The components live in `components/`
  and are function components with hooks.
- Pure logic (orbits, physics, the music, the city layout) sits in its own
  module with Jest tests in `__tests__/`.

A few patterns repeat across the demos:

- **three.js as React components.** A class extending `RCTBaseView` from
  `react-360-web`, registered with `customViews: [{name, view}]`, becomes a
  React component through `requireNativeComponent(name)`. The view applies its
  props in setters and animates itself in `frame(timeStamp, deltaTime)` on the
  main thread, so motion never crosses the bridge. See
  [`solar-system/client/PlanetView.js`](solar-system/client/PlanetView.js).
- **Pointing at custom views.** Wrapping a custom view in `VrButton` gives it
  `onEnter`, `onExit` and `onClick`, from the mouse or a controller. React 360's
  built-in shapes such as `Box` take `onEnter` and `onExit` directly.
- **Main-thread services.** Anything the worker can't do, such as Web Audio, is
  a `Module` from `react-360-web`, passed in `nativeModules` and called from
  React through `NativeModules`. A module talks back with
  `ctx.callFunction('RCTDeviceEventEmitter', 'emit', [name, value])`, which
  React hears through `DeviceEventEmitter` from `react-native`.
- **State across roots.** The scene and the panel are separate React roots, so
  they share state through the small hook-based store in
  [`shared/store.js`](shared/store.js).
- **The head in VR.** While presenting, the main camera stays still and each
  eye gets its own. Code that needs the head pose reads it from
  `r360.vrState.getFrame()` during the `frame` callback, as
  [`sound-visualizer/client.js`](sound-visualizer/client.js) does.
- **Panels.** [`shared/client/panelSurface.js`](shared/client/panelSurface.js)
  makes a flat panel at an angle, distance and pixel density. A panel's root
  view must be given its surface's exact pixel size, which each demo keeps in
  `constants.js`, or its text won't wrap.

## Scripts

- `npm test` runs the Jest tests.
- `npm run generate:code-city` rebuilds `code-city/data.json` from the files git
  tracks in `../React360/js` and `../Libraries`.
- `npm run bundle` builds every demo for production into `build/`, which can be
  served as static files. `build/index.html` is the landing page.

## Setup

The project is set up like [`webxr-demo/`](../webxr-demo/README.md): React
16.8.3 and React Native 0.59.10, with `metro.config.js` loading the runtime
from `../React360` and the components from `../Libraries`, and
`scripts/patch-toolchain.js` patching Metro for current Node after each
install. The npm `react-360` package is only there for its `start` script.

## Known issues

- Metro's file watcher on Windows doesn't notice new folders. After adding a
  folder, restart `npm start`.
- React 360 draws a `Text` placed beside another `Text`, in a row or in
  side-by-side columns, one line higher than its layout says. The panels put
  each label and value in a single `Text` to avoid it.
