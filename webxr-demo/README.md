# WebXRDemo

React 360's `BasicAppTemplate` sample, running on the WebXR port of the runtime in
[`../React360`](../React360/README.md). It is set up like a `react-360 init`
project (React 16.3, React Native 0.55, three.js r87), with the fixes that
toolchain needs to run on current Node.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:8081/index.html. Hover the scene buttons and click one
to switch the panorama.

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

- `rn-cli.config.js` resolves `react-360-web` (plus its `three`, `eventemitter3`
  and `three-gltf2-loader` imports) from `../React360`, which it adds as a
  project root. Metro 0.30 doesn't follow symlinks, so an npm `file:`
  dependency won't work.
- `rn-cli.config.js` also defines its own blacklist RegExp. Metro's default one
  is invalid on Windows with current Node.
- `scripts/patch-toolchain.js` runs on `postinstall` and patches two things in
  `node_modules`. It skips React Native's comment-only `setup_env.bat`, because
  Node no longer spawns `.bat` files without a shell after CVE-2024-27980. It
  also replaces `md4` with `md5` in Metro's cache-key hash, since OpenSSL 3 no
  longer provides `md4`.
- `index.html` has no `bridgeFile` option. The `react-360@1.1.0` package on npm
  predates `NonBlobBridge.js`, so the React app runs in the default Blob URL
  web worker.
- `index.js` fixes the sample's `for (const i = 0; ...; i++)` loop, which
  doesn't compile.
