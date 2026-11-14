# WebXRDemo

React 360's `BasicAppTemplate` sample, running on the React 360 sources in this
repository: the WebXR port of the runtime in [`../React360`](../React360/README.md)
and the React components in [`../Libraries`](../Libraries). It is set up like a
`react-360 init` project, but on React 16.8 and React Native 0.59 instead of
React 16.3 and React Native 0.55, so components can use hooks. three.js stays at
r87, and the toolchain gets the fixes it needs to run on current Node.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:8081/index.html. Hover the scene buttons and click one
to switch the panorama. The line under the panel counts the seconds since you
last switched scenes. It comes from `useState` and `useEffect` in `index.js`,
whose root component is written with hooks.

The last line lists the connected controllers, from React 360's
`ControllerInfo`. On the page that's any gamepads plugged in. In VR it's the
headset's controllers, and it changes to your hands when you put them down.

## Try VR without a headset

Open http://localhost:8081/index.html?emulate. This loads
[IWER](https://github.com/meta-quest/immersive-web-emulation-runtime), Meta's
WebXR emulator, as an emulated Quest 3, so a "View in VR" button appears and
starts a real `immersive-vr` session. The emulated device is `window.xrDevice`,
which you can drive from the console:

```js
xrDevice.stereoEnabled = true; // render both eyes
xrDevice.quaternion.set(0, 0.216, 0, 0.976); // turn the head 25° to the left
xrDevice.controllers.right.updateButtonValue('trigger', 1); // pull the trigger
xrDevice.controllers.right.updateButtonValue('trigger', 0); // and release it
```

While presenting, IWER's canvas covers the page, so leave VR from the console
with `r360.exitVR()`.

## On a headset

WebXR only runs in a secure context. For a Meta Quest, either:

- connect it over USB and run `adb reverse tcp:8081 tcp:8081`, then open
  `http://localhost:8081/index.html` in the Quest browser, or
- run `npm start -- --https` and open `https://<your computer's IP>:8081/index.html`.
  The first run creates a self-signed `key.pem` and `cert.pem` with `openssl`,
  so it needs to be on your PATH, and the browser will ask you to accept the
  certificate.

## Production build

```bash
npm run bundle
```

This writes `build/index.html` and the minified bundles. Copy `static_assets/`
into `build/` before deploying, because React 360's bundle script doesn't.

## How this differs from a `react-360 init` project

- `metro.config.js` loads `react-360-web` from `../React360` and `react-360`
  from `../Libraries`, which it adds as watch folders. Metro 0.51 doesn't follow
  symlinks, so npm `file:` dependencies won't work. The packages those folders
  import, such as `react` and `three`, resolve from this app's `node_modules`.
- `scripts/hasteImpl.js` names the Haste modules. React Native 0.59 names its
  own by file name, while React 360's components still declare theirs with
  `@providesModule`. It also names `../Libraries/react-360.js` as `react-360`,
  which makes `import ... from 'react-360'` load those sources rather than the
  npm package. That package is still installed for its `start` and `bundle`
  scripts.
- `metro.config.js` defines its own blacklist RegExp, because Metro's default
  one is invalid on Windows with current Node.
- `scripts/patch-toolchain.js` runs on `postinstall` and patches three things
  in `node_modules`:
  - It replaces `md4` with `md5` in Metro's cache-key hash, since OpenSSL 3 no
    longer provides `md4`.
  - It fixes the separator escaping in Metro's default blacklist, which the
    React Native CLI builds before it reads `metro.config.js`.
  - It changes `path.stop()` to `path.skip()` in the Babel preset's
    `Symbol` transform. Since Babel 7.17, `path.stop()` ends the whole
    traversal, so any file using `Symbol.iterator` would keep its Flow types.
- `index.html` has no `bridgeFile` option. The `react-360@1.1.0` package on npm
  predates `NonBlobBridge.js`, so the React app runs in the default Blob URL
  web worker.
- `index.js` and `src/components/BasicAppTemplateScenePage.react.js` fix the
  sample's `for (const i = 0; ...; i++)` loops, which throw on the first
  increment.
